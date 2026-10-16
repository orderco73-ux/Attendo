import { z } from "zod";
import { cache } from "react";
import type { Types } from "mongoose";
import { AcademicYear, College, Department, Section, type IAcademicYear, type IDepartment } from "@/server/db/models";
import { SPECIALIZATION_POLICIES } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import { assertAdmin } from "@/server/authz/policy";
import { AppError, invalid } from "@/server/errors";
import { oid, optionalOid } from "@/server/ids";
import { audit } from "./audit";

/* ---------------- Schemas ---------------- */
const id = z.string().regex(/^[a-f0-9]{24}$/i, "اختيار غير صالح");

export const collegeSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير").max(150),
  code: z.string().trim().min(1, "أدخل الرمز").max(20).regex(/^[A-Za-z0-9_-]+$/, "حروف لاتينية وأرقام فقط"),
  active: z.boolean().default(true),
});

export const yearSchema = z.object({
  college: id,
  name: z.string().trim().min(2, "الاسم قصير").max(80),
  level: z.coerce.number().int().min(1).max(12),
  specializationPolicy: z.enum(SPECIALIZATION_POLICIES),
  active: z.boolean().default(true),
});

export const departmentSchema = z.object({
  college: id,
  name: z.string().trim().min(2, "الاسم قصير").max(120),
  code: z.string().trim().min(1, "أدخل الرمز").max(20).regex(/^[A-Za-z0-9_-]+$/, "حروف لاتينية وأرقام فقط"),
  isGeneral: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const sectionSchema = z.object({
  academicYear: id,
  department: id.optional().or(z.literal("")),
  name: z.string().trim().min(1, "أدخل الاسم").max(60),
  active: z.boolean().default(true),
});

/* ---------------- Reads (small reference data, cached per request) ---------------- */
export interface StructureItem {
  id: string;
  name: string;
  active: boolean;
}
export interface Structure {
  colleges: (StructureItem & { code: string })[];
  years: (StructureItem & { college: string; level: number; specializationPolicy: IAcademicYear["specializationPolicy"] })[];
  departments: (StructureItem & { college: string; code: string; isGeneral: boolean })[];
  sections: (StructureItem & { college: string; academicYear: string; department: string | null })[];
}

export const getStructure = cache(async (): Promise<Structure> => {
  const [colleges, years, departments, sections] = await Promise.all([
    College.find().sort({ name: 1 }).lean(),
    AcademicYear.find().sort({ level: 1 }).lean(),
    Department.find().sort({ isGeneral: -1, name: 1 }).lean(),
    Section.find().sort({ name: 1 }).lean(),
  ]);
  return {
    colleges: colleges.map((c) => ({ id: String(c._id), name: c.name, code: c.code, active: c.active })),
    years: years.map((y) => ({
      id: String(y._id),
      name: y.name,
      active: y.active,
      college: String(y.college),
      level: y.level,
      specializationPolicy: y.specializationPolicy,
    })),
    departments: departments.map((d) => ({
      id: String(d._id),
      name: d.name,
      active: d.active,
      college: String(d.college),
      code: d.code,
      isGeneral: d.isGeneral,
    })),
    sections: sections.map((s) => ({
      id: String(s._id),
      name: s.name,
      active: s.active,
      college: String(s.college),
      academicYear: String(s.academicYear),
      department: s.department ? String(s.department) : null,
    })),
  };
});

/* ---------------- Business rule: placement ---------------- */

/** Pure rule: may a student in `year` be placed in `dept`? */
export function departmentAllowedForYear(
  year: Pick<IAcademicYear, "specializationPolicy">,
  dept: Pick<IDepartment, "isGeneral">,
): boolean {
  if (year.specializationPolicy === "general_only") return dept.isGeneral;
  if (year.specializationPolicy === "specialized") return !dept.isGeneral;
  return true;
}

export interface PlacementInput {
  academicYear: string;
  department?: string | null;
  section?: string | null;
}

/**
 * Validates and resolves a student's academic placement. The college is derived from the academic year.
 * For `general_only` years the department is forced to the college's general department.
 */
export async function resolvePlacement(input: PlacementInput): Promise<{
  college: Types.ObjectId;
  academicYear: Types.ObjectId;
  department: Types.ObjectId;
  section: Types.ObjectId | null;
}> {
  const year = await AcademicYear.findById(oid(input.academicYear)).lean();
  if (!year || !year.active) throw invalid("السنة الدراسية غير صالحة", { academicYear: "السنة الدراسية غير صالحة" });

  let dept: IDepartment | null;
  if (year.specializationPolicy === "general_only") {
    dept = await Department.findOne({ college: year.college, isGeneral: true, active: true }).lean();
    if (!dept) throw invalid("لم يتم إعداد قسم \"بدون تخصص\" لهذه الكلية", { department: "قسم بدون تخصص غير متوفر" });
  } else {
    if (!input.department) throw invalid("اختر التخصص", { department: "التخصص مطلوب لهذه السنة" });
    dept = await Department.findById(oid(input.department)).lean();
    if (!dept || !dept.active || String(dept.college) !== String(year.college))
      throw invalid("التخصص غير صالح", { department: "التخصص غير صالح" });
    if (!departmentAllowedForYear(year, dept))
      throw invalid("هذا التخصص غير مسموح لهذه السنة الدراسية", { department: "غير مسموح لهذه السنة" });
  }

  let section: Types.ObjectId | null = null;
  const sectionId = optionalOid(input.section);
  if (sectionId) {
    const sec = await Section.findById(sectionId).lean();
    if (
      !sec ||
      !sec.active ||
      String(sec.academicYear) !== String(year._id) ||
      (sec.department && String(sec.department) !== String(dept._id))
    )
      throw invalid("الشعبة غير صالحة", { section: "الشعبة لا تتبع السنة/التخصص المختار" });
    section = sec._id;
  }
  return { college: year.college, academicYear: year._id, department: dept._id, section };
}

/* ---------------- Mutations (admin only) ---------------- */

export async function saveCollege(actor: Actor, input: unknown, id?: string) {
  assertAdmin(actor);
  const data = collegeSchema.parse(input);
  const doc = id
    ? await College.findByIdAndUpdate(oid(id), { $set: data }, { returnDocument: "after", runValidators: true })
    : await College.create(data);
  if (!doc) throw new AppError("NOT_FOUND");
  await audit(actor, { action: id ? "structure.update" : "structure.create", summary: `كلية: ${doc.name}`, entityType: "college", entityId: doc._id });
  return String(doc._id);
}

export async function saveYear(actor: Actor, input: unknown, id?: string) {
  assertAdmin(actor);
  const data = yearSchema.parse(input);
  if (!(await College.exists({ _id: oid(data.college) }))) throw invalid("الكلية غير موجودة");
  const doc = id
    ? await AcademicYear.findByIdAndUpdate(oid(id), { $set: data }, { returnDocument: "after", runValidators: true })
    : await AcademicYear.create(data);
  if (!doc) throw new AppError("NOT_FOUND");
  await audit(actor, { action: id ? "structure.update" : "structure.create", summary: `سنة دراسية: ${doc.name}`, entityType: "academicYear", entityId: doc._id });
  return String(doc._id);
}

export async function saveDepartment(actor: Actor, input: unknown, id?: string) {
  assertAdmin(actor);
  const data = departmentSchema.parse(input);
  if (!(await College.exists({ _id: oid(data.college) }))) throw invalid("الكلية غير موجودة");
  const doc = id
    ? await Department.findByIdAndUpdate(oid(id), { $set: data }, { returnDocument: "after", runValidators: true })
    : await Department.create(data);
  if (!doc) throw new AppError("NOT_FOUND");
  await audit(actor, { action: id ? "structure.update" : "structure.create", summary: `قسم/تخصص: ${doc.name}`, entityType: "department", entityId: doc._id });
  return String(doc._id);
}

export async function saveSection(actor: Actor, input: unknown, id?: string) {
  assertAdmin(actor);
  const data = sectionSchema.parse(input);
  const year = await AcademicYear.findById(oid(data.academicYear)).lean();
  if (!year) throw invalid("السنة غير موجودة");
  const department = data.department ? oid(data.department) : null;
  if (department) {
    const d = await Department.findById(department).lean();
    if (!d || String(d.college) !== String(year.college)) throw invalid("القسم لا يتبع نفس الكلية");
  }
  const payload = { college: year.college, academicYear: year._id, department, name: data.name, active: data.active };
  const doc = id
    ? await Section.findByIdAndUpdate(oid(id), { $set: payload }, { returnDocument: "after", runValidators: true })
    : await Section.create(payload);
  if (!doc) throw new AppError("NOT_FOUND");
  await audit(actor, { action: id ? "structure.update" : "structure.create", summary: `شعبة: ${doc.name}`, entityType: "section", entityId: doc._id });
  return String(doc._id);
}

/* ---------------- Initial configuration (used by seed script) ---------------- */
export async function ensureInitialStructure() {
  const college = await College.findOneAndUpdate(
    { code: "PE" },
    { $setOnInsert: { name: "كلية التربية الرياضية / علوم الرياضة", code: "PE", active: true } },
    { upsert: true, returnDocument: "after" },
  );
  const years = [
    { level: 1, name: "الفرقة الأولى", specializationPolicy: "general_only" },
    { level: 2, name: "الفرقة الثانية", specializationPolicy: "general_only" },
    { level: 3, name: "الفرقة الثالثة", specializationPolicy: "specialized" },
    { level: 4, name: "الفرقة الرابعة", specializationPolicy: "specialized" },
  ] as const;
  for (const y of years) {
    await AcademicYear.updateOne({ college: college._id, level: y.level }, { $setOnInsert: { ...y, college: college._id, active: true } }, { upsert: true });
  }
  const depts = [
    { code: "GEN", name: "بدون تخصص", isGeneral: true },
    { code: "TRN", name: "التدريب الرياضي", isGeneral: false },
    { code: "TCH", name: "التدريس", isGeneral: false },
    { code: "ADM", name: "الإدارة الرياضية", isGeneral: false },
  ];
  for (const d of depts) {
    await Department.updateOne({ college: college._id, code: d.code }, { $setOnInsert: { ...d, college: college._id, active: true } }, { upsert: true });
  }
  return college;
}
