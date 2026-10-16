import type { Actor } from "@/server/auth/actor";
import { hasPermission, isAdmin, isDoctor } from "@/server/authz/policy";

export type NavIcon =
  | "dashboard"
  | "structure"
  | "subjects"
  | "doctors"
  | "staff"
  | "students"
  | "import"
  | "sessions"
  | "reports"
  | "requests"
  | "audit"
  | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Short label for the mobile tab bar */
  short?: string;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function buildNav(a: Actor): NavGroup[] {
  const groups: NavGroup[] = [{ items: [{ href: "/dashboard", label: "لوحة التحكم", short: "الرئيسية", icon: "dashboard" }] }];
  if (isAdmin(a)) {
    groups.push(
      {
        label: "الأكاديمي",
        items: [
          { href: "/admin/structure", label: "الهيكل الأكاديمي", short: "الهيكل", icon: "structure" },
          { href: "/subjects", label: "المواد", icon: "subjects" },
          { href: "/students", label: "الطلاب", icon: "students" },
          { href: "/students/import", label: "استيراد Excel", short: "استيراد", icon: "import" },
        ],
      },
      {
        label: "الحضور",
        items: [
          { href: "/admin/sessions", label: "جلسات الحضور", short: "الجلسات", icon: "sessions" },
          { href: "/requests", label: "طلبات التسجيل", short: "الطلبات", icon: "requests" },
          { href: "/reports", label: "التقارير", icon: "reports" },
        ],
      },
      {
        label: "الإدارة",
        items: [
          { href: "/admin/doctors", label: "الدكاترة", icon: "doctors" },
          { href: "/admin/staff", label: "الطاقم والصلاحيات", icon: "staff" },
          { href: "/admin/audit", label: "سجل العمليات", icon: "audit" },
          { href: "/admin/settings", label: "الإعدادات", icon: "settings" },
        ],
      },
    );
    return groups;
  }
  if (isDoctor(a)) {
    groups.push({
      label: "التدريس",
      items: [
        { href: "/subjects", label: "موادي", icon: "subjects" },
        { href: "/requests", label: "طلبات التسجيل", short: "الطلبات", icon: "requests" },
        { href: "/reports", label: "التقارير", icon: "reports" },
      ],
    });
    return groups;
  }
  const items: NavItem[] = [];
  if (hasPermission(a, "students.view")) items.push({ href: "/students", label: "الطلاب", icon: "students" });
  if (hasPermission(a, "students.import")) items.push({ href: "/students/import", label: "استيراد Excel", short: "استيراد", icon: "import" });
  items.push({ href: "/subjects", label: "المواد", icon: "subjects" });
  if (hasPermission(a, "enrollment.request")) items.push({ href: "/requests", label: "طلبات التسجيل", short: "الطلبات", icon: "requests" });
  if (hasPermission(a, "reports.view")) items.push({ href: "/reports", label: "التقارير", icon: "reports" });
  groups.push({ label: "المهام", items });
  return groups;
}
