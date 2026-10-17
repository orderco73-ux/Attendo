"use server";
import { revalidatePath } from "next/cache";
import { decideEnrollments, enrollAllEligible, enrollStudents, removeEnrollment } from "@/server/services/enrollment";
import { cancelLecture, closeLecture, createLectures, openLecture, regenerateCheckinToken, updateLecture } from "@/server/services/lectures";
import { clearAttendance, lectureSheet, markAllPresent, setAttendanceStatus, staffMarkPresent } from "@/server/services/attendance";
import type { StudentQuery } from "@/server/services/students";
import { run } from "./_run";

const sub = (id: string) => revalidatePath(`/subjects/${id}`, "layout");
const lec = (id: string) => revalidatePath(`/lectures/${id}`);

/* Enrollment */
export async function enrollStudentsAction(subjectId: string, input: unknown) {
  return run(async (a) => {
    const r = await enrollStudents(a, subjectId, input);
    sub(subjectId);
    return r;
  });
}
export async function enrollAllAction(subjectId: string, filters: StudentQuery, effectiveFrom?: string) {
  return run(async (a) => {
    const r = await enrollAllEligible(a, subjectId, filters, effectiveFrom);
    sub(subjectId);
    return r;
  });
}
export async function decideEnrollmentsAction(subjectId: string, input: unknown) {
  return run(async (a) => {
    const r = await decideEnrollments(a, subjectId, input);
    sub(subjectId);
    revalidatePath("/requests");
    return r;
  });
}
export async function removeEnrollmentAction(subjectId: string, enrollmentId: string) {
  return run(async (a) => {
    await removeEnrollment(a, subjectId, enrollmentId);
    sub(subjectId);
    return null;
  });
}

/* Lectures */
export async function createLecturesAction(subjectId: string, input: unknown) {
  return run(async (a) => {
    const r = await createLectures(a, subjectId, input);
    sub(subjectId);
    return r;
  });
}
export async function updateLectureAction(lectureId: string, input: unknown) {
  return run(async (a) => {
    await updateLecture(a, lectureId, input);
    lec(lectureId);
    return null;
  });
}
export async function openLectureAction(lectureId: string) {
  return run(async (a) => {
    await openLecture(a, lectureId);
    lec(lectureId);
    return null;
  });
}
export async function closeLectureAction(lectureId: string) {
  return run(async (a) => {
    await closeLecture(a, lectureId);
    lec(lectureId);
    return null;
  });
}
export async function cancelLectureAction(lectureId: string, reason: string) {
  return run(async (a) => {
    await cancelLecture(a, lectureId, reason);
    lec(lectureId);
    return null;
  });
}
export async function regenerateTokenAction(lectureId: string) {
  return run(async (a) => {
    await regenerateCheckinToken(a, lectureId);
    lec(lectureId);
    return null;
  });
}

/* Attendance */
export async function staffMarkAction(lectureId: string, input: unknown) {
  return run(async (a) => {
    const r = await staffMarkPresent(a, lectureId, input);
    lec(lectureId);
    return r;
  });
}
export async function setStatusAction(lectureId: string, input: unknown) {
  return run(async (a) => {
    const r = await setAttendanceStatus(a, lectureId, input);
    lec(lectureId);
    return r;
  });
}
/** Quick search among the lecture's enrolled (and, for leaders, in-scope) students. */
export async function searchLectureStudentsAction(lectureId: string, q: string) {
  return run(async (a) => {
    const r = await lectureSheet(a, lectureId, { q: q.slice(0, 60), pageSize: 8 });
    return r.items.map((i) => ({ studentId: i.student.id, code: i.student.code, fullName: i.student.fullName, status: i.record?.status ?? null }));
  });
}

export async function clearStatusAction(lectureId: string, input: unknown) {
  return run(async (a) => {
    const r = await clearAttendance(a, lectureId, input);
    lec(lectureId);
    return r;
  });
}

export async function markAllPresentAction(lectureId: string) {
  return run(async (a) => {
    const r = await markAllPresent(a, lectureId);
    lec(lectureId);
    return r;
  });
}
