import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { Lecture, Subject, type ILecture } from "@/server/db/models";
import { ATTENDANCE_METHODS, SESSION_MODES, methodNeedsLocation, PAGE_SIZE } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import { visibleSubjectsFilter } from "@/server/authz/policy";
import { AppError, invalid } from "@/server/errors";
import { oid } from "@/server/ids";
import { effectiveStatus } from "@/lib/session-status";
import { zonedToUtc, zonedDayRange } from "@/lib/time";
import { getSubjectFor, type SubjectAccess } from "./subjects";
import { audit } from "./audit";
import { getSettings } from "./settings";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح");
const time = z.string().regex(/^\d{2}:\d{2}$/, "وقت غير صالح");
const optNum = z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().finite().optional());

export const lectureSchema = z.object({
  title: z.string().trim().min(2, "أدخل عنوان المحاضرة").max(150),
  number: optNum,
  date,
  startTime: time,
  endTime: time,
  venue: z.string().trim().max(150).optional().or(z.literal("")),
  mode: z.enum(SESSION_MODES),
  method: z.enum(ATTENDANCE_METHODS),
  opensDate: date.optional().or(z.literal("")),
  opensTime: time.optional().or(z.literal("")),
  closesDate: date.optional().or(z.literal("")),
  closesTime: time.optional().or(z.literal("")),
  lat: optNum,
  lng: optNum,
  radiusM: optNum,
  repeatWeeks: z.coerce.number().int().min(1).max(20).default(1),
});
export type LectureInput = z.infer<typeof lectureSchema>;

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Validates times/location and converts wall-clock inputs (institution timezone) to UTC. */
export function buildLectureTiming(data: LectureInput, defaultRadius: number) {
  const startsAt = zonedToUtc(data.date, data.startTime);
  const endsAt = zonedToUtc(data.date, data.endTime);
  const errors: Record<string, string> = {};
  if (endsAt <= startsAt) errors.endTime = "وقت النهاية يجب أن يكون بعد وقت البداية";

  let opensAt: Date | null = null;
  let closesAt: Date | null = null;
  if (data.mode === "scheduled") {
    if (!data.opensTime) errors.opensTime = "حدد وقت فتح الحضور";
    if (!data.closesTime) errors.closesTime = "حدد وقت إغلاق الحضور";
    if (data.opensTime && data.closesTime) {
      opensAt = zonedToUtc(data.opensDate || data.date, data.opensTime);
      closesAt = zonedToUtc(data.closesDate || data.date, data.closesTime);
      if (closesAt <= opensAt) errors.closesTime = "وقت الإغلاق يجب أن يكون بعد وقت الفتح";
    }
  }

  let location: { lat: number; lng: number } | null = null;
  let radiusM: number | null = null;
  if (methodNeedsLocation(data.method)) {
    if (data.lat == null || data.lng == null || data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
      errors.lat = "حدد موقع المحاضرة (خط العرض والطول)";
    } else location = { lat: data.lat, lng: data.lng };
    radiusM = data.radiusM ?? defaultRadius;
    if (radiusM < 10 || radiusM > 5000) errors.radiusM = "نطاق المسافة بين 10 و 5000 متر";
  }
  if (Object.keys(errors).length) throw invalid("راجع بيانات المحاضرة", errors);
  return { startsAt, endsAt, opensAt, closesAt, location, radiusM };
}

export const newCheckinToken = () => randomBytes(18).toString("base64url");

/* ---------------- Reconciliation (idempotent) ---------------- */

/**
 * Persists scheduled transitions for lectures matching `scope`. Safe to run any number of times,
 * concurrently, from cron or lazily before reads; correctness never depends on when it runs.
 */
export async function reconcileLectures(scope: Record<string, unknown> = {}, now = new Date()) {
  const closed = await Lecture.updateMany(
    { ...scope, status: { $in: ["scheduled", "open"] }, "attendance.mode": "scheduled", "attendance.closesAt": { $lte: now } },
    [{ $set: { status: "closed", closedAt: "$attendance.closesAt", openedAt: { $ifNull: ["$openedAt", "$attendance.opensAt"] } } }],
    { updatePipeline: true },
  );
  const opened = await Lecture.updateMany(
    { ...scope, status: "scheduled", "attendance.mode": "scheduled", "attendance.opensAt": { $lte: now }, "attendance.closesAt": { $gt: now } },
    [{ $set: { status: "open", openedAt: "$attendance.opensAt" } }],
    { updatePipeline: true },
  );
  return { opened: opened.modifiedCount, closed: closed.modifiedCount };
}

/* ---------------- Reads ---------------- */

export interface LectureView {
  id: string;
  subject: string;
  title: string;
  number: number | null;
  startsAt: string;
  endsAt: string;
  venue?: string;
  status: ILecture["status"];
  mode: ILecture["attendance"]["mode"];
  method: ILecture["attendance"]["method"];
  opensAt: string | null;
  closesAt: string | null;
  location: { lat: number; lng: number } | null;
  radiusM: number | null;
  cancelReason?: string;
}

export function toLectureView(l: ILecture, now = new Date()): LectureView {
  return {
    id: String(l._id),
    subject: String(l.subject),
    title: l.title,
    number: l.number ?? null,
    startsAt: l.startsAt.toISOString(),
    endsAt: l.endsAt.toISOString(),
    venue: l.venue,
    status: effectiveStatus(l, now),
    mode: l.attendance.mode,
    method: l.attendance.method,
    opensAt: l.attendance.opensAt ? l.attendance.opensAt.toISOString() : null,
    closesAt: l.attendance.closesAt ? l.attendance.closesAt.toISOString() : null,
    location: l.attendance.location ? { lat: l.attendance.location.lat, lng: l.attendance.location.lng } : null,
    radiusM: l.attendance.radiusM ?? null,
    cancelReason: l.cancelReason,
  };
}

export async function listSubjectLectures(actor: Actor, subjectId: string, params: { status?: string; page?: number } = {}) {
  const subject = await getSubjectFor(actor, subjectId, "view");
  await reconcileLectures({ subject: subject._id });
  const filter: Record<string, unknown> = { subject: subject._id };
  if (params.status && ["scheduled", "open", "closed", "cancelled"].includes(params.status)) filter.status = params.status;
  const page = Math.max(1, params.page ?? 1);
  const [items, total] = await Promise.all([
    Lecture.find(filter).sort({ startsAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Lecture.countDocuments(filter),
  ]);
  return { subject, items: items.map((l) => toLectureView(l)), total, page, pageSize: PAGE_SIZE };
}

/** Loads a lecture with its subject, enforcing access on the subject. */
export async function getLectureFor(actor: Actor, lectureId: string, access: SubjectAccess = "view") {
  const id = oid(lectureId);
  await reconcileLectures({ _id: id });
  const lecture = await Lecture.findById(id).lean();
  if (!lecture) throw new AppError("NOT_FOUND");
  const subject = await getSubjectFor(actor, String(lecture.subject), access);
  return { lecture, subject };
}

/** Lectures across all subjects visible to the actor within [from, to). */
export async function lecturesInRange(actor: Actor, from: Date, to: Date, limit = 50) {
  const subjects = await Subject.find({ $and: [visibleSubjectsFilter(actor), { active: true }] }).select("_id name code").lean();
  const ids = subjects.map((s) => s._id);
  await reconcileLectures({ subject: { $in: ids } });
  const lectures = await Lecture.find({ subject: { $in: ids }, startsAt: { $gte: from, $lt: to } }).sort({ startsAt: 1 }).limit(limit).lean();
  const byId = new Map(subjects.map((s) => [String(s._id), s]));
  return lectures.map((l) => ({ ...toLectureView(l), subjectName: byId.get(String(l.subject))?.name ?? "", subjectCode: byId.get(String(l.subject))?.code ?? "" }));
}

export async function openLecturesFor(actor: Actor) {
  const subjects = await Subject.find({ $and: [visibleSubjectsFilter(actor), { active: true }] }).select("_id name code").lean();
  const ids = subjects.map((s) => s._id);
  await reconcileLectures({ subject: { $in: ids } });
  const lectures = await Lecture.find({ subject: { $in: ids }, status: "open" }).sort({ startsAt: 1 }).limit(50).lean();
  const byId = new Map(subjects.map((s) => [String(s._id), s]));
  return lectures.map((l) => ({ ...toLectureView(l), subjectName: byId.get(String(l.subject))?.name ?? "", subjectCode: byId.get(String(l.subject))?.code ?? "" }));
}

export function todayRange() {
  return zonedDayRange();
}

/* ---------------- Mutations (subject managers) ---------------- */

export async function createLectures(actor: Actor, subjectId: string, input: unknown) {
  const subject = await getSubjectFor(actor, subjectId, "manage");
  if (!subject.active) throw invalid("المادة غير مفعلة");
  const data = lectureSchema.parse(input);
  const settings = await getSettings();
  const t = buildLectureTiming(data, settings.defaultRadiusM);
  const docs = Array.from({ length: data.repeatWeeks }, (_, i) => {
    const shift = (d: Date | null) => (d ? new Date(d.getTime() + i * WEEK_MS) : null);
    return {
      subject: subject._id,
      title: data.repeatWeeks > 1 ? `${data.title}${data.number ? "" : ` (${i + 1})`}` : data.title,
      number: data.number != null ? data.number + i : null,
      startsAt: shift(t.startsAt),
      endsAt: shift(t.endsAt),
      venue: data.venue || undefined,
      status: "scheduled" as const,
      attendance: {
        mode: data.mode,
        method: data.method,
        opensAt: shift(t.opensAt),
        closesAt: shift(t.closesAt),
        location: t.location,
        radiusM: t.radiusM,
        checkinToken: newCheckinToken(),
      },
      createdBy: actor.oid,
    };
  });
  const created = await Lecture.insertMany(docs);
  await audit(actor, {
    action: "lecture.create",
    summary: `إنشاء ${created.length} محاضرة في ${subject.code}: ${data.title}`,
    entityType: "subject",
    entityId: subject._id,
  });
  return created.map((c) => String(c._id));
}

export async function updateLecture(actor: Actor, lectureId: string, input: unknown) {
  const { lecture, subject } = await getLectureFor(actor, lectureId, "manage");
  const status = effectiveStatus(lecture);
  if (status === "cancelled") throw invalid("لا يمكن تعديل محاضرة ملغاة");
  const data = lectureSchema.parse({ ...(input as object), repeatWeeks: 1 });
  const settings = await getSettings();
  const t = buildLectureTiming(data, settings.defaultRadiusM);

  const set: Record<string, unknown> = { title: data.title, number: data.number ?? null, venue: data.venue || undefined };
  if (status === "scheduled") {
    // Full reschedule only before the session has opened.
    Object.assign(set, {
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      "attendance.mode": data.mode,
      "attendance.method": data.method,
      "attendance.opensAt": t.opensAt,
      "attendance.closesAt": t.closesAt,
      "attendance.location": t.location,
      "attendance.radiusM": t.radiusM,
    });
  } else if (status === "open") {
    // While open: method/location may be adjusted, and a scheduled close time extended.
    Object.assign(set, { "attendance.method": data.method, "attendance.location": t.location, "attendance.radiusM": t.radiusM });
    if (lecture.attendance.mode === "scheduled" && data.mode === "scheduled" && t.closesAt) {
      if (t.closesAt <= new Date()) throw invalid("وقت الإغلاق الجديد يجب أن يكون في المستقبل", { closesTime: "يجب أن يكون في المستقبل" });
      set["attendance.closesAt"] = t.closesAt;
    }
  }
  await Lecture.updateOne({ _id: lecture._id, status: lecture.status }, { $set: set }, { runValidators: true });
  await audit(actor, {
    action: "lecture.update",
    summary: `تعديل المحاضرة "${data.title}" (${subject.code})`,
    entityType: "lecture",
    entityId: lecture._id,
    meta: { before: { startsAt: lecture.startsAt, endsAt: lecture.endsAt, method: lecture.attendance.method }, statusAtEdit: status },
  });
}

/** Manual open (also "open now" for scheduled lectures, which converts them to manual mode). */
export async function openLecture(actor: Actor, lectureId: string) {
  const { lecture, subject } = await getLectureFor(actor, lectureId, "manage");
  const status = effectiveStatus(lecture);
  if (status === "open") return;
  if (status === "cancelled") throw invalid("المحاضرة ملغاة");
  const reopening = status === "closed";
  const res = await Lecture.updateOne(
    { _id: lecture._id, status: { $in: ["scheduled", "closed"] } },
    { $set: { status: "open", "attendance.mode": "manual", openedAt: lecture.openedAt ?? new Date(), closedAt: null } },
  );
  if (!res.modifiedCount) throw new AppError("CONFLICT", "تغيرت حالة المحاضرة، حدّث الصفحة");
  await audit(actor, {
    action: reopening ? "lecture.reopen" : "lecture.open",
    summary: `${reopening ? "إعادة فتح" : "فتح"} الحضور: ${lecture.title} (${subject.code})`,
    entityType: "lecture",
    entityId: lecture._id,
  });
}

export async function closeLecture(actor: Actor, lectureId: string) {
  const { lecture, subject } = await getLectureFor(actor, lectureId, "manage");
  const status = effectiveStatus(lecture);
  if (status === "closed") return;
  if (status !== "open") throw invalid("لا يمكن إغلاق جلسة غير مفتوحة");
  const res = await Lecture.updateOne(
    { _id: lecture._id, status: "open" },
    { $set: { status: "closed", "attendance.mode": "manual", closedAt: new Date() } },
  );
  if (!res.modifiedCount) throw new AppError("CONFLICT", "تغيرت حالة المحاضرة، حدّث الصفحة");
  await audit(actor, { action: "lecture.close", summary: `إغلاق الحضور: ${lecture.title} (${subject.code})`, entityType: "lecture", entityId: lecture._id });
}

export async function cancelLecture(actor: Actor, lectureId: string, reason: string) {
  const { lecture, subject } = await getLectureFor(actor, lectureId, "manage");
  const status = effectiveStatus(lecture);
  if (status === "cancelled") return;
  if (status === "closed") throw invalid("لا يمكن إلغاء محاضرة مغلقة؛ يمكنك تصحيح الحضور بدلًا من ذلك");
  const r = reason.trim().slice(0, 300);
  if (r.length < 3) throw invalid("اكتب سبب الإلغاء", { reason: "مطلوب" });
  await Lecture.updateOne({ _id: lecture._id, status: { $in: ["scheduled", "open"] } }, { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: r } });
  await audit(actor, { action: "lecture.cancel", summary: `إلغاء المحاضرة: ${lecture.title} (${subject.code})`, entityType: "lecture", entityId: lecture._id, meta: { reason: r } });
}

export async function regenerateCheckinToken(actor: Actor, lectureId: string) {
  const { lecture } = await getLectureFor(actor, lectureId, "manage");
  await Lecture.updateOne({ _id: lecture._id }, { $set: { "attendance.checkinToken": newCheckinToken() } });
}

export type LectureDoc = ILecture & { _id: Types.ObjectId };
