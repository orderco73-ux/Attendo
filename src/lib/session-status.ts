import type { LectureStatus, SessionMode } from "./constants";

export interface StatusInput {
  status: LectureStatus;
  attendance: { mode: SessionMode; opensAt?: Date | null; closesAt?: Date | null };
}

/**
 * Authoritative, pure computation of a lecture's attendance status at `now`.
 * Manual sessions only change by explicit doctor action; scheduled sessions follow their window.
 * Cancelled/closed are terminal (a doctor may explicitly reopen — handled by the service).
 */
export function effectiveStatus(lecture: StatusInput, now: Date = new Date()): LectureStatus {
  if (lecture.status === "cancelled" || lecture.status === "closed") return lecture.status;
  if (lecture.attendance.mode === "manual") return lecture.status;
  const { opensAt, closesAt } = lecture.attendance;
  if (!opensAt || !closesAt) return lecture.status;
  const t = now.getTime();
  if (t >= new Date(closesAt).getTime()) return "closed";
  if (t >= new Date(opensAt).getTime()) return "open";
  return "scheduled";
}

/** Percentage rule: attended / (eligible − excused) × 100, half-up to one decimal; null when undefined. */
export function attendancePercentage(attended: number, eligible: number, excused: number): number | null {
  const denom = eligible - excused;
  if (denom <= 0) return null;
  return Math.round((attended / denom) * 1000 + Number.EPSILON) / 10;
}
