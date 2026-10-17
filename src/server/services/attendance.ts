import { z } from "zod";
import type { Types } from "mongoose";
import { AttendanceRecord, Enrollment, Lecture, Student, Subject, type IAttendanceRecord, type IStudent, type ISubject, type ILecture } from "@/server/db/models";
import { methodNeedsLocation, methodNeedsQr, RECORD_STATUSES, type RecordSource, type RecordStatus } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import { canManageSubject, isSubjectAssistant, studentInScope, subjectStudentFilter } from "@/server/authz/policy";
import { AppError, invalid, isDuplicateKeyError } from "@/server/errors";
import { oid } from "@/server/ids";
import { normalizeStudentCode } from "@/lib/codes";
import { effectiveStatus } from "@/lib/session-status";
import { haversineMeters, isValidCoordinate } from "@/lib/geo";
import { verifyStudentQr } from "@/server/qr";
import { buildStudentFilter, toStudentRow } from "./students";
import { getLectureFor, reconcileLectures } from "./lectures";
import { audit } from "./audit";
import { getSettings } from "./settings";
import { hit } from "./rate-limit";

/* ---------------- Shared helpers ---------------- */

async function findStudentByIdentifier(ident: { studentId?: string; code?: string; qr?: string }) {
  if (ident.qr) {
    const code = verifyStudentQr(ident.qr);
    if (!code) throw invalid("رمز QR غير صالح");
    return Student.findOne({ code }).lean();
  }
  if (ident.code) {
    const code = normalizeStudentCode(ident.code);
    if (!code) throw invalid("كود الطالب غير صالح");
    return Student.findOne({ code }).lean();
  }
  if (ident.studentId) return Student.findById(oid(ident.studentId)).lean();
  throw invalid("حدد الطالب");
}

async function approvedEnrollment(subjectId: Types.ObjectId, studentId: Types.ObjectId) {
  return Enrollment.findOne({ subject: subjectId, student: studentId, status: "approved" }).lean();
}

/**
 * Writes a status for (lecture, student). Uses the unique (lecture, student) index:
 * concurrent duplicate submissions result in exactly one record.
 * Returns `{ created, changed, previous }`.
 */
async function writeRecord(params: {
  lecture: Pick<ILecture, "_id" | "subject">;
  studentId: Types.ObjectId;
  status: RecordStatus;
  source: RecordSource;
  by: Types.ObjectId | null;
  reason?: string;
  distanceM?: number | null;
  deviceId?: string | null;
  onlyIfAbsentOrMissing?: boolean;
}) {
  const now = new Date();
  const hist = { at: now, by: params.by, from: null, to: params.status, source: params.source, reason: params.reason };
  try {
    const res = await AttendanceRecord.updateOne(
      { lecture: params.lecture._id, student: params.studentId },
      {
        $setOnInsert: {
          subject: params.lecture.subject,
          status: params.status,
          source: params.source,
          markedBy: params.by,
          markedAt: now,
          distanceM: params.distanceM ?? null,
          deviceId: params.deviceId ?? null,
          history: [hist],
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount) return { created: true, changed: true, previous: null as RecordStatus | null };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
  const existing = await AttendanceRecord.findOne({ lecture: params.lecture._id, student: params.studentId }).lean();
  if (!existing) throw new AppError("CONFLICT");
  if (existing.status === params.status) return { created: false, changed: false, previous: existing.status };
  if (params.onlyIfAbsentOrMissing && existing.status === "present") return { created: false, changed: false, previous: existing.status };
  const upd = await AttendanceRecord.updateOne(
    { _id: existing._id, status: existing.status },
    {
      $set: { status: params.status, source: params.source, markedBy: params.by, markedAt: now },
      $push: { history: { ...hist, from: existing.status } },
    },
  );
  return { created: false, changed: upd.modifiedCount > 0, previous: existing.status };
}

/* ---------------- Staff-assisted marking ---------------- */

export const staffMarkSchema = z.object({
  studentId: z.string().optional(),
  code: z.string().max(30).optional(),
  qr: z.string().max(200).optional(),
});

/**
 * Doctor / assistant / authorized leader marks a student present while the session is OPEN.
 * Leaders are additionally limited to students within their scope.
 */
export async function staffMarkPresent(actor: Actor, lectureId: string, input: unknown) {
  const ident = staffMarkSchema.parse(input);
  const { lecture, subject } = await getLectureFor(actor, lectureId, "mark");
  const status = effectiveStatus(lecture);
  if (status !== "open") {
    throw new AppError("FORBIDDEN", status === "closed" ? "الجلسة مغلقة. التصحيح متاح للدكتور فقط من كشف الحضور." : "جلسة الحضور غير مفتوحة");
  }
  const st = await findStudentByIdentifier(ident);
  if (!st || st.status !== "active") throw new AppError("NOT_FOUND", "الطالب غير موجود");
  const privileged = canManageSubject(actor, subject) || isSubjectAssistant(actor, subject);
  if (!privileged && !studentInScope(actor, st)) throw new AppError("FORBIDDEN", "الطالب خارج نطاق صلاحياتك");
  if (!(await approvedEnrollment(subject._id, st._id))) throw invalid(`الطالب ${st.code} غير مسجل في هذه المادة`);

  const r = await writeRecord({ lecture, studentId: st._id, status: "present", source: "staff", by: actor.oid, onlyIfAbsentOrMissing: false });
  if (r.changed) {
    await audit(actor, {
      action: "attendance.mark",
      summary: `تسجيل حضور ${st.code} - ${lecture.title} (${subject.code})`,
      entityType: "lecture",
      entityId: lecture._id,
      meta: { student: st.code, previous: r.previous },
    });
  }
  return { student: { code: st.code, fullName: st.fullName }, alreadyPresent: !r.changed };
}

/* ---------------- Doctor sheet / corrections ---------------- */

export const setStatusSchema = z.object({
  studentId: z.string().regex(/^[a-f0-9]{24}$/i),
  status: z.enum(RECORD_STATUSES),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Set any status for a student in a lecture. Only subject managers (doctor/admin).
 * After closure a reason is mandatory and the source is recorded as a doctor correction.
 */
export async function setAttendanceStatus(actor: Actor, lectureId: string, input: unknown) {
  const data = setStatusSchema.parse(input);
  const { lecture, subject } = await getLectureFor(actor, lectureId, "manage");
  const status = effectiveStatus(lecture);
  if (status === "cancelled") throw invalid("المحاضرة ملغاة");
  if (status === "scheduled") throw invalid("لم تبدأ جلسة الحضور بعد");
  const closed = status === "closed";
  if (closed && (!data.reason || data.reason.length < 3)) throw invalid("سبب التصحيح مطلوب بعد إغلاق الجلسة", { reason: "مطلوب" });

  const st = await Student.findById(oid(data.studentId)).lean();
  if (!st) throw new AppError("NOT_FOUND");
  if (!(await approvedEnrollment(subject._id, st._id))) throw invalid("الطالب غير مسجل في هذه المادة");

  const r = await writeRecord({
    lecture,
    studentId: st._id,
    status: data.status,
    source: closed ? "doctor_correction" : "staff",
    by: actor.oid,
    reason: data.reason,
  });
  if (r.changed) {
    await audit(actor, {
      action: closed ? "attendance.correct" : "attendance.mark",
      summary: `${closed ? "تصحيح" : "تسجيل"} حالة ${st.code} إلى "${data.status}" - ${lecture.title} (${subject.code})`,
      entityType: "lecture",
      entityId: lecture._id,
      meta: { student: st.code, from: r.previous ?? (closed ? "absent" : null), to: data.status, reason: data.reason },
    });
  }
  return { changed: r.changed };
}

export const clearStatusSchema = z.object({
  studentId: z.string().regex(/^[a-f0-9]{24}$/i),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Undo a student's mark (subject managers only).
 * Open session: the record is removed and the student is back to "not marked".
 * Closed session: unmarked means absent, so the record becomes "absent" as an audited correction (reason required).
 */
export async function clearAttendance(actor: Actor, lectureId: string, input: unknown) {
  const data = clearStatusSchema.parse(input);
  const { lecture, subject } = await getLectureFor(actor, lectureId, "manage");
  const status = effectiveStatus(lecture);
  if (status === "closed") {
    return setAttendanceStatus(actor, lectureId, { studentId: data.studentId, status: "absent", reason: data.reason });
  }
  if (status !== "open") throw invalid("جلسة الحضور غير مفتوحة");

  const studentId = oid(data.studentId);
  const removed = await AttendanceRecord.findOneAndDelete({ lecture: lecture._id, student: studentId }).lean();
  if (!removed) return { changed: false };
  const st = await Student.findById(studentId).select("code").lean();
  await audit(actor, {
    action: "attendance.unmark",
    summary: `إلغاء تسجيل ${st?.code ?? "طالب"} (${removed.status}) - ${lecture.title} (${subject.code})`,
    entityType: "lecture",
    entityId: lecture._id,
    meta: { student: st?.code, previous: removed.status, history: removed.history },
  });
  return { changed: true };
}

/** Bulk mark all unmarked enrolled students present (doctor convenience during an open session). */
export async function markAllPresent(actor: Actor, lectureId: string) {
  const { lecture, subject } = await getLectureFor(actor, lectureId, "manage");
  if (effectiveStatus(lecture) !== "open") throw invalid("الجلسة يجب أن تكون مفتوحة");
  const marked = await AttendanceRecord.distinct("student", { lecture: lecture._id });
  const cursor = Enrollment.find({ subject: subject._id, status: "approved", student: { $nin: marked } }).select("student").lean().cursor({ batchSize: 500 });
  let n = 0;
  let ops: Parameters<typeof AttendanceRecord.bulkWrite>[0] = [];
  const now = new Date();
  const flush = async () => {
    if (!ops.length) return;
    const res = await AttendanceRecord.bulkWrite(ops, { ordered: false }).catch((e) => {
      if (!(e as { writeErrors?: unknown }).writeErrors) throw e;
      return (e as { result: { upsertedCount: number } }).result;
    });
    n += res.upsertedCount;
    ops = [];
  };
  for await (const e of cursor) {
    ops.push({
      updateOne: {
        filter: { lecture: lecture._id, student: e.student },
        update: {
          $setOnInsert: {
            subject: subject._id,
            status: "present",
            source: "staff",
            markedBy: actor.oid,
            markedAt: now,
            history: [{ at: now, by: actor.oid, from: null, to: "present", source: "staff", reason: "تسجيل جماعي" }],
          },
        },
        upsert: true,
      },
    });
    if (ops.length >= 500) await flush();
  }
  await flush();
  await audit(actor, { action: "attendance.mark", summary: `تسجيل حضور جماعي (${n}) - ${lecture.title} (${subject.code})`, entityType: "lecture", entityId: lecture._id });
  return { marked: n };
}

/** Attendance sheet of a lecture: enrolled students (scoped) with their record. */
export async function lectureSheet(actor: Actor, lectureId: string, params: { q?: string; filter?: string; page?: number; pageSize?: number }) {
  const { lecture, subject } = await getLectureFor(actor, lectureId, "view");
  const status = effectiveStatus(lecture);
  const scope = subjectStudentFilter(actor, subject);
  const stFilter = { ...buildStudentFilter({ q: params.q, status: "all" }), ...scope };
  const prefixed = Object.fromEntries(
    Object.entries(stFilter).map(([k, v]) =>
      k === "$or" ? [k, (v as Record<string, unknown>[]).map((c) => Object.fromEntries(Object.entries(c).map(([a, b]) => ["st." + a, b])))] : ["st." + k, v],
    ),
  );
  const recordMatch: Record<string, unknown> = {};
  if (params.filter === "present") recordMatch["rec.status"] = "present";
  else if (params.filter === "excused") recordMatch["rec.status"] = "excused";
  else if (params.filter === "absent") recordMatch.$or = [{ "rec.status": "absent" }, { rec: null }];
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, params.pageSize ?? 50);

  const [res] = await Enrollment.aggregate<{
    items: { st: IStudent; rec: IAttendanceRecord | null }[];
    total: { n: number }[];
  }>([
    { $match: { subject: subject._id, status: "approved" } },
    { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "st" } },
    { $unwind: "$st" },
    { $match: prefixed },
    {
      $lookup: {
        from: "attendancerecords",
        let: { sid: "$student" },
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$lecture", lecture._id] }, { $eq: ["$student", "$$sid"] }] } } }, { $limit: 1 }],
        as: "rec",
      },
    },
    { $set: { rec: { $ifNull: [{ $first: "$rec" }, null] } } },
    { $match: recordMatch },
    { $sort: { "st.seq": 1 } },
    { $facet: { items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }], total: [{ $count: "n" }] } },
  ]);

  const counts = await AttendanceRecord.aggregate<{ _id: RecordStatus; n: number }>([
    { $match: { lecture: lecture._id } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const enrolled = await Enrollment.countDocuments({ subject: subject._id, status: "approved" });
  const c = Object.fromEntries(counts.map((x) => [x._id, x.n])) as Partial<Record<RecordStatus, number>>;

  return {
    lecture,
    subject,
    status,
    summary: { enrolled, present: c.present ?? 0, excused: c.excused ?? 0, absentExplicit: c.absent ?? 0 },
    total: res?.total[0]?.n ?? 0,
    page,
    pageSize,
    items: (res?.items ?? []).map((x) => ({
      student: toStudentRow(x.st),
      record: x.rec
        ? {
            status: x.rec.status,
            source: x.rec.source,
            markedAt: x.rec.markedAt.toISOString(),
            distanceM: x.rec.distanceM ?? null,
            history: x.rec.history.map((h) => ({ at: h.at.toISOString(), from: h.from ?? null, to: h.to, source: h.source, reason: h.reason, by: h.by ? String(h.by) : null })),
          }
        : null,
    })),
  };
}

/* ---------------- Public self check-in ---------------- */

export const checkinSchema = z.object({
  token: z.string().min(10).max(64),
  code: z.string().max(30).optional(),
  qr: z.string().max(200).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  accuracy: z.number().optional(),
});

export type CheckinOutcome =
  | { ok: true; message: string; studentName: string; alreadyPresent: boolean }
  | { ok: false; message: string; reason: string };

const fail = (reason: string, message: string): CheckinOutcome => ({ ok: false, reason, message });

/** Public info about a check-in link (no student data). */
export async function checkinInfo(token: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const lecture = await Lecture.findOne({ "attendance.checkinToken": token }).lean();
  if (!lecture) return null;
  await reconcileLectures({ _id: lecture._id });
  const fresh = (await Lecture.findById(lecture._id).lean())!;
  const subject = await Subject.findById(fresh.subject).select("name code").lean();
  return {
    title: fresh.title,
    subjectName: subject?.name ?? "",
    subjectCode: subject?.code ?? "",
    startsAt: fresh.startsAt.toISOString(),
    endsAt: fresh.endsAt.toISOString(),
    venue: fresh.venue,
    status: effectiveStatus(fresh),
    method: fresh.attendance.method,
    closesAt: fresh.attendance.closesAt?.toISOString() ?? null,
  };
}

/**
 * Student self check-in. All decisions use server time and server-side checks:
 * session open, method requirements (signed QR / location radius & accuracy), active enrollment,
 * one student per device per lecture, rate limiting.
 */
export async function selfCheckin(input: unknown, ctx: { ip: string; deviceId: string }): Promise<CheckinOutcome> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return fail("invalid", "بيانات غير صالحة");
  const d = parsed.data;

  const rl = await hit(`checkin:ip:${ctx.ip}`, 30, 600);
  if (!rl.allowed) {
    if (rl.count === 31) await audit(null, { action: "security.checkin_blocked", summary: "تجاوز حد محاولات تسجيل الحضور", ip: ctx.ip });
    return fail("rate_limited", "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.");
  }

  const lecture0 = await Lecture.findOne({ "attendance.checkinToken": d.token }).lean();
  if (!lecture0) return fail("not_found", "رابط الحضور غير صالح أو منتهي");
  await reconcileLectures({ _id: lecture0._id });
  const lecture = (await Lecture.findById(lecture0._id).lean())!;
  const status = effectiveStatus(lecture);
  if (status !== "open") return fail("not_open", status === "scheduled" ? "لم يبدأ تسجيل الحضور بعد" : "تسجيل الحضور مغلق لهذه المحاضرة");
  const method = lecture.attendance.method;
  if (method === "staff_only") return fail("staff_only", "الحضور في هذه المحاضرة يُسجل بواسطة الدكتور أو المسؤول فقط");

  // Identify the student
  let code: string | null = null;
  if (methodNeedsQr(method)) {
    if (!d.qr) return fail("qr_required", "يجب مسح رمز QR الخاص ببطاقة الطالب");
    code = verifyStudentQr(d.qr);
    if (!code) return fail("qr_invalid", "رمز QR غير صالح");
  } else {
    code = d.qr ? verifyStudentQr(d.qr) : normalizeStudentCode(d.code ?? "");
    if (!code) return fail("code_invalid", "أدخل كود طالب صحيح مثل ST00001");
  }

  // Location
  let distanceM: number | null = null;
  if (methodNeedsLocation(method)) {
    const loc = lecture.attendance.location;
    if (!loc || !lecture.attendance.radiusM) return fail("config", "موقع المحاضرة غير مُعد. تواصل مع الدكتور.");
    if (d.lat == null || d.lng == null) return fail("location_required", "يجب السماح بالوصول إلى موقعك لتسجيل الحضور");
    if (!isValidCoordinate(d.lat, d.lng)) return fail("location_invalid", "إحداثيات الموقع غير صالحة");
    const settings = await getSettings();
    if (d.accuracy == null || !Number.isFinite(d.accuracy) || d.accuracy <= 0 || d.accuracy > settings.maxLocationAccuracyM)
      return fail("location_inaccurate", `دقة تحديد الموقع ضعيفة (${d.accuracy ? Math.round(d.accuracy) : "؟"} م). انتقل لمكان مفتوح وفعّل GPS ثم حاول مجددًا.`);
    distanceM = Math.round(haversineMeters(loc, { lat: d.lat, lng: d.lng }));
    if (distanceM > lecture.attendance.radiusM) return fail("out_of_range", `أنت خارج نطاق المحاضرة (المسافة ${distanceM} م، المسموح ${lecture.attendance.radiusM} م)`);
  }

  const genericNotEnrolled = "تعذر تسجيل الحضور: تأكد من الكود وأنك مسجل في هذه المادة";
  const st = await Student.findOne({ code }).select("_id code fullName status").lean();
  if (!st || st.status !== "active") return fail("not_enrolled", genericNotEnrolled);
  if (!(await approvedEnrollment(lecture.subject, st._id))) return fail("not_enrolled", genericNotEnrolled);

  // One student per device per lecture (mitigates checking in for friends from one phone).
  const otherOnDevice = await AttendanceRecord.findOne({ lecture: lecture._id, deviceId: ctx.deviceId, student: { $ne: st._id } }).select("_id").lean();
  if (otherOnDevice) return fail("device_used", "تم استخدام هذا الجهاز لتسجيل حضور طالب آخر في هذه المحاضرة");

  const r = await writeRecord({ lecture, studentId: st._id, status: "present", source: "self_checkin", by: null, distanceM, deviceId: ctx.deviceId, onlyIfAbsentOrMissing: true });
  const firstName = st.fullName.split(" ")[0];
  if (!r.changed) return { ok: true, alreadyPresent: true, studentName: firstName, message: "حضورك مسجل بالفعل" };
  return { ok: true, alreadyPresent: false, studentName: firstName, message: "تم تسجيل حضورك بنجاح" };
}

/* ---------------- Recent activity ---------------- */
export async function recentActivity(subjectIds: Types.ObjectId[], limit = 8) {
  const recs = await AttendanceRecord.find(subjectIds.length ? { subject: { $in: subjectIds } } : {})
    .sort({ markedAt: -1 })
    .limit(limit)
    .populate<{ student: Pick<IStudent, "code" | "fullName"> }>("student", "code fullName")
    .populate<{ subject: Pick<ISubject, "code" | "name"> }>("subject", "code name")
    .lean();
  return recs.map((r) => ({
    id: String(r._id),
    student: r.student ? `${r.student.fullName} (${r.student.code})` : "—",
    subject: r.subject?.name ?? "",
    status: r.status,
    source: r.source,
    at: r.markedAt.toISOString(),
  }));
}

