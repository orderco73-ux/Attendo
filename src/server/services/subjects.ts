import { z } from "zod";
import type { Types } from "mongoose";
import { Subject, User, Enrollment, College, AcademicYear, Department, Section, type ISubject } from "@/server/db/models";
import { PAGE_SIZE } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import {
  assertAdmin,
  canManageSubject,
  canMarkInSubject,
  canViewSubject,
  canViewSubjectReports,
  hasPermission,
  isAdmin,
  isSubjectDoctor,
  subjectInStaffScope,
  visibleSubjectsFilter,
} from "@/server/authz/policy";
import { AppError, invalid, isDuplicateKeyError } from "@/server/errors";
import { oid, oids } from "@/server/ids";
import { escapeRegex } from "@/lib/arabic";
import { audit } from "./audit";
import { getSettings } from "./settings";

const idStr = z.string().regex(/^[a-f0-9]{24}$/i);

export const subjectSchema = z.object({
  name: z.string().trim().min(2, "أدخل اسم المادة").max(150),
  code: z.string().trim().min(2, "أدخل كود المادة").max(30).regex(/^[A-Za-z0-9_-]+$/, "حروف لاتينية وأرقام فقط"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  college: idStr,
  academicYears: z.array(idStr).default([]),
  departments: z.array(idStr).default([]),
  sections: z.array(idStr).default([]),
  doctors: z.array(idStr).default([]),
  requiresEnrollmentApproval: z.boolean().default(true),
  active: z.boolean().default(true),
});

export type SubjectAccess = "view" | "manage" | "mark" | "reports";

/** Fetches a subject and enforces the requested access level. Non-visible subjects look "not found". */
export async function getSubjectFor(actor: Actor, subjectId: string, access: SubjectAccess = "view") {
  const subject = await Subject.findById(oid(subjectId)).lean();
  if (!subject) throw new AppError("NOT_FOUND");
  if (!canViewSubject(actor, subject) && !(access === "mark" && canMarkInSubject(actor, subject))) throw new AppError("NOT_FOUND");
  const ok =
    access === "view" ||
    (access === "manage" && canManageSubject(actor, subject)) ||
    (access === "mark" && canMarkInSubject(actor, subject)) ||
    (access === "reports" && canViewSubjectReports(actor, subject));
  if (!ok) throw new AppError("FORBIDDEN");
  return subject;
}

/** Student filter describing the subject's eligible population. */
export function eligibilityFilter(subject: Pick<ISubject, "college" | "eligibility">): Record<string, unknown> {
  const f: Record<string, unknown> = { college: subject.college, status: "active" };
  if (subject.eligibility?.academicYears?.length) f.academicYear = { $in: subject.eligibility.academicYears };
  if (subject.eligibility?.departments?.length) f.department = { $in: subject.eligibility.departments };
  if (subject.eligibility?.sections?.length) f.section = { $in: subject.eligibility.sections };
  return f;
}

export function isEligible(
  subject: Pick<ISubject, "college" | "eligibility">,
  st: { college: Types.ObjectId; academicYear: Types.ObjectId; department: Types.ObjectId; section?: Types.ObjectId | null; status: string },
) {
  if (st.status !== "active" || String(st.college) !== String(subject.college)) return false;
  const el = subject.eligibility;
  const inList = (list: Types.ObjectId[] | undefined, v: Types.ObjectId | null | undefined) =>
    !list?.length || (v != null && list.some((x) => String(x) === String(v)));
  return inList(el?.academicYears, st.academicYear) && inList(el?.departments, st.department) && inList(el?.sections, st.section);
}

export interface SubjectListItem {
  id: string;
  name: string;
  code: string;
  active: boolean;
  college: string;
  doctors: { id: string; name: string }[];
  eligibility: { academicYears: string[]; departments: string[]; sections: string[] };
  enrolled: number;
  pending: number;
  requiresEnrollmentApproval: boolean;
  description?: string;
  canManage: boolean;
}

export async function listSubjects(actor: Actor, params: { q?: string; page?: number; status?: string; pageSize?: number } = {}) {
  const filter: Record<string, unknown> = { $and: [visibleSubjectsFilter(actor)] };
  const and = filter.$and as Record<string, unknown>[];
  if (params.q?.trim()) {
    const rx = new RegExp(escapeRegex(params.q.trim()), "i");
    and.push({ $or: [{ name: rx }, { code: rx }] });
  }
  if (params.status === "inactive") and.push({ active: false });
  else if (params.status !== "all") and.push({ active: true });
  const pageSize = Math.min(200, params.pageSize ?? PAGE_SIZE);
  const page = Math.max(1, params.page ?? 1);
  const [subjects, total] = await Promise.all([
    Subject.find(filter).sort({ name: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Subject.countDocuments(filter),
  ]);
  const ids = subjects.map((s) => s._id);
  const [counts, doctorDocs] = await Promise.all([
    Enrollment.aggregate<{ _id: { subject: Types.ObjectId; status: string }; n: number }>([
      { $match: { subject: { $in: ids }, status: { $in: ["approved", "pending"] } } },
      { $group: { _id: { subject: "$subject", status: "$status" }, n: { $sum: 1 } } },
    ]),
    User.find({ _id: { $in: subjects.flatMap((s) => s.doctors) } }).select("name").lean(),
  ]);
  const docName = new Map(doctorDocs.map((d) => [String(d._id), d.name]));
  const count = (sid: Types.ObjectId, st: string) => counts.find((c) => String(c._id.subject) === String(sid) && c._id.status === st)?.n ?? 0;
  return {
    total,
    page,
    pageSize,
    items: subjects.map<SubjectListItem>((s) => ({
      id: String(s._id),
      name: s.name,
      code: s.code,
      active: s.active,
      college: String(s.college),
      description: s.description,
      doctors: s.doctors.map((d) => ({ id: String(d), name: docName.get(String(d)) ?? "—" })),
      eligibility: {
        academicYears: s.eligibility.academicYears.map(String),
        departments: s.eligibility.departments.map(String),
        sections: s.eligibility.sections.map(String),
      },
      enrolled: count(s._id, "approved"),
      pending: count(s._id, "pending"),
      requiresEnrollmentApproval: s.requiresEnrollmentApproval,
      canManage: canManageSubject(actor, s),
    })),
  };
}

export async function saveSubject(actor: Actor, input: unknown, id?: string) {
  assertAdmin(actor);
  const data = subjectSchema.parse(input);
  const college = oid(data.college);
  if (!(await College.exists({ _id: college }))) throw invalid("الكلية غير موجودة");
  const [y, d, s, docs] = await Promise.all([
    AcademicYear.countDocuments({ _id: { $in: oids(data.academicYears) }, college }),
    Department.countDocuments({ _id: { $in: oids(data.departments) }, college }),
    Section.countDocuments({ _id: { $in: oids(data.sections) }, college }),
    User.countDocuments({ _id: { $in: oids(data.doctors) }, role: "doctor" }),
  ]);
  if (y !== data.academicYears.length || d !== data.departments.length || s !== data.sections.length)
    throw invalid("شروط الأهلية تحتوي على عناصر لا تتبع الكلية");
  if (docs !== data.doctors.length) throw invalid("أحد الدكاترة المختارين غير صالح");

  const payload = {
    name: data.name,
    code: data.code.toUpperCase(),
    description: data.description || undefined,
    college,
    eligibility: { academicYears: oids(data.academicYears), departments: oids(data.departments), sections: oids(data.sections) },
    doctors: oids([...new Set(data.doctors)]),
    requiresEnrollmentApproval: data.requiresEnrollmentApproval,
    active: data.active,
  };
  try {
    const doc = id
      ? await Subject.findByIdAndUpdate(oid(id), { $set: payload }, { returnDocument: "after", runValidators: true })
      : await Subject.create(payload);
    if (!doc) throw new AppError("NOT_FOUND");
    await audit(actor, {
      action: id ? "subject.update" : "subject.create",
      summary: `${id ? "تعديل" : "إنشاء"} مادة ${doc.code} - ${doc.name}`,
      entityType: "subject",
      entityId: doc._id,
      meta: { doctors: data.doctors },
    });
    return String(doc._id);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw invalid("كود المادة مستخدم بالفعل", { code: "مستخدم بالفعل" });
    throw err;
  }
}

/** Subject assistants: staff members helping the doctor (attendance marking in open sessions). */
export async function setSubjectAssistants(actor: Actor, subjectId: string, userIds: string[]) {
  const subject = await getSubjectFor(actor, subjectId, "manage");
  if (!isAdmin(actor)) {
    const settings = await getSettings();
    if (!settings.doctorsCanManageAssistants || !isSubjectDoctor(actor, subject)) throw new AppError("FORBIDDEN");
  }
  const ids = oids(userIds);
  const valid = await User.countDocuments({ _id: { $in: ids }, role: "staff", active: true });
  if (valid !== ids.length) throw invalid("يمكن اختيار أعضاء الطاقم النشطين فقط");
  await Subject.updateOne({ _id: subject._id }, { $set: { assistants: ids } });
  await audit(actor, { action: "subject.update", summary: `تحديث مساعدي المادة ${subject.code}`, entityType: "subject", entityId: subject._id, meta: { assistants: userIds } });
}

export async function subjectAssistants(subject: Pick<ISubject, "assistants">) {
  const users = await User.find({ _id: { $in: subject.assistants ?? [] } }).select("name email").lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, email: u.email }));
}

export function subjectCapabilities(actor: Actor, subject: ISubject) {
  return {
    manage: canManageSubject(actor, subject),
    mark: canMarkInSubject(actor, subject),
    reports: canViewSubjectReports(actor, subject),
    requestEnrollment: canManageSubject(actor, subject) || (hasPermission(actor, "enrollment.request") && subjectInStaffScope(actor, subject)),
  };
}
