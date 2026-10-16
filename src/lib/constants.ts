export const APP_NAME = "Attendo nosait";

export const ROLES = ["admin", "doctor", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  doctor: "دكتور",
  staff: "طاقم العمل",
};

export const STAFF_KINDS = ["class_leader", "specialization_leader", "custom"] as const;
export type StaffKind = (typeof STAFF_KINDS)[number];
export const STAFF_KIND_LABELS: Record<StaffKind, string> = {
  class_leader: "قائد دفعة",
  specialization_leader: "قائد تخصص",
  custom: "دور مخصص",
};

export const PERMISSIONS = [
  "students.view",
  "students.create",
  "students.edit",
  "students.import",
  "students.archive",
  "attendance.view",
  "attendance.mark",
  "reports.view",
  "enrollment.request",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, { label: string; group: string }> = {
  "students.view": { label: "عرض الطلاب", group: "الطلاب" },
  "students.create": { label: "إضافة طلاب", group: "الطلاب" },
  "students.edit": { label: "تعديل بيانات الطلاب", group: "الطلاب" },
  "students.import": { label: "استيراد الطلاب من Excel", group: "الطلاب" },
  "students.archive": { label: "أرشفة الطلاب", group: "الطلاب" },
  "attendance.view": { label: "عرض الحضور", group: "الحضور" },
  "attendance.mark": { label: "تسجيل الحضور أثناء فتح الجلسة", group: "الحضور" },
  "reports.view": { label: "عرض التقارير", group: "التقارير" },
  "enrollment.request": { label: "تقديم طلبات تسجيل المواد", group: "المواد" },
};

export const DEFAULT_KIND_PERMISSIONS: Record<StaffKind, Permission[]> = {
  class_leader: ["students.view", "students.create", "students.edit", "attendance.view", "attendance.mark", "reports.view"],
  specialization_leader: ["students.view", "attendance.view", "reports.view"],
  custom: ["students.view"],
};

export const SPECIALIZATION_POLICIES = ["general_only", "specialized", "any"] as const;
export type SpecializationPolicy = (typeof SPECIALIZATION_POLICIES)[number];
export const SPECIALIZATION_POLICY_LABELS: Record<SpecializationPolicy, string> = {
  general_only: "بدون تخصص فقط",
  specialized: "تخصص إلزامي",
  any: "أي قسم",
};

export const STUDENT_STATUSES = ["active", "archived"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const LECTURE_STATUSES = ["scheduled", "open", "closed", "cancelled"] as const;
export type LectureStatus = (typeof LECTURE_STATUSES)[number];
export const LECTURE_STATUS_LABELS: Record<LectureStatus, string> = {
  scheduled: "مجدولة",
  open: "مفتوحة",
  closed: "مغلقة",
  cancelled: "ملغاة",
};

export const SESSION_MODES = ["manual", "scheduled"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  manual: "يدوي",
  scheduled: "مجدول تلقائيًا",
};

export const ATTENDANCE_METHODS = ["location", "qr", "location_qr", "staff_only"] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];
export const ATTENDANCE_METHOD_LABELS: Record<AttendanceMethod, string> = {
  location: "الموقع فقط",
  qr: "QR الطالب",
  location_qr: "الموقع + QR",
  staff_only: "بواسطة الطاقم فقط",
};
export const methodNeedsLocation = (m: AttendanceMethod) => m === "location" || m === "location_qr";
export const methodNeedsQr = (m: AttendanceMethod) => m === "qr" || m === "location_qr";

export const RECORD_STATUSES = ["present", "absent", "excused"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];
export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  excused: "بعذر",
};

export const RECORD_SOURCES = ["self_checkin", "staff", "doctor_correction"] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];
export const RECORD_SOURCE_LABELS: Record<RecordSource, string> = {
  self_checkin: "تسجيل ذاتي",
  staff: "بواسطة الطاقم",
  doctor_correction: "تصحيح الدكتور",
};

export const ENROLLMENT_STATUSES = ["pending", "approved", "rejected", "removed"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مسجل",
  rejected: "مرفوض",
  removed: "محذوف من المادة",
};

export const PAGE_SIZE = 20;
