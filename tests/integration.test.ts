import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import mongoose from "mongoose";
import { resetDb, seedStructure, setupDb, makeUser } from "./helpers";
import { AttendanceRecord, Enrollment, Lecture, Student, Subject } from "@/server/db/models";
import { createStudent, listStudents, updateStudent, reserveStudentSeqs } from "@/server/services/students";
import { createImportJob, processImportBatch, getImportJob } from "@/server/services/imports";
import { enrollStudents, listSubjectStudents, decideEnrollments } from "@/server/services/enrollment";
import { saveSubject, listSubjects } from "@/server/services/subjects";
import { createLectures, openLecture, closeLecture, reconcileLectures, cancelLecture } from "@/server/services/lectures";
import { staffMarkPresent, setAttendanceStatus, selfCheckin } from "@/server/services/attendance";
import { subjectReport } from "@/server/services/reports";
import { inquire } from "@/server/services/inquiry";
import { studentQrPayload } from "@/server/qr";
import { utcToZonedParts } from "@/lib/time";
import { AppError } from "@/server/errors";

let S: Awaited<ReturnType<typeof seedStructure>>;

beforeAll(async () => {
  await setupDb();
});
afterAll(async () => {
  await mongoose.disconnect();
});
beforeEach(async () => {
  await resetDb();
  S = await seedStructure();
});

const y = (level: number) => String(S.years[level - 1]._id);

async function xlsx(rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("s");
  ws.addRow(["الاسم الكامل *", "السنة الدراسية *", "التخصص", "الشعبة", "رقم القيد", "ملاحظات"]);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("student codes", () => {
  it("generates unique sequential codes under concurrency", async () => {
    const admin = await makeUser("admin");
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => createStudent(admin, { fullName: `طالب رقم ${i} اختبار`, academicYear: y(1) })),
    );
    const codes = results.map((r) => r.code);
    expect(new Set(codes).size).toBe(25);
    expect(codes.every((c) => /^ST\d{5}$/.test(c))).toBe(true);
  });

  it("never reuses reserved numbers", async () => {
    const a = await reserveStudentSeqs(3);
    const b = await reserveStudentSeqs(1);
    expect(b).toBe(a + 3);
  });

  it("enforces specialization policy on the server", async () => {
    const admin = await makeUser("admin");
    const s1 = await createStudent(admin, { fullName: "أحمد محمد علي", academicYear: y(1), department: String(S.trn._id) });
    const st = await Student.findById(s1.id).lean();
    expect(String(st!.department)).toBe(String(S.gen._id)); // forced to No Specialization
    await expect(createStudent(admin, { fullName: "محمود سعيد علي", academicYear: y(3), department: String(S.gen._id) })).rejects.toBeInstanceOf(AppError);
    await expect(createStudent(admin, { fullName: "محمود سعيد علي", academicYear: y(3) })).rejects.toBeInstanceOf(AppError);
    const ok = await createStudent(admin, { fullName: "محمود سعيد علي", academicYear: y(3), department: String(S.tch._id) });
    expect(ok.code).toMatch(/^ST/);
  });

  it("detects duplicate names unless explicitly confirmed", async () => {
    const admin = await makeUser("admin");
    await createStudent(admin, { fullName: "سارة أحمد محمود", academicYear: y(1) });
    await expect(createStudent(admin, { fullName: "ساره احمد محمود", academicYear: y(2) })).rejects.toMatchObject({ code: "CONFLICT" });
    const second = await createStudent(admin, { fullName: "سارة أحمد محمود", academicYear: y(2), allowSameName: true });
    expect(second.code).toBeTruthy();
  });
});

describe("excel import", () => {
  it("validates, previews and imports without duplicates (even when run twice / concurrently)", async () => {
    const admin = await makeUser("admin");
    await createStudent(admin, { fullName: "موجود مسبقا في النظام", academicYear: y(1) });
    const buf = await xlsx([
      ["علي حسن محمود", "الفرقة الأولى", "", "", "", ""],
      ["منى خالد يوسف", "الفرقة الثالثة", "التدريس", "", "R-100", ""],
      ["منى خالد يوسف", "الفرقة الثالثة", "التدريس", "", "R100", ""], // same reg no → duplicate within file
      ["", "الفرقة الأولى", "", "", "", ""],
      ["كريم سامي عادل", "الفرقة الثالثة", "", "", "", ""], // missing specialization
      ["كريم سامي عادل", "الفرقة التاسعة", "", "", "", ""], // unknown year
      ["موجود مسبقا في النظام", "الفرقة الأولى", "", "", "", ""], // existing
    ]);
    const jobId = await createImportJob(admin, "students.xlsx", buf, String(S.college._id));
    const { job } = await getImportJob(admin, jobId);
    expect(job.totals).toMatchObject({ rows: 7, valid: 2, invalid: 3, duplicate: 2 });

    // Second upload of the same file while the first one is not yet committed
    const jobId2 = await createImportJob(admin, "students.xlsx", buf, String(S.college._id));

    // Process both concurrently until done
    const run = async (id: string) => {
      for (let i = 0; i < 10; i++) {
        const r = await processImportBatch(admin, id);
        if (r.done) return r;
      }
      throw new Error("not done");
    };
    await Promise.all([run(jobId), run(jobId2)]);
    expect(await Student.countDocuments({ fullName: "علي حسن محمود" })).toBe(1);
    expect(await Student.countDocuments({ registrationNumber: { $in: ["R-100", "R100"] } })).toBe(1);
    const a = (await getImportJob(admin, jobId)).job.totals;
    const b = (await getImportJob(admin, jobId2)).job.totals;
    expect(a.created + b.created).toBe(2);
  });

  it("rejects malformed files and wrong headers", async () => {
    const admin = await makeUser("admin");
    await expect(createImportJob(admin, "x.xlsx", Buffer.from("hello world"), String(S.college._id))).rejects.toMatchObject({ code: "VALIDATION" });
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("s").addRow(["name", "year"]);
    const bad = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(createImportJob(admin, "x.xlsx", bad, String(S.college._id))).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("staff scope", () => {
  it("prevents leaders from reading or editing students outside their scope", async () => {
    const admin = await makeUser("admin");
    const inScope = await createStudent(admin, { fullName: "طالب داخل النطاق", academicYear: y(1) });
    const outScope = await createStudent(admin, { fullName: "طالب خارج النطاق", academicYear: y(2) });
    const leader = await makeUser("staff", {
      permissions: ["students.view", "students.edit", "students.create"],
      scope: { college: S.college._id, academicYears: [S.years[0]._id] },
    });
    const list = await listStudents(leader, {});
    expect(list.items.map((s) => s.code)).toEqual([inScope.code]);
    await expect(updateStudent(leader, outScope.id, { fullName: "تعديل غير مسموح به", academicYear: y(2) })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Cannot move an in-scope student out of scope
    await expect(updateStudent(leader, inScope.id, { fullName: "طالب داخل النطاق", academicYear: y(2) })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Cannot create outside scope
    await expect(createStudent(leader, { fullName: "طالب جديد خارج", academicYear: y(2) })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // No permission → forbidden
    const viewer = await makeUser("staff", { permissions: [], scope: { college: S.college._id } });
    await expect(listStudents(viewer, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

async function setupSubject() {
  const admin = await makeUser("admin");
  const doctor = await makeUser("doctor");
  const otherDoctor = await makeUser("doctor");
  const subjectId = await saveSubject(admin, {
    name: "فسيولوجيا الرياضة",
    code: "PHY101",
    college: String(S.college._id),
    academicYears: [y(1)],
    doctors: [doctor.id],
    requiresEnrollmentApproval: true,
  });
  const s1 = await createStudent(admin, { fullName: "الطالب الأول اختبار", academicYear: y(1) });
  const s2 = await createStudent(admin, { fullName: "الطالب الثاني اختبار", academicYear: y(1) });
  const s3 = await createStudent(admin, { fullName: "الطالب الثالث اختبار", academicYear: y(2) });
  return { admin, doctor, otherDoctor, subjectId, s1, s2, s3 };
}

function lectureInput(over: Record<string, unknown> = {}) {
  const now = new Date();
  const start = utcToZonedParts(new Date(now.getTime() - 30 * 60_000));
  const end = utcToZonedParts(new Date(now.getTime() + 60 * 60_000));
  return { title: "المحاضرة الأولى", date: start.date, startTime: start.time, endTime: end.date === start.date ? end.time : "23:59", mode: "manual", method: "staff_only", ...over };
}

describe("subjects & enrollment", () => {
  it("doctors only see their subjects; eligibility is enforced", async () => {
    const { doctor, otherDoctor, subjectId, s1, s3 } = await setupSubject();
    expect((await listSubjects(doctor)).items).toHaveLength(1);
    expect((await listSubjects(otherDoctor)).items).toHaveLength(0);
    await expect(listSubjectStudents(otherDoctor, subjectId, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    const r = await enrollStudents(doctor, subjectId, { studentIds: [s1.id, s3.id] });
    expect(r.added).toBe(1);
    expect(r.rejected).toHaveLength(1);
  });

  it("staff requests require doctor approval", async () => {
    const { doctor, subjectId, s1 } = await setupSubject();
    const leader = await makeUser("staff", { permissions: ["enrollment.request", "students.view"], scope: { college: S.college._id, academicYears: [S.years[0]._id] } });
    const r = await enrollStudents(leader, subjectId, { studentIds: [s1.id] });
    expect(r.status).toBe("pending");
    const pending = await listSubjectStudents(doctor, subjectId, { enrollment: "pending" });
    expect(pending.total).toBe(1);
    await decideEnrollments(doctor, subjectId, { enrollmentIds: [pending.items[0].enrollmentId], decision: "approve" });
    expect(await Enrollment.countDocuments({ status: "approved" })).toBe(1);
  });
});

describe("attendance engine", () => {
  it("staff marking only while open; closed requires doctor + reason; no duplicates", async () => {
    const { doctor, subjectId, s1, s2, otherDoctor } = await setupSubject();
    await enrollStudents(doctor, subjectId, { studentIds: [s1.id, s2.id] });
    const [lectureId] = await createLectures(doctor, subjectId, lectureInput());
    const leader = await makeUser("staff", { permissions: ["attendance.mark", "attendance.view"], scope: { college: S.college._id, academicYears: [S.years[0]._id] } });

    await expect(staffMarkPresent(leader, lectureId, { code: s1.code })).rejects.toMatchObject({ code: "FORBIDDEN" }); // not open yet
    await expect(openLecture(leader, lectureId)).rejects.toBeInstanceOf(AppError); // leaders cannot open
    await expect(openLecture(otherDoctor, lectureId)).rejects.toBeInstanceOf(AppError);
    await openLecture(doctor, lectureId);

    await Promise.all([staffMarkPresent(leader, lectureId, { code: s1.code }), staffMarkPresent(leader, lectureId, { code: s1.code }), staffMarkPresent(doctor, lectureId, { qr: studentQrPayload(s1.code) })]);
    expect(await AttendanceRecord.countDocuments({ lecture: lectureId })).toBe(1);

    await closeLecture(doctor, lectureId);
    await expect(staffMarkPresent(leader, lectureId, { code: s2.code })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setAttendanceStatus(leader, lectureId, { studentId: s2.id, status: "present" })).rejects.toBeInstanceOf(AppError);
    await expect(setAttendanceStatus(doctor, lectureId, { studentId: s2.id, status: "present" })).rejects.toMatchObject({ code: "VALIDATION" });
    await setAttendanceStatus(doctor, lectureId, { studentId: s2.id, status: "present", reason: "حضر متأخرًا" });
    const rec = await AttendanceRecord.findOne({ lecture: lectureId, student: s2.id }).lean();
    expect(rec?.source).toBe("doctor_correction");
    expect(rec?.history[0].reason).toBe("حضر متأخرًا");

    const report = await subjectReport(doctor, subjectId, {});
    expect(report.rows.every((r) => r.attended === 1 && r.absences === 0)).toBe(true);
  });

  it("absence is counted only after closure and never for cancelled lectures", async () => {
    const { doctor, subjectId, s1 } = await setupSubject();
    await Enrollment.create({ subject: subjectId, student: s1.id, status: "approved", effectiveFrom: new Date(Date.now() - 86_400_000) });
    const [l1, l2] = await createLectures(doctor, subjectId, lectureInput());
    void l2;
    await openLecture(doctor, l1);
    let rep = await subjectReport(doctor, subjectId, {});
    expect(rep.rows[0]).toMatchObject({ eligible: 0, absences: 0 }); // open → not counted
    await closeLecture(doctor, l1);
    const [l3] = await createLectures(doctor, subjectId, lectureInput({ title: "ملغاة" }));
    await cancelLecture(doctor, l3, "عطلة رسمية");
    rep = await subjectReport(doctor, subjectId, {});
    expect(rep.rows[0]).toMatchObject({ eligible: 1, attended: 0, absences: 1, percentage: 0 });
  });

  it("scheduled sessions open/close by server time, idempotently", async () => {
    const { doctor, subjectId } = await setupSubject();
    const past = utcToZonedParts(new Date(Date.now() - 3 * 3600_000));
    const pastEnd = utcToZonedParts(new Date(Date.now() - 2 * 3600_000));
    const [id] = await createLectures(doctor, subjectId, {
      ...lectureInput(),
      date: past.date,
      startTime: past.time,
      endTime: pastEnd.date === past.date ? pastEnd.time : "23:59",
      mode: "scheduled",
      opensDate: past.date,
      opensTime: past.time,
      closesDate: pastEnd.date,
      closesTime: pastEnd.time,
    });
    await Promise.all([reconcileLectures(), reconcileLectures()]);
    const l = await Lecture.findById(id).lean();
    expect(l?.status).toBe("closed");
    expect(l?.closedAt?.getTime()).toBe(l?.attendance.closesAt?.getTime());
  });

  it("self check-in enforces method, location radius, enrollment and device rules", async () => {
    const { doctor, subjectId, s1, s2 } = await setupSubject();
    await enrollStudents(doctor, subjectId, { studentIds: [s1.id, s2.id] });
    const [id] = await createLectures(doctor, subjectId, lectureInput({ method: "location_qr", lat: 30.0444, lng: 31.2357, radiusM: 100 }));
    const lecture = (await Lecture.findById(id).lean())!;
    const token = lecture.attendance.checkinToken;
    const ctx = { ip: "1.1.1.1", deviceId: "dev-1" };
    expect((await selfCheckin({ token, qr: studentQrPayload(s1.code), lat: 30.0444, lng: 31.2357, accuracy: 10 }, ctx)).ok).toBe(false); // not open
    await openLecture(doctor, id);
    expect(await selfCheckin({ token, code: s1.code, lat: 30.0444, lng: 31.2357, accuracy: 10 }, ctx)).toMatchObject({ ok: false, reason: "qr_required" });
    expect(await selfCheckin({ token, qr: studentQrPayload(s1.code), lat: 30.06, lng: 31.2357, accuracy: 10 }, ctx)).toMatchObject({ ok: false, reason: "out_of_range" });
    expect(await selfCheckin({ token, qr: studentQrPayload(s1.code), lat: 30.0444, lng: 31.2357, accuracy: 900 }, ctx)).toMatchObject({ ok: false, reason: "location_inaccurate" });
    expect(await selfCheckin({ token, qr: studentQrPayload(s1.code) }, ctx)).toMatchObject({ ok: false, reason: "location_required" });
    expect(await selfCheckin({ token, qr: studentQrPayload(s1.code), lat: 30.0445, lng: 31.2358, accuracy: 20 }, ctx)).toMatchObject({ ok: true, alreadyPresent: false });
    expect(await selfCheckin({ token, qr: studentQrPayload(s1.code), lat: 30.0445, lng: 31.2358, accuracy: 20 }, ctx)).toMatchObject({ ok: true, alreadyPresent: true });
    expect(await selfCheckin({ token, qr: studentQrPayload(s2.code), lat: 30.0445, lng: 31.2358, accuracy: 20 }, ctx)).toMatchObject({ ok: false, reason: "device_used" });
    const s3 = await Student.findOne({ code: { $nin: [s1.code, s2.code] } }).lean();
    expect(await selfCheckin({ token, qr: studentQrPayload(s3!.code), lat: 30.0445, lng: 31.2358, accuracy: 20 }, { ip: "1.1.1.1", deviceId: "dev-2" })).toMatchObject({ ok: false, reason: "not_enrolled" });
  });
});

describe("public inquiry", () => {
  it("returns minimal data and rate-limits failed lookups", async () => {
    const { doctor, subjectId, s1 } = await setupSubject();
    await enrollStudents(doctor, subjectId, { studentIds: [s1.id] });
    const ok = await inquire(s1.code.toLowerCase(), undefined, "9.9.9.9");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.student.name.split(" ").length).toBeLessThanOrEqual(2);
      expect(ok.subjects).toHaveLength(1);
      expect(JSON.stringify(ok)).not.toContain(String(s1.id));
    }
    for (let i = 0; i < 5; i++) expect((await inquire("ST99999", undefined, "8.8.8.8")).ok).toBe(false);
    const blocked = await inquire(s1.code, undefined, "8.8.8.8");
    expect(blocked.ok).toBe(false);
  });
});

describe("subject isolation", () => {
  it("assistants and leaders cannot manage; other doctors cannot see", async () => {
    const { doctor, subjectId } = await setupSubject();
    const sub = await Subject.findById(subjectId).lean();
    expect(sub).toBeTruthy();
    const leaderOtherYear = await makeUser("staff", { permissions: ["attendance.mark"], scope: { college: S.college._id, academicYears: [S.years[3]._id] } });
    const [lectureId] = await createLectures(doctor, subjectId, lectureInput());
    await openLecture(doctor, lectureId);
    await expect(staffMarkPresent(leaderOtherYear, lectureId, { code: "ST00001" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
