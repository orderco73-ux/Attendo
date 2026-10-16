import { AuditLog } from "@/server/db/models";
import type { Actor } from "@/server/auth/actor";

export interface AuditInput {
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string | { toString(): string };
  meta?: Record<string, unknown>;
  ip?: string;
}

/** Writes an audit entry. Never throws: auditing failures are logged but must not break the operation. */
export async function audit(actor: Actor | null, input: AuditInput) {
  try {
    await AuditLog.create({
      actor: actor?.oid ?? null,
      actorName: actor?.name ?? "النظام",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId != null ? String(input.entityId) : undefined,
      summary: input.summary.slice(0, 500),
      meta: input.meta,
      ip: input.ip,
    });
  } catch (err) {
    console.error("[attendo] audit write failed", err);
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "تسجيل دخول",
  "auth.login_failed": "محاولة دخول فاشلة",
  "auth.logout": "تسجيل خروج",
  "auth.password_changed": "تغيير كلمة المرور",
  "user.create": "إنشاء مستخدم",
  "user.update": "تعديل مستخدم",
  "user.status": "تفعيل/تعطيل مستخدم",
  "user.password_reset": "إعادة تعيين كلمة مرور",
  "staff.permissions": "تعديل صلاحيات",
  "structure.create": "إضافة هيكل أكاديمي",
  "structure.update": "تعديل هيكل أكاديمي",
  "subject.create": "إنشاء مادة",
  "subject.update": "تعديل مادة",
  "student.create": "إضافة طالب",
  "student.update": "تعديل طالب",
  "student.archive": "أرشفة طالب",
  "student.restore": "استعادة طالب",
  "student.export": "تصدير الطلاب",
  "import.validate": "رفع ملف استيراد",
  "import.complete": "اكتمال استيراد",
  "enrollment.add": "تسجيل طلاب في مادة",
  "enrollment.request": "طلب تسجيل",
  "enrollment.decide": "قرار طلب تسجيل",
  "enrollment.remove": "إزالة من مادة",
  "lecture.create": "إنشاء محاضرة",
  "lecture.update": "تعديل محاضرة",
  "lecture.open": "فتح الحضور",
  "lecture.close": "إغلاق الحضور",
  "lecture.reopen": "إعادة فتح الحضور",
  "lecture.cancel": "إلغاء محاضرة",
  "attendance.mark": "تسجيل حضور",
  "attendance.correct": "تصحيح حضور",
  "settings.update": "تعديل الإعدادات",
  "security.inquiry_blocked": "حظر استعلام متكرر",
  "security.checkin_blocked": "حظر تسجيل حضور متكرر",
};
