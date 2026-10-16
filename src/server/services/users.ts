import { z } from "zod";
import { User, College, AcademicYear, Department, Section } from "@/server/db/models";
import { PERMISSIONS, STAFF_KINDS, PAGE_SIZE, type Role } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import { assertAdmin } from "@/server/authz/policy";
import { hashPassword } from "@/server/auth/password";
import { AppError, invalid, isDuplicateKeyError } from "@/server/errors";
import { oid, oids } from "@/server/ids";
import { escapeRegex } from "@/lib/arabic";
import { audit } from "./audit";

const idStr = z.string().regex(/^[a-f0-9]{24}$/i);

export const baseUserSchema = z.object({
  name: z.string().trim().min(3, "الاسم قصير").max(120),
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح").max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  password: z.string().max(200).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const staffSchema = baseUserSchema.extend({
  kind: z.enum(STAFF_KINDS),
  title: z.string().trim().max(80).optional().or(z.literal("")),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
  scope: z.object({
    college: idStr,
    academicYears: z.array(idStr).default([]),
    departments: z.array(idStr).default([]),
    sections: z.array(idStr).default([]),
  }),
});

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  staff: null | {
    kind: string;
    title?: string;
    permissions: string[];
    scope: { college: string | null; academicYears: string[]; departments: string[]; sections: string[] };
  };
}

export async function listUsers(actor: Actor, params: { role: Role; q?: string; page?: number; status?: string }) {
  assertAdmin(actor);
  const filter: Record<string, unknown> = { role: params.role };
  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q.trim()), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (params.status === "active") filter.active = true;
  if (params.status === "inactive") filter.active = false;
  const page = Math.max(1, params.page ?? 1);
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    User.countDocuments(filter),
  ]);
  return {
    total,
    page,
    pageSize: PAGE_SIZE,
    items: items.map<UserListItem>((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      active: u.active,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      staff: u.staff
        ? {
            kind: u.staff.kind,
            title: u.staff.title,
            permissions: u.staff.permissions,
            scope: {
              college: u.staff.scope?.college ? String(u.staff.scope.college) : null,
              academicYears: (u.staff.scope?.academicYears ?? []).map(String),
              departments: (u.staff.scope?.departments ?? []).map(String),
              sections: (u.staff.scope?.sections ?? []).map(String),
            },
          }
        : null,
    })),
  };
}

/** Minimal list used in pickers (e.g. assigning doctors to subjects). */
export async function listUserOptions(actor: Actor, role: Role) {
  if (actor.role !== "admin" && !(role === "staff" && actor.role === "doctor")) throw new AppError("FORBIDDEN");
  const users = await User.find({ role, active: true }).select("name email").sort({ name: 1 }).limit(1000).lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, email: u.email }));
}

async function validateScope(scope: z.infer<typeof staffSchema>["scope"]) {
  const college = oid(scope.college);
  if (!(await College.exists({ _id: college }))) throw invalid("الكلية غير موجودة", { "scope.college": "الكلية غير موجودة" });
  const [y, d, s] = await Promise.all([
    AcademicYear.countDocuments({ _id: { $in: oids(scope.academicYears) }, college }),
    Department.countDocuments({ _id: { $in: oids(scope.departments) }, college }),
    Section.countDocuments({ _id: { $in: oids(scope.sections) }, college }),
  ]);
  if (y !== scope.academicYears.length || d !== scope.departments.length || s !== scope.sections.length)
    throw invalid("نطاق الصلاحية يحتوي على عناصر لا تتبع الكلية المختارة");
  return {
    college,
    academicYears: oids(scope.academicYears),
    departments: oids(scope.departments),
    sections: oids(scope.sections),
  };
}

function requirePassword(pw: string | undefined, isNew: boolean) {
  if (isNew && (!pw || pw.length < 8)) throw invalid("كلمة المرور مطلوبة (8 أحرف على الأقل)", { password: "8 أحرف على الأقل" });
  if (!isNew && pw && pw.length < 8) throw invalid("كلمة المرور 8 أحرف على الأقل", { password: "8 أحرف على الأقل" });
}

/** Create/update a doctor or admin account. */
export async function saveAccount(actor: Actor, role: "doctor" | "admin", input: unknown, id?: string) {
  assertAdmin(actor);
  const data = baseUserSchema.parse(input);
  requirePassword(data.password || undefined, !id);
  try {
    if (!id) {
      const user = await User.create({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        role,
        active: data.active,
        passwordHash: await hashPassword(data.password!),
      });
      await audit(actor, { action: "user.create", summary: `إنشاء حساب ${role === "doctor" ? "دكتور" : "مدير"}: ${user.name}`, entityType: "user", entityId: user._id });
      return String(user._id);
    }
    const user = await User.findOne({ _id: oid(id), role });
    if (!user) throw new AppError("NOT_FOUND");
    if (String(user._id) === actor.id && !data.active) throw invalid("لا يمكنك تعطيل حسابك");
    const wasActive = user.active;
    user.name = data.name;
    user.email = data.email;
    user.phone = data.phone || undefined;
    user.active = data.active;
    if (data.password) {
      user.passwordHash = await hashPassword(data.password);
      user.sessionVersion += 1;
    } else if (wasActive && !data.active) {
      user.sessionVersion += 1;
    }
    await user.save();
    await audit(actor, { action: "user.update", summary: `تعديل حساب: ${user.name}`, entityType: "user", entityId: user._id, meta: { passwordReset: !!data.password, active: data.active } });
    return String(user._id);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw invalid("البريد الإلكتروني مستخدم بالفعل", { email: "مستخدم بالفعل" });
    throw err;
  }
}

export async function saveStaff(actor: Actor, input: unknown, id?: string) {
  assertAdmin(actor);
  const data = staffSchema.parse(input);
  requirePassword(data.password || undefined, !id);
  const scope = await validateScope(data.scope);
  const staff = { kind: data.kind, title: data.title || undefined, permissions: [...new Set(data.permissions)], scope };
  try {
    if (!id) {
      const user = await User.create({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        role: "staff",
        active: data.active,
        staff,
        passwordHash: await hashPassword(data.password!),
      });
      await audit(actor, { action: "user.create", summary: `إنشاء عضو طاقم: ${user.name}`, entityType: "user", entityId: user._id, meta: { permissions: staff.permissions } });
      return String(user._id);
    }
    const user = await User.findOne({ _id: oid(id), role: "staff" });
    if (!user) throw new AppError("NOT_FOUND");
    const before = { permissions: user.staff?.permissions ?? [], active: user.active };
    user.name = data.name;
    user.email = data.email;
    user.phone = data.phone || undefined;
    user.staff = staff;
    if (data.password) {
      user.passwordHash = await hashPassword(data.password);
      user.sessionVersion += 1;
    } else if (before.active && !data.active) {
      user.sessionVersion += 1;
    }
    user.active = data.active;
    await user.save();
    await audit(actor, {
      action: "staff.permissions",
      summary: `تحديث عضو الطاقم وصلاحياته: ${user.name}`,
      entityType: "user",
      entityId: user._id,
      meta: { before, after: { permissions: staff.permissions, active: data.active } },
    });
    return String(user._id);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw invalid("البريد الإلكتروني مستخدم بالفعل", { email: "مستخدم بالفعل" });
    throw err;
  }
}

export async function setUserActive(actor: Actor, id: string, active: boolean) {
  assertAdmin(actor);
  if (id === actor.id) throw invalid("لا يمكنك تعطيل حسابك");
  const user = await User.findOneAndUpdate(
    { _id: oid(id) },
    active ? { $set: { active } } : { $set: { active }, $inc: { sessionVersion: 1 } },
    { returnDocument: "after" },
  );
  if (!user) throw new AppError("NOT_FOUND");
  await audit(actor, { action: "user.status", summary: `${active ? "تفعيل" : "تعطيل"} حساب: ${user.name}`, entityType: "user", entityId: user._id });
}
