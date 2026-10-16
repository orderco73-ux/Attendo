import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { arEG } from "date-fns/locale";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "Africa/Cairo";

/** Interpret a wall-clock date ("2026-10-14") + time ("09:30") in the institution timezone. */
export function zonedToUtc(date: string, time: string, tz = APP_TIMEZONE): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => !Number.isFinite(n))) throw new Error("Invalid date/time");
  const zoned = new TZDate(y, m - 1, d, hh, mm, 0, tz);
  return new Date(zoned.getTime());
}

/** Split a UTC date into wall-clock date + time strings in the institution timezone (for form defaults). */
export function utcToZonedParts(value: Date | string, tz = APP_TIMEZONE): { date: string; time: string } {
  const z = new TZDate(new Date(value).getTime(), tz);
  return { date: format(z, "yyyy-MM-dd"), time: format(z, "HH:mm") };
}

function z(value: Date | string, tz = APP_TIMEZONE) {
  return new TZDate(new Date(value).getTime(), tz);
}

export function formatDate(value: Date | string | null | undefined, tz = APP_TIMEZONE) {
  if (!value) return "—";
  return format(z(value, tz), "d MMMM yyyy", { locale: arEG });
}

export function formatShortDate(value: Date | string | null | undefined, tz = APP_TIMEZONE) {
  if (!value) return "—";
  return format(z(value, tz), "yyyy/MM/dd");
}

export function formatTime(value: Date | string | null | undefined, tz = APP_TIMEZONE) {
  if (!value) return "—";
  return format(z(value, tz), "h:mm a", { locale: arEG });
}

export function formatDateTime(value: Date | string | null | undefined, tz = APP_TIMEZONE) {
  if (!value) return "—";
  return format(z(value, tz), "d MMM yyyy، h:mm a", { locale: arEG });
}

export function formatWeekday(value: Date | string, tz = APP_TIMEZONE) {
  return format(z(value, tz), "EEEE", { locale: arEG });
}

/** Start/end of the institution-local day containing `now`, as UTC dates. */
export function zonedDayRange(now = new Date(), tz = APP_TIMEZONE): { start: Date; end: Date } {
  const zn = z(now, tz);
  const start = new TZDate(zn.getFullYear(), zn.getMonth(), zn.getDate(), 0, 0, 0, tz);
  const end = new TZDate(zn.getFullYear(), zn.getMonth(), zn.getDate() + 1, 0, 0, 0, tz);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

export function todayKey(now = new Date(), tz = APP_TIMEZONE) {
  return format(z(now, tz), "yyyy-MM-dd");
}
