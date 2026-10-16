import { z } from "zod";
import type { PipelineStage, Types } from "mongoose";
import { Enrollment, Student, Subject, type IStudent } from "@/server/db/models";
import { PAGE_SIZE, type EnrollmentStatus } from "@/lib/constants";
import type { Actor } from "@/server/auth/actor";
import { canManageSubject, hasPermission, isAdmin, isDoctor, studentInScope, studentScopeFilter, subjectInStaffScope, subjectStudentFilter } from "@/server/authz/policy";
import { AppError, invalid } from "@/server/errors";
import { oid, oids } from "@/server/ids";
import { buildStudentFilter, toStudentRow, type StudentQuery } from "./students";
import { eligibilityFilter, getSubjectFor, isEligible } from "./subjects";
import { audit } from "./audit";

const idStr = z.string().regex(/^[a-f0-9]{24}$/i);

export const enrollSchema = z.object({
  studentIds: z.array(idStr).min(1, "اختر طالبًا واحدًا على الأقل").max(500),
  effectiveFrom: z.string().optional(),
  note: z.string().trim().max(300).optional(),
});

/** Enrolled (or pending) students of a subject, joined with student data and scoped for staff. */
export async function listSubjectStudents(actor: Actor, subjectId: string, params: StudentQuery & { enrollment?: string }) {
  const subject = await getSubjectFor(actor, subjectId, "view");
  const status: EnrollmentStatus = (["approved", "pending", "rejected", "removed"] as const).find((s) => s === params.enrollment) ?? "approved";
  const studentFilter = { ...buildStudentFilter({ ...params, status: "all" }), ...subjectStudentFilter(actor, subject) };
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? PAGE_SIZE);

  const prefixed = Object.fromEntries(Object.entries(studentFilter).map(([k, v]) => (k === "$or" ? [k, prefixOr(v)] : ["st." + k, v])));
  const pipeline: PipelineStage[] = [
    { $match: { subject: subject._id, status } },
    { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "st" } },
    { $unwind: "$st" },
    { $match: prefixed },
    { $sort: { "st.seq": 1 } },
    { $facet: { items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }], total: [{ $count: "n" }] } },
  ];
  const [res] = await Enrollment.aggregate<{ items: (Record<string, unknown> & { st: IStudent; _id: Types.ObjectId; effectiveFrom: Date; status: EnrollmentStatus; createdAt: Date })[]; total: { n: number }[] }>(pipeline);
  return {
    subject,
    total: res?.total[0]?.n ?? 0,
    page,
    pageSize,
    items: (res?.items ?? []).map((e) => ({
      enrollmentId: String(e._id),
      status: e.status,
      effectiveFrom: e.effectiveFrom.toISOString(),
      requestedAt: e.createdAt.toISOString(),
      student: toStudentRow(e.st),
    })),
  };
}

function prefixOr(v: unknown) {
  return (v as Record<string, unknown>[]).map((c) => Object.fromEntries(Object.entries(c).map(([k, x]) => ["st." + k, x])));
}

/** Eligible students not yet enrolled/pending in the subject (candidates for enrollment). */
export async function listEnrollmentCandidates(actor: Actor, subjectId: string, params: StudentQuery) {
  const subject = await getSubjectFor(actor, subjectId, "view");
  const manage = canManageSubject(actor, subject);
  if (!manage && !(hasPermission(actor, "enrollment.request") && subjectInStaffScope(actor, subject))) throw new AppError("FORBIDDEN");
  const taken = await Enrollment.distinct("student", { subject: subject._id, status: { $in: ["approved", "pending"] } });
  const filter = {
    $and: [
      eligibilityFilter(subject),
      buildStudentFilter({ ...params, status: "active" }),
      manage ? {} : studentScopeFilter(actor),
      { _id: { $nin: taken } },
    ],
  };
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? PAGE_SIZE);
  const [items, total] = await Promise.all([
    Student.find(filter).sort({ seq: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Student.countDocuments(filter),
  ]);
  return { items: items.map(toStudentRow), total, page, pageSize };
}

function parseEffective(v?: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw invalid("تاريخ بداية الاحتساب غير صالح");
  return d;
}

/**
 * Enroll students. Managers (doctor/admin) enroll directly; staff with `enrollment.request` create
 * pending requests when the subject requires approval (direct otherwise). Ineligible / out-of-scope
 * students are rejected individually and reported back.
 */
export async function enrollStudents(actor: Actor, subjectId: string, input: unknown) {
  const data = enrollSchema.parse(input);
  const subject = await getSubjectFor(actor, subjectId, "view");
  const manage = canManageSubject(actor, subject);
  if (!manage && !(hasPermission(actor, "enrollment.request") && subjectInStaffScope(actor, subject))) throw new AppError("FORBIDDEN");
  const status: EnrollmentStatus = manage || !subject.requiresEnrollmentApproval ? "approved" : "pending";
  const effectiveFrom = (manage && parseEffective(data.effectiveFrom)) || new Date();

  const students = await Student.find({ _id: { $in: oids(data.studentIds) } }).lean();
  const rejected: { code: string; reason: string }[] = [];
  const ops = [];
  for (const st of students) {
    if (!isEligible(subject, st)) {
      rejected.push({ code: st.code, reason: "غير مؤهل لهذه المادة" });
      continue;
    }
    if (!manage && !studentInScope(actor, st)) {
      rejected.push({ code: st.code, reason: "خارج نطاق صلاحياتك" });
      continue;
    }
    ops.push({
      updateOne: {
        // Re-enroll previously rejected/removed rows; never touch approved/pending ones.
        filter: { subject: subject._id, student: st._id, status: { $nin: ["approved", "pending"] as EnrollmentStatus[] } },
        update: {
          $set: {
            status,
            effectiveFrom,
            requestedBy: actor.oid,
            decidedBy: status === "approved" ? actor.oid : null,
            decidedAt: status === "approved" ? new Date() : null,
            note: data.note,
          },
        },
        upsert: true,
      },
    });
  }
  let added = 0;
  if (ops.length) {
    try {
      const res = await Enrollment.bulkWrite(ops, { ordered: false });
      added = res.upsertedCount + res.modifiedCount;
    } catch (err) {
      // Duplicate key = already approved/pending (upsert filter missed) → ignore those rows.
      const r = err as { result?: { upsertedCount?: number; modifiedCount?: number }; code?: number; writeErrors?: unknown[] };
      if (!r.writeErrors) throw err;
      added = (r.result?.upsertedCount ?? 0) + (r.result?.modifiedCount ?? 0);
    }
  }
  await audit(actor, {
    action: status === "approved" ? "enrollment.add" : "enrollment.request",
    summary: `${status === "approved" ? "تسجيل" : "طلب تسجيل"} ${added} طالب في ${subject.code}`,
    entityType: "subject",
    entityId: subject._id,
    meta: { students: data.studentIds.length, added, rejected: rejected.length },
  });
  return { added, status, rejected, skipped: students.length - added - rejected.length };
}

/** Bulk-enroll every eligible active student (doctor/admin). Batched to stay within serverless limits. */
export async function enrollAllEligible(actor: Actor, subjectId: string, filters: StudentQuery, effectiveFrom?: string) {
  const subject = await getSubjectFor(actor, subjectId, "manage");
  const eff = parseEffective(effectiveFrom) ?? new Date();
  const filter = { $and: [eligibilityFilter(subject), buildStudentFilter({ ...filters, status: "active", q: undefined })] };
  const cursor = Student.find(filter).select("_id").lean().cursor({ batchSize: 500 });
  let batch: Types.ObjectId[] = [];
  let added = 0;
  const flush = async () => {
    if (!batch.length) return;
    const res = await Enrollment.bulkWrite(
      batch.map((sid) => ({
        updateOne: {
          filter: { subject: subject._id, student: sid },
          update: { $setOnInsert: { status: "approved", effectiveFrom: eff, requestedBy: actor.oid, decidedBy: actor.oid, decidedAt: new Date() } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    added += res.upsertedCount;
    batch = [];
  };
  for await (const st of cursor) {
    batch.push(st._id);
    if (batch.length >= 500) await flush();
  }
  await flush();
  await audit(actor, { action: "enrollment.add", summary: `تسجيل جماعي: ${added} طالب في ${subject.code}`, entityType: "subject", entityId: subject._id });
  return { added };
}

export const decisionSchema = z.object({
  enrollmentIds: z.array(idStr).min(1).max(500),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300).optional(),
});

export async function decideEnrollments(actor: Actor, subjectId: string, input: unknown) {
  const data = decisionSchema.parse(input);
  const subject = await getSubjectFor(actor, subjectId, "manage");
  const status = data.decision === "approve" ? "approved" : "rejected";
  const res = await Enrollment.updateMany(
    { _id: { $in: oids(data.enrollmentIds) }, subject: subject._id, status: "pending" },
    { $set: { status, decidedBy: actor.oid, decidedAt: new Date(), note: data.note, ...(status === "approved" ? { effectiveFrom: new Date() } : {}) } },
  );
  await audit(actor, {
    action: "enrollment.decide",
    summary: `${status === "approved" ? "قبول" : "رفض"} ${res.modifiedCount} طلب تسجيل في ${subject.code}`,
    entityType: "subject",
    entityId: subject._id,
    meta: { enrollmentIds: data.enrollmentIds, note: data.note },
  });
  return { updated: res.modifiedCount };
}

export async function removeEnrollment(actor: Actor, subjectId: string, enrollmentId: string) {
  const subject = await getSubjectFor(actor, subjectId, "manage");
  const e = await Enrollment.findOneAndUpdate(
    { _id: oid(enrollmentId), subject: subject._id, status: { $in: ["approved", "pending"] } },
    { $set: { status: "removed", decidedBy: actor.oid, decidedAt: new Date() } },
  );
  if (!e) throw new AppError("NOT_FOUND");
  await audit(actor, { action: "enrollment.remove", summary: `إزالة طالب من ${subject.code}`, entityType: "enrollment", entityId: e._id });
}

/** Pending requests across the actor's manageable subjects (doctor dashboard / admin). */
export async function listPendingRequests(actor: Actor, limit = 50) {
  if (!isAdmin(actor) && !isDoctor(actor)) {
    // Staff see the requests they submitted.
    const mine = await Enrollment.find({ requestedBy: actor.oid }).sort({ createdAt: -1 }).limit(limit)
      .populate<{ student: IStudent }>("student", "code fullName academicYear department")
      .populate<{ subject: { _id: Types.ObjectId; name: string; code: string } }>("subject", "name code")
      .lean();
    return mine;
  }
  const subjects = await Subject.find(isAdmin(actor) ? {} : { doctors: actor.oid }).select("_id").lean();
  return Enrollment.find({ subject: { $in: subjects.map((s) => s._id) }, status: "pending" })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate<{ student: IStudent }>("student", "code fullName academicYear department")
    .populate<{ subject: { _id: Types.ObjectId; name: string; code: string } }>("subject", "name code")
    .lean();
}
