import ExcelJS from "exceljs";
import type { Types } from "mongoose";
import { AttendanceRecord, Enrollment, Lecture, Student, Subject, User, type IStudent, type ISubject } from "@/server/db/models";
import type { RecordStatus } from "@/lib/constants";
import { RECORD_SOURCE_LABELS, RECORD_STATUS_LABELS } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import { assertAdmin, studentScopeFilter, subjectStudentFilter, visibleSubjectsFilter, hasPermission, isAdmin, isDoctor } from "@/server/authz/policy";
import { AppError } from "@/server/errors";
import { attendancePercentage } from "@/lib/session-status";
import { formatShortDate, formatTime, zonedDayRange, zonedToUtc, formatDateTime } from "@/lib/time";
import { getSubjectFor } from "./subjects";
import { reconcileLectures } from "./lectures";
import { lectureSheet } from "./attendance";
import { getStructure } from "./academic";
import { oid } from "@/server/ids";

export interface ReportFilters {
  q?: string;
  academicYear?: string;
  department?: string;
  section?: string;
  from?: string; // yyyy-mm-dd (institution timezone)
  to?: string;
  sort?: "code" | "name" | "percentage" | "absences";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  below?: number; // only students with percentage below this value
}

export interface StudentStats {
  studentId: string;
  code: string;
  fullName: string;
  academicYear: string;
  department: string;
  section: string | null;
  eligible: number;
  attended: number;
  excused: number;
  absences: number;
  percentage: number | null;
}

function dateRange(f: ReportFilters) {
  const range: Record<string, Date> = {};
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) range.$gte = zonedToUtc(f.from, "00:00");
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) range.$lt = new Date(zonedToUtc(f.to, "00:00").getTime() + 86_400_000);
  return Object.keys(range).length ? range : null;
}

/**
 * Pure computation of a student's stats from the subject's closed lectures and the student's records.
 * Eligible = closed lectures starting at/after effectiveFrom + any closed lecture with a record.
 */
export function computeStats(
  closed: { id: string; startsAt: Date }[],
  effectiveFrom: Date,
  records: { lecture: string; status: RecordStatus }[],
) {
  const closedIds = new Set(closed.map((l) => l.id));
  const recByLecture = new Map(records.filter((r) => closedIds.has(r.lecture)).map((r) => [r.lecture, r.status]));
  let eligible = 0;
  let attended = 0;
  let excused = 0;
  for (const l of closed) {
    const rec = recByLecture.get(l.id);
    if (l.startsAt.getTime() < effectiveFrom.getTime() && !rec) continue;
    eligible++;
    if (rec === "present") attended++;
    else if (rec === "excused") excused++;
  }
  const absences = eligible - attended - excused;
  return { eligible, attended, excused, absences, percentage: attendancePercentage(attended, eligible, excused) };
}

async function closedLecturesOf(subjectId: Types.ObjectId, f: ReportFilters) {
  await reconcileLectures({ subject: subjectId });
  const range = dateRange(f);
  const lectures = await Lecture.find({ subject: subjectId, status: "closed", ...(range ? { startsAt: range } : {}) })
    .select("_id startsAt title")
    .sort({ startsAt: 1 })
    .lean();
  return lectures.map((l) => ({ id: String(l._id), startsAt: l.startsAt, title: l.title }));
}

function studentMatch(f: ReportFilters, scope: Record<string, unknown>) {
  const m: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(scope)) m["st." + k] = v;
  if (f.academicYear && /^[a-f0-9]{24}$/i.test(f.academicYear)) m["st.academicYear"] = oid(f.academicYear);
  if (f.department && /^[a-f0-9]{24}$/i.test(f.department)) m["st.department"] = oid(f.department);
  if (f.section && /^[a-f0-9]{24}$/i.test(f.section)) m["st.section"] = oid(f.section);
  return m;
}

/** All per-student stats for a subject (bounded by the subject's enrollment size). */
async function subjectStats(subject: Pick<ISubject, "_id">, scope: Record<string, unknown>, f: ReportFilters) {
  const closed = await closedLecturesOf(subject._id, f);
  const enrolled = await Enrollment.aggregate<{ student: Types.ObjectId; effectiveFrom: Date; st: IStudent }>([
    { $match: { subject: subject._id, status: "approved" } },
    { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "st" } },
    { $unwind: "$st" },
    { $match: studentMatch(f, scope) },
    { $project: { student: 1, effectiveFrom: 1, "st._id": 1, "st.code": 1, "st.fullName": 1, "st.nameKey": 1, "st.academicYear": 1, "st.department": 1, "st.section": 1, "st.seq": 1 } },
  ]);
  const closedOids = closed.map((l) => oid(l.id));
  const grouped = await AttendanceRecord.aggregate<{ _id: Types.ObjectId; recs: { l: Types.ObjectId; s: RecordStatus }[] }>([
    { $match: { subject: subject._id, lecture: { $in: closedOids } } },
    { $group: { _id: "$student", recs: { $push: { l: "$lecture", s: "$status" } } } },
  ]);
  const recMap = new Map(grouped.map((g) => [String(g._id), g.recs.map((r) => ({ lecture: String(r.l), status: r.s }))]));
  const q = f.q?.trim().toLowerCase();
  const rows: StudentStats[] = [];
  for (const e of enrolled) {
    if (q && !(e.st.code.toLowerCase().includes(q) || e.st.fullName.toLowerCase().includes(q) || e.st.nameKey.includes(q))) continue;
    const s = computeStats(closed, e.effectiveFrom, recMap.get(String(e.student)) ?? []);
    rows.push({
      studentId: String(e.st._id),
      code: e.st.code,
      fullName: e.st.fullName,
      academicYear: String(e.st.academicYear),
      department: String(e.st.department),
      section: e.st.section ? String(e.st.section) : null,
      ...s,
    });
  }
  return { closed, rows };
}

function sortRows(rows: StudentStats[], f: ReportFilters) {
  const dir = f.dir === "desc" ? -1 : 1;
  const key = f.sort ?? "code";
  rows.sort((a, b) => {
    let c = 0;
    if (key === "name") c = a.fullName.localeCompare(b.fullName, "ar");
    else if (key === "percentage") c = (a.percentage ?? 101) - (b.percentage ?? 101);
    else if (key === "absences") c = a.absences - b.absences;
    else c = a.code.localeCompare(b.code);
    return c * dir;
  });
  return rows;
}

export async function subjectReport(actor: Actor, subjectId: string, f: ReportFilters) {
  const subject = await getSubjectFor(actor, subjectId, "reports");
  const { closed, rows } = await subjectStats(subject, subjectStudentFilter(actor, subject), f);
  let filtered = rows;
  if (f.below != null && Number.isFinite(f.below)) filtered = rows.filter((r) => r.percentage != null && r.percentage < f.below!);
  sortRows(filtered, f);
  const totals = filtered.reduce(
    (a, r) => ({ eligible: a.eligible + r.eligible, attended: a.attended + r.attended, excused: a.excused + r.excused, absences: a.absences + r.absences }),
    { eligible: 0, attended: 0, excused: 0, absences: 0 },
  );
  const pageSize = Math.min(200, f.pageSize ?? 25);
  const page = Math.max(1, f.page ?? 1);
  return {
    subject,
    closedCount: closed.length,
    total: filtered.length,
    page,
    pageSize,
    totals: { ...totals, percentage: attendancePercentage(totals.attended, totals.eligible, totals.excused) },
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    allRows: filtered,
  };
}

export type MatrixCell = RecordStatus | "na" | "pending";

/** Students × lectures matrix (non-cancelled lectures in range; max 80 columns). */
export async function subjectMatrix(actor: Actor, subjectId: string, f: ReportFilters) {
  const subject = await getSubjectFor(actor, subjectId, "reports");
  await reconcileLectures({ subject: subject._id });
  const range = dateRange(f);
  const lectures = await Lecture.find({ subject: subject._id, status: { $ne: "cancelled" }, ...(range ? { startsAt: range } : {}) })
    .select("_id startsAt title status")
    .sort({ startsAt: 1 })
    .limit(80)
    .lean();
  const { rows } = await subjectStats(subject, subjectStudentFilter(actor, subject), f);
  sortRows(rows, f);
  const pageSize = Math.min(200, f.pageSize ?? 50);
  const page = Math.max(1, f.page ?? 1);
  const pageRows = f.pageSize === -1 ? rows : rows.slice((page - 1) * pageSize, page * pageSize);
  const ids = pageRows.map((r) => oid(r.studentId));
  const [recs, enrolls] = await Promise.all([
    AttendanceRecord.find({ lecture: { $in: lectures.map((l) => l._id) }, student: { $in: ids } }).select("lecture student status").lean(),
    Enrollment.find({ subject: subject._id, student: { $in: ids } }).select("student effectiveFrom").lean(),
  ]);
  const rec = new Map(recs.map((r) => [`${r.student}:${r.lecture}`, r.status]));
  const eff = new Map(enrolls.map((e) => [String(e.student), e.effectiveFrom]));
  return {
    subject,
    total: rows.length,
    page,
    pageSize,
    lectures: lectures.map((l) => ({ id: String(l._id), startsAt: l.startsAt.toISOString(), title: l.title, status: l.status })),
    rows: pageRows.map((r) => ({
      ...r,
      cells: lectures.map<MatrixCell>((l) => {
        const s = rec.get(`${r.studentId}:${l._id}`);
        if (s) return s;
        if (l.status !== "closed") return "pending";
        const ef = eff.get(r.studentId);
        if (ef && l.startsAt < ef) return "na";
        return "absent";
      }),
    })),
  };
}

/* ---------------- Group report (year / department / section) ---------------- */
export async function groupReport(actor: Actor, f: ReportFilters) {
  if (!isAdmin(actor) && !isDoctor(actor) && !hasPermission(actor, "reports.view")) throw new AppError("FORBIDDEN");
  const subjects = await Subject.find({ $and: [visibleSubjectsFilter(actor), { active: true }] }).sort({ name: 1 }).limit(60).lean();
  const out = [];
  for (const s of subjects) {
    const { closed, rows } = await subjectStats(s, subjectStudentFilter(actor, s), f);
    if (!rows.length) continue;
    const t = rows.reduce((a, r) => ({ e: a.e + r.eligible, at: a.at + r.attended, ex: a.ex + r.excused, ab: a.ab + r.absences }), { e: 0, at: 0, ex: 0, ab: 0 });
    const below = rows.filter((r) => r.percentage != null && r.percentage < (f.below ?? 75)).length;
    out.push({
      subjectId: String(s._id),
      name: s.name,
      code: s.code,
      students: rows.length,
      lectures: closed.length,
      attended: t.at,
      absences: t.ab,
      excused: t.ex,
      percentage: attendancePercentage(t.at, t.e, t.ex),
      below,
    });
  }
  return out;
}

/* ---------------- Admin overview ---------------- */
export async function adminOverview(actor: Actor) {
  assertAdmin(actor);
  await reconcileLectures();
  const { start, end } = zonedDayRange();
  const [students, subjects, doctors, staff, todayLectures, openSessions, pendingRequests] = await Promise.all([
    Student.countDocuments({ status: "active" }),
    Subject.countDocuments({ active: true }),
    User.countDocuments({ role: "doctor", active: true }),
    User.countDocuments({ role: "staff", active: true }),
    Lecture.countDocuments({ startsAt: { $gte: start, $lt: end }, status: { $ne: "cancelled" } }),
    Lecture.countDocuments({ status: "open" }),
    Enrollment.countDocuments({ status: "pending" }),
  ]);
  const subjectsWithoutDoctor = await Subject.countDocuments({ active: true, doctors: { $size: 0 } });
  return { students, subjects, doctors, staff, todayLectures, openSessions, pendingRequests, subjectsWithoutDoctor };
}

/** Daily attendance rate for closed lectures over the last `days` days (only verified, closed sessions). */
export async function attendanceTrend(subjectFilter: Record<string, unknown>, days = 14) {
  const { end } = zonedDayRange();
  const from = new Date(end.getTime() - days * 86_400_000);
  const subjects = await Subject.find(subjectFilter).select("_id").lean();
  const sids = subjects.map((s) => s._id);
  const lectures = await Lecture.find({ subject: { $in: sids }, status: "closed", startsAt: { $gte: from, $lt: end } }).select("_id subject startsAt").limit(2000).lean();
  if (!lectures.length) return [];
  const lsids = [...new Set(lectures.map((l) => String(l.subject)))].map((x) => oid(x));
  const [effs, recs] = await Promise.all([
    Enrollment.aggregate<{ _id: Types.ObjectId; effs: Date[] }>([
      { $match: { subject: { $in: lsids }, status: "approved" } },
      { $group: { _id: "$subject", effs: { $push: "$effectiveFrom" } } },
    ]),
    AttendanceRecord.aggregate<{ _id: { l: Types.ObjectId; s: RecordStatus }; n: number }>([
      { $match: { lecture: { $in: lectures.map((l) => l._id) } } },
      { $group: { _id: { l: "$lecture", s: "$status" }, n: { $sum: 1 } } },
    ]),
  ]);
  const effMap = new Map(effs.map((e) => [String(e._id), e.effs]));
  const recCount = (l: Types.ObjectId, s: RecordStatus) => recs.find((r) => String(r._id.l) === String(l) && r._id.s === s)?.n ?? 0;
  const byDay = new Map<string, { eligible: number; present: number; excused: number }>();
  for (const l of lectures) {
    const eligible = (effMap.get(String(l.subject)) ?? []).filter((d) => d <= l.startsAt).length;
    const key = formatShortDate(l.startsAt);
    const cur = byDay.get(key) ?? { eligible: 0, present: 0, excused: 0 };
    cur.eligible += eligible;
    cur.present += recCount(l._id, "present");
    cur.excused += recCount(l._id, "excused");
    byDay.set(key, cur);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day: day.slice(5), rate: attendancePercentage(Math.min(v.present, v.eligible), v.eligible, v.excused) ?? 0, present: v.present }));
}

/* ---------------- Excel exports ---------------- */

function sheet(wb: ExcelJS.Workbook, name: string) {
  return wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 } });
}

function header(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 24;
}

async function names() {
  const s = await getStructure();
  const map = new Map<string, string>();
  for (const x of [...s.years, ...s.departments, ...s.sections]) map.set(x.id, x.name);
  return (id: string | null) => (id ? map.get(id) ?? "" : "");
}

export async function exportSubjectReport(actor: Actor, subjectId: string, f: ReportFilters) {
  const r = await subjectReport(actor, subjectId, { ...f, page: 1, pageSize: 200 });
  const n = await names();
  const wb = new ExcelJS.Workbook();
  const ws = sheet(wb, "تقرير الحضور");
  ws.columns = [
    { header: "كود الطالب", key: "code", width: 12 },
    { header: "اسم الطالب", key: "name", width: 34 },
    { header: "السنة الدراسية", key: "year", width: 16 },
    { header: "التخصص", key: "dept", width: 18 },
    { header: "المحاضرات المحتسبة", key: "eligible", width: 14 },
    { header: "الحضور", key: "attended", width: 10 },
    { header: "بعذر", key: "excused", width: 10 },
    { header: "الغياب", key: "absences", width: 10 },
    { header: "نسبة الحضور %", key: "pct", width: 14 },
  ];
  header(ws.getRow(1));
  for (const row of r.allRows) {
    ws.addRow({
      code: row.code,
      name: row.fullName,
      year: n(row.academicYear),
      dept: n(row.department),
      eligible: row.eligible,
      attended: row.attended,
      excused: row.excused,
      absences: row.absences,
      pct: row.percentage ?? "—",
    });
  }
  ws.addRow({});
  ws.addRow({ name: `المادة: ${r.subject.name} (${r.subject.code}) — المحاضرات المغلقة: ${r.closedCount} — تاريخ التصدير: ${formatDateTime(new Date())}` });
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), fileName: `report-${r.subject.code}.xlsx` };
}

export async function exportSubjectMatrix(actor: Actor, subjectId: string, f: ReportFilters) {
  const m = await subjectMatrix(actor, subjectId, { ...f, pageSize: -1 });
  const wb = new ExcelJS.Workbook();
  const ws = sheet(wb, "مصفوفة الحضور");
  ws.columns = [
    { header: "الكود", key: "code", width: 11 },
    { header: "الاسم", key: "name", width: 30 },
    ...m.lectures.map((l, i) => ({ header: `${formatShortDate(l.startsAt)}\n${l.title}`, key: "l" + i, width: 12 })),
    { header: "حضور", key: "att", width: 8 },
    { header: "غياب", key: "abs", width: 8 },
    { header: "%", key: "pct", width: 8 },
  ];
  header(ws.getRow(1));
  ws.getRow(1).height = 40;
  const sym: Record<MatrixCell, string> = { present: "✓", absent: "✗", excused: "ع", na: "—", pending: "" };
  for (const r of m.rows) {
    const row: Record<string, unknown> = { code: r.code, name: r.fullName, att: r.attended, abs: r.absences, pct: r.percentage ?? "—" };
    r.cells.forEach((c, i) => (row["l" + i] = sym[c]));
    const added = ws.addRow(row);
    r.cells.forEach((c, i) => {
      const cell = added.getCell(3 + i);
      cell.alignment = { horizontal: "center" };
      if (c === "present") cell.font = { color: { argb: "FF15803D" }, bold: true };
      if (c === "absent") cell.font = { color: { argb: "FFDC2626" }, bold: true };
    });
  }
  ws.addRow({});
  ws.addRow({ name: "✓ حاضر   ✗ غائب   ع بعذر   — غير محتسبة" });
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), fileName: `matrix-${m.subject.code}.xlsx` };
}

export async function exportLecture(actor: Actor, lectureId: string) {
  const sheetData = await lectureSheet(actor, lectureId, { pageSize: 200, page: 1 });
  const all = [...sheetData.items];
  for (let p = 2; (p - 1) * 200 < sheetData.total; p++) all.push(...(await lectureSheet(actor, lectureId, { pageSize: 200, page: p })).items);
  const wb = new ExcelJS.Workbook();
  const ws = sheet(wb, "كشف الحضور");
  ws.columns = [
    { header: "الكود", key: "code", width: 12 },
    { header: "الاسم", key: "name", width: 34 },
    { header: "الحالة", key: "status", width: 12 },
    { header: "طريقة التسجيل", key: "source", width: 16 },
    { header: "وقت التسجيل", key: "time", width: 14 },
    { header: "المسافة (م)", key: "dist", width: 12 },
  ];
  header(ws.getRow(1));
  const closed = sheetData.status === "closed";
  for (const it of all) {
    ws.addRow({
      code: it.student.code,
      name: it.student.fullName,
      status: it.record ? RECORD_STATUS_LABELS[it.record.status] : closed ? "غائب" : "لم يسجل",
      source: it.record ? RECORD_SOURCE_LABELS[it.record.source] : "",
      time: it.record ? formatTime(it.record.markedAt) : "",
      dist: it.record?.distanceM ?? "",
    });
  }
  ws.addRow({});
  ws.addRow({ name: `${sheetData.subject.name} — ${sheetData.lecture.title} — ${formatDateTime(sheetData.lecture.startsAt)}` });
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), fileName: `lecture-${String(sheetData.lecture._id).slice(-6)}.xlsx` };
}

export async function exportStudents(actor: Actor, filter: Record<string, unknown>) {
  const n = await names();
  const wb = new ExcelJS.Workbook();
  const ws = sheet(wb, "الطلاب");
  ws.columns = [
    { header: "الكود", key: "code", width: 12 },
    { header: "الاسم", key: "name", width: 34 },
    { header: "السنة الدراسية", key: "year", width: 16 },
    { header: "التخصص", key: "dept", width: 18 },
    { header: "الشعبة", key: "sec", width: 10 },
    { header: "رقم القيد", key: "reg", width: 14 },
    { header: "الحالة", key: "status", width: 10 },
  ];
  header(ws.getRow(1));
  const cursor = Student.find({ $and: [filter, studentScopeFilter(actor)] }).sort({ seq: 1 }).lean().cursor({ batchSize: 1000 });
  for await (const s of cursor) {
    ws.addRow({
      code: s.code,
      name: s.fullName,
      year: n(String(s.academicYear)),
      dept: n(String(s.department)),
      sec: n(s.section ? String(s.section) : null),
      reg: s.registrationNumber ?? "",
      status: s.status === "active" ? "نشط" : "مؤرشف",
    });
  }
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), fileName: "students.xlsx" };
}

