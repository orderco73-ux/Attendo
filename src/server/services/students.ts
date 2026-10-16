import { z } from "zod";
import type { Types } from "mongoose";
import { Counter, Student, AttendanceRecord, Enrollment, type IStudent } from "@/server/db/models";
import { PAGE_SIZE, type StudentStatus } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import { assertPermission, studentInScope, studentScopeFilter } from "@/server/authz/policy";
import { AppError, isDuplicateKeyError } from "@/server/errors";
import { oid, optionalOid } from "@/server/ids";
import { cleanName, escapeRegex, normalizeArabic } from "@/lib/arabic";
import { formatStudentCode, normalizeStudentCode } from "@/lib/codes";
import { resolvePlacement } from "./academic";
import { audit } from "./audit";

const idStr = z.string().regex(/^[a-f0-9]{24}$/i, "اختيار غير صالح");

export const studentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(5, "أدخل الاسم الكامل")
    .max(150)
    .refine((v) => cleanName(v).split(" ").length >= 2, "أدخل الاسم ثنائيًا على الأقل"),
  registrationNumber: z.string().trim().max(40).optional().or(z.literal("")),
  academicYear: idStr,
  department: idStr.optional().or(z.literal("")),
  section: idStr.optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  allowSameName: z.boolean().optional(),
});
export type StudentInput = z.infer<typeof studentSchema>;

/* ---------------- Codes ---------------- */

/** Atomically reserves `count` consecutive sequence numbers; returns the first one. Never reused. */
export async function reserveStudentSeqs(count: number): Promise<number> {
  if (count < 1) throw new Error("count must be >= 1");
  const doc = await Counter.findOneAndUpdate({ _id: "student" }, { $inc: { seq: count } }, { upsert: true, returnDocument: "after" }).lean();
  return doc!.seq - count + 1;
}

export function normalizeRegNo(v: string) {
  return normalizeArabic(v).replace(/[\s-]/g, "").toUpperCase();
}

/** See docs/DATABASE.md — duplicate matching strategy. */
export function dedupeKeyFor(college: string | Types.ObjectId, fullName: string, registrationNumber?: string | null): string {
  if (registrationNumber && registrationNumber.trim()) return `reg:${String(college)}:${normalizeRegNo(registrationNumber)}`;
  return `name:${String(college)}:${normalizeArabic(fullName)}`;
}

/* ---------------- Reads ---------------- */

export interface StudentRow {
  id: string;
  code: string;
  fullName: string;
  registrationNumber: string | null;
  college: string;
  academicYear: string;
  department: string;
  section: string | null;
  status: StudentStatus;
  notes?: string;
  createdAt: string;
}

export function toStudentRow(s: IStudent): StudentRow {
  return {
    id: String(s._id),
    code: s.code,
    fullName: s.fullName,
    registrationNumber: s.registrationNumber ?? null,
    college: String(s.college),
    academicYear: String(s.academicYear),
    department: String(s.department),
    section: s.section ? String(s.section) : null,
    status: s.status,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}

export interface StudentQuery {
  q?: string;
  academicYear?: string;
  department?: string;
  section?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/** Builds the Mongo filter for a free-text + facet student search. */
export function buildStudentFilter(params: StudentQuery): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  const q = params.q?.trim();
  if (q) {
    const code = normalizeStudentCode(q);
    if (code) f.code = code;
    else if (/^ST\d*$/i.test(q)) f.code = { $regex: "^" + escapeRegex(q.toUpperCase()) };
    else {
      const key = normalizeArabic(q);
      f.$or = [{ nameKey: { $regex: escapeRegex(key) } }, { registrationNumber: q }];
    }
  }
  const y = optionalOid(params.academicYear || null);
  const d = optionalOid(params.department || null);
  const s = optionalOid(params.section || null);
  if (y) f.academicYear = y;
  if (d) f.department = d;
  if (s) f.section = s;
  if (params.status === "archived") f.status = "archived";
  else if (params.status !== "all") f.status = "active";
  return f;
}

export async function listStudents(actor: Actor, params: StudentQuery) {
  assertPermission(actor, "students.view");
  const filter = { $and: [buildStudentFilter(params), studentScopeFilter(actor)] };
  const pageSize = Math.min(100, params.pageSize ?? PAGE_SIZE);
  const page = Math.max(1, params.page ?? 1);
  const [items, total] = await Promise.all([
    Student.find(filter).sort({ seq: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Student.countDocuments(filter),
  ]);
  return { items: items.map(toStudentRow), total, page, pageSize };
}

export async function getStudent(actor: Actor, id: string) {
  assertPermission(actor, "students.view");
  const s = await Student.findById(oid(id)).lean();
  if (!s || !studentInScope(actor, s)) throw new AppError("NOT_FOUND");
  return s;
}

/* ---------------- Mutations ---------------- */

export async function createStudent(actor: Actor, input: unknown) {
  assertPermission(actor, "students.create");
  const data = studentSchema.parse(input);
  const placement = await resolvePlacement(data);
  if (!studentInScope(actor, placement)) throw new AppError("FORBIDDEN", "لا يمكنك إضافة طالب خارج نطاق صلاحياتك");

  const fullName = cleanName(data.fullName);
  const regNo = data.registrationNumber?.trim() || null;
  const key = dedupeKeyFor(placement.college, fullName, regNo);
  const existing = await Student.findOne({ dedupeKey: key }).select("code fullName").lean();
  if (existing && (regNo || !data.allowSameName)) {
    throw new AppError(
      "CONFLICT",
      regNo
        ? `رقم القيد مسجل بالفعل للطالب ${existing.code}`
        : `يوجد طالب بنفس الاسم (${existing.code}). إذا كان طالبًا مختلفًا فعّل خيار "طالب مختلف بنفس الاسم".`,
    );
  }
  // A confirmed same-name student is stored without a name-based key (registration numbers always keep theirs).
  const dedupeKey = existing && !regNo ? undefined : key;

  const seq = await reserveStudentSeqs(1);
  try {
    const st = await Student.create({
      code: formatStudentCode(seq),
      seq,
      fullName,
      nameKey: normalizeArabic(fullName),
      registrationNumber: regNo,
      ...placement,
      status: "active",
      dedupeKey,
      notes: data.notes || undefined,
      createdBy: actor.oid,
    });
    await audit(actor, { action: "student.create", summary: `إضافة الطالب ${st.code} - ${st.fullName}`, entityType: "student", entityId: st._id });
    return { id: String(st._id), code: st.code };
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError("CONFLICT", "تمت إضافة هذا الطالب بالفعل (طلب متزامن)");
    throw err;
  }
}

export async function updateStudent(actor: Actor, id: string, input: unknown) {
  assertPermission(actor, "students.edit");
  const data = studentSchema.parse(input);
  const st = await Student.findById(oid(id));
  if (!st || !studentInScope(actor, st)) throw new AppError("NOT_FOUND");
  const placement = await resolvePlacement(data);
  if (!studentInScope(actor, placement)) throw new AppError("FORBIDDEN", "لا يمكن نقل الطالب خارج نطاق صلاحياتك");

  const fullName = cleanName(data.fullName);
  const regNo = data.registrationNumber?.trim() || null;
  const before = { fullName: st.fullName, academicYear: String(st.academicYear), department: String(st.department), registrationNumber: st.registrationNumber };
  const newKey = dedupeKeyFor(placement.college, fullName, regNo);
  if (newKey !== st.dedupeKey) {
    const clash = await Student.findOne({ dedupeKey: newKey, _id: { $ne: st._id } }).select("code").lean();
    if (clash && (regNo || !data.allowSameName)) throw new AppError("CONFLICT", `البيانات تطابق الطالب ${clash.code}`);
    st.dedupeKey = clash ? undefined : newKey;
  }
  st.fullName = fullName;
  st.nameKey = normalizeArabic(fullName);
  st.registrationNumber = regNo;
  st.college = placement.college;
  st.academicYear = placement.academicYear;
  st.department = placement.department;
  st.section = placement.section;
  st.notes = data.notes || undefined;
  try {
    await st.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError("CONFLICT", "البيانات تطابق طالبًا آخر");
    throw err;
  }
  await audit(actor, {
    action: "student.update",
    summary: `تعديل بيانات الطالب ${st.code}`,
    entityType: "student",
    entityId: st._id,
    meta: { before, after: { fullName, academicYear: String(placement.academicYear), department: String(placement.department), registrationNumber: regNo } },
  });
  return { id: String(st._id), code: st.code };
}

export async function setStudentArchived(actor: Actor, id: string, archived: boolean) {
  assertPermission(actor, "students.archive");
  const st = await Student.findById(oid(id));
  if (!st || !studentInScope(actor, st)) throw new AppError("NOT_FOUND");
  st.status = archived ? "archived" : "active";
  st.archivedAt = archived ? new Date() : null;
  await st.save();
  await audit(actor, {
    action: archived ? "student.archive" : "student.restore",
    summary: `${archived ? "أرشفة" : "استعادة"} الطالب ${st.code}`,
    entityType: "student",
    entityId: st._id,
  });
}

/** Summary used on the student profile (staff side). */
export async function studentOverview(actor: Actor, id: string) {
  const st = await getStudent(actor, id);
  const [enrollments, records] = await Promise.all([
    Enrollment.find({ student: st._id }).populate<{ subject: { _id: Types.ObjectId; name: string; code: string } }>("subject", "name code").lean(),
    AttendanceRecord.countDocuments({ student: st._id, status: "present" }),
  ]);
  return { student: st, enrollments, presentCount: records };
}
