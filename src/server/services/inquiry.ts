import { AttendanceRecord, Enrollment, Lecture, Student, Subject, AcademicYear, Department } from "@/server/db/models";
import type { RecordStatus } from "@/lib/constants";
import { normalizeStudentCode } from "@/lib/codes";
import { maskName } from "@/lib/arabic";
import { normalizeRegNo } from "./students";
import { computeStats } from "./reports";
import { reconcileLectures } from "./lectures";
import { getSettings } from "./settings";
import { hit, peek } from "./rate-limit";
import { audit } from "./audit";

export type InquiryResult =
  | { ok: false; message: string }
  | {
      ok: true;
      student: { name: string; code: string; year: string; department: string };
      subjects: {
        name: string;
        code: string;
        eligible: number;
        attended: number;
        excused: number;
        absences: number;
        percentage: number | null;
        history: { title: string; startsAt: string; status: RecordStatus | "pending" | "na" }[];
        upcoming: { title: string; startsAt: string; endsAt: string; venue?: string }[];
      }[];
      lowThreshold: number;
    };

const NOT_FOUND = "لم يتم العثور على بيانات مطابقة. تأكد من الكود وحاول مرة أخرى.";
const WINDOW = 600;

/**
 * Public, read-only attendance inquiry by student code.
 * Rate limited per IP; failed lookups are limited more strictly to deter enumeration.
 */
export async function inquire(rawCode: string, verification: string | undefined, ip: string): Promise<InquiryResult> {
  const settings = await getSettings();
  if (!settings.inquiryEnabled) return { ok: false, message: "خدمة الاستعلام متوقفة مؤقتًا" };

  const failedKey = `inquiry:fail:${ip}`;
  if ((await peek(failedKey, WINDOW)) >= 5) return { ok: false, message: "محاولات كثيرة غير ناجحة. حاول بعد 10 دقائق." };
  const rl = await hit(`inquiry:ip:${ip}`, 20, WINDOW);
  if (!rl.allowed) return { ok: false, message: "عدد كبير من الطلبات. حاول بعد قليل." };

  const fail = async () => {
    const f = await hit(failedKey, 5, WINDOW);
    if (f.count === 5) await audit(null, { action: "security.inquiry_blocked", summary: "حظر مؤقت بعد استعلامات فاشلة متكررة", ip });
    return { ok: false as const, message: NOT_FOUND };
  };

  const code = normalizeStudentCode(rawCode ?? "");
  if (!code) return fail();
  const st = await Student.findOne({ code, status: "active" }).lean();
  if (!st) return fail();
  if (settings.inquiryVerification === "registration_number") {
    if (!st.registrationNumber || !verification || normalizeRegNo(verification) !== normalizeRegNo(st.registrationNumber)) return fail();
  }

  const [year, dept, enrollments] = await Promise.all([
    AcademicYear.findById(st.academicYear).select("name").lean(),
    Department.findById(st.department).select("name").lean(),
    Enrollment.find({ student: st._id, status: "approved" }).select("subject effectiveFrom").limit(50).lean(),
  ]);
  const subjectIds = enrollments.map((e) => e.subject);
  await reconcileLectures({ subject: { $in: subjectIds } });
  const [subjects, lectures, records] = await Promise.all([
    Subject.find({ _id: { $in: subjectIds }, active: true }).select("name code").lean(),
    Lecture.find({ subject: { $in: subjectIds }, status: { $ne: "cancelled" } }).select("subject title startsAt endsAt venue status").sort({ startsAt: 1 }).limit(2000).lean(),
    AttendanceRecord.find({ student: st._id, subject: { $in: subjectIds } }).select("lecture status").lean(),
  ]);
  const recByLecture = new Map(records.map((r) => [String(r.lecture), r.status]));
  const now = Date.now();

  const out = subjects.map((s) => {
    const eff = enrollments.find((e) => String(e.subject) === String(s._id))!.effectiveFrom;
    const ls = lectures.filter((l) => String(l.subject) === String(s._id));
    const closed = ls.filter((l) => l.status === "closed").map((l) => ({ id: String(l._id), startsAt: l.startsAt }));
    const stats = computeStats(closed, eff, records.map((r) => ({ lecture: String(r.lecture), status: r.status })));
    const history = ls
      .filter((l) => l.startsAt.getTime() <= now)
      .map((l) => {
        const rec = recByLecture.get(String(l._id));
        let status: RecordStatus | "pending" | "na";
        if (rec) status = rec;
        else if (l.status !== "closed") status = "pending";
        else if (l.startsAt < eff) status = "na";
        else status = "absent";
        return { title: l.title, startsAt: l.startsAt.toISOString(), status };
      })
      .reverse();
    const upcoming = settings.showUpcomingInInquiry
      ? ls
          .filter((l) => l.startsAt.getTime() > now)
          .slice(0, 5)
          .map((l) => ({ title: l.title, startsAt: l.startsAt.toISOString(), endsAt: l.endsAt.toISOString(), venue: l.venue }))
      : [];
    return { name: s.name, code: s.code, ...stats, history, upcoming };
  });

  return {
    ok: true,
    student: { name: maskName(st.fullName), code: st.code, year: year?.name ?? "", department: dept?.name ?? "" },
    subjects: out,
    lowThreshold: settings.lowAttendanceThreshold,
  };
}
