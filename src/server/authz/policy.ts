import { Types } from "mongoose";
import type { Permission } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";

/*
 * Central authorization policy. Pure functions over plain data so they are unit-testable and reusable
 * by every service. Services must call these before reading/writing any scoped document.
 */

type IdLike = { toString(): string } | string;
const s = (v: IdLike | null | undefined) => (v == null ? null : String(v));

export const isAdmin = (a: Actor) => a.role === "admin";
export const isDoctor = (a: Actor) => a.role === "doctor";
export const isStaff = (a: Actor) => a.role === "staff";

/** Staff permission check. Admin implicitly holds all; doctors hold none of the *staff* permission keys. */
export function hasPermission(a: Actor, p: Permission): boolean {
  if (isAdmin(a)) return true;
  if (isStaff(a)) return !!a.staff?.permissions.includes(p);
  return false;
}

export function assertPermission(a: Actor, p: Permission) {
  if (!hasPermission(a, p)) throw new AppError("FORBIDDEN");
}

export function assertAdmin(a: Actor) {
  if (!isAdmin(a)) throw new AppError("FORBIDDEN");
}

/* ---------------- Student scope ---------------- */

export interface StudentPlacement {
  college: IdLike;
  academicYear: IdLike;
  department: IdLike;
  section?: IdLike | null;
}

/** Whether a student placement falls inside a staff member's scope (admin: always). */
export function studentInScope(a: Actor, st: StudentPlacement): boolean {
  if (isAdmin(a)) return true;
  if (!isStaff(a) || !a.staff) return false;
  const sc = a.staff.scope;
  if (!sc.college || sc.college !== s(st.college)) return false;
  if (sc.academicYears.length && !sc.academicYears.includes(s(st.academicYear)!)) return false;
  if (sc.departments.length && !sc.departments.includes(s(st.department)!)) return false;
  if (sc.sections.length && !(st.section && sc.sections.includes(s(st.section)!))) return false;
  return true;
}

/**
 * Mongo filter restricting student queries to the actor's scope. Always AND this with user filters.
 * Doctors get no global student scope (they access students through their subjects).
 */
export function studentScopeFilter(a: Actor): Record<string, unknown> {
  if (isAdmin(a)) return {};
  if (!isStaff(a) || !a.staff?.scope.college) return { _id: { $exists: false } }; // matches nothing
  const sc = a.staff.scope;
  const f: Record<string, unknown> = { college: new Types.ObjectId(sc.college!) };
  if (sc.academicYears.length) f.academicYear = { $in: sc.academicYears.map((x) => new Types.ObjectId(x)) };
  if (sc.departments.length) f.department = { $in: sc.departments.map((x) => new Types.ObjectId(x)) };
  if (sc.sections.length) f.section = { $in: sc.sections.map((x) => new Types.ObjectId(x)) };
  return f;
}

/* ---------------- Subject access ---------------- */

export interface SubjectLike {
  _id: IdLike;
  college: IdLike;
  doctors: IdLike[];
  assistants?: IdLike[];
  eligibility?: { academicYears?: IdLike[]; departments?: IdLike[]; sections?: IdLike[] };
}

const intersects = (a: string[], b: string[]) => a.length === 0 || b.length === 0 || a.some((x) => b.includes(x));

export function isSubjectDoctor(a: Actor, subj: SubjectLike) {
  return isDoctor(a) && subj.doctors.map(String).includes(a.id);
}

export function isSubjectAssistant(a: Actor, subj: SubjectLike) {
  return (subj.assistants ?? []).map(String).includes(a.id);
}

/** Staff scope overlaps the subject's eligible population. */
export function subjectInStaffScope(a: Actor, subj: SubjectLike): boolean {
  if (!isStaff(a) || !a.staff?.scope.college) return false;
  const sc = a.staff.scope;
  if (sc.college !== s(subj.college)) return false;
  const el = subj.eligibility ?? {};
  return (
    intersects(sc.academicYears, (el.academicYears ?? []).map(String)) &&
    intersects(sc.departments, (el.departments ?? []).map(String)) &&
    intersects(sc.sections, (el.sections ?? []).map(String))
  );
}

/** Full management: lectures, sessions, enrollment decisions, corrections. */
export function canManageSubject(a: Actor, subj: SubjectLike) {
  return isAdmin(a) || isSubjectDoctor(a, subj);
}

export function canViewSubject(a: Actor, subj: SubjectLike) {
  if (canManageSubject(a, subj) || isSubjectAssistant(a, subj)) return true;
  return (
    (hasPermission(a, "attendance.view") || hasPermission(a, "reports.view") || hasPermission(a, "attendance.mark") || hasPermission(a, "enrollment.request")) &&
    subjectInStaffScope(a, subj)
  );
}

/** Mark attendance during an open session (staff-assisted). */
export function canMarkInSubject(a: Actor, subj: SubjectLike) {
  if (canManageSubject(a, subj) || isSubjectAssistant(a, subj)) return true;
  return hasPermission(a, "attendance.mark") && subjectInStaffScope(a, subj);
}

export function canViewSubjectReports(a: Actor, subj: SubjectLike) {
  if (canManageSubject(a, subj)) return true;
  return (hasPermission(a, "reports.view") || hasPermission(a, "attendance.view")) && subjectInStaffScope(a, subj);
}

/** Staff seeing a subject only see students in their own scope; doctors/admins/assistants see all enrolled. */
export function subjectStudentFilter(a: Actor, subj: SubjectLike): Record<string, unknown> {
  if (canManageSubject(a, subj) || isSubjectAssistant(a, subj)) return {};
  return studentScopeFilter(a);
}

export function assertCan(ok: boolean, msg?: string) {
  if (!ok) throw new AppError("FORBIDDEN", msg);
}

/** Mongo filter for subjects visible to the actor (list pages). */
export function visibleSubjectsFilter(a: Actor): Record<string, unknown> {
  if (isAdmin(a)) return {};
  if (isDoctor(a)) return { doctors: a.oid };
  if (!a.staff?.scope.college) return { assistants: a.oid };
  const sc = a.staff.scope;
  const anyOrIn = (field: string, ids: string[]) =>
    ids.length ? { $or: [{ [field]: { $size: 0 } }, { [field]: { $in: ids.map((x) => new Types.ObjectId(x)) } }] } : {};
  const scoped = {
    $and: [
      { college: new Types.ObjectId(sc.college!) },
      anyOrIn("eligibility.academicYears", sc.academicYears),
      anyOrIn("eligibility.departments", sc.departments),
      anyOrIn("eligibility.sections", sc.sections),
    ],
  };
  const anyStaffPerm = ["attendance.view", "attendance.mark", "reports.view", "enrollment.request"].some((p) =>
    hasPermission(a, p as Permission),
  );
  return anyStaffPerm ? { $or: [{ assistants: a.oid }, scoped] } : { assistants: a.oid };
}
