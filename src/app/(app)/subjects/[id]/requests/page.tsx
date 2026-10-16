import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { listSubjectStudents } from "@/server/services/enrollment";
import { getSubjectFor } from "@/server/services/subjects";
import { getStructure } from "@/server/services/academic";
import { AppError } from "@/server/errors";
import { Section } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { Enrollment, User } from "@/server/db/models";
import { RequestsTable } from "./requests-table";

export default async function SubjectRequestsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  try {
    await getSubjectFor(actor, id, "manage");
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const [data, st] = await Promise.all([listSubjectStudents(actor, id, { enrollment: "pending", page: Number(sp.page) || 1, pageSize: 50 }), getStructure()]);
  const reqs = await Enrollment.find({ _id: { $in: data.items.map((i) => i.enrollmentId) } }).select("requestedBy").lean();
  const users = await User.find({ _id: { $in: reqs.flatMap((r) => (r.requestedBy ? [r.requestedBy] : [])) } }).select("name").lean();
  const byReq = new Map(reqs.map((r) => [String(r._id), users.find((u) => String(u._id) === String(r.requestedBy))?.name ?? "—"]));
  const n = (list: { id: string; name: string }[], v: string | null) => (v ? list.find((x) => x.id === v)?.name ?? "—" : "—");
  return (
    <Section title="طلبات التسجيل المعلقة" description="راجع بيانات الطالب ثم وافق أو ارفض.">
      <RequestsTable
        subjectId={id}
        items={data.items.map((i) => ({
          enrollmentId: i.enrollmentId,
          code: i.student.code,
          fullName: i.student.fullName,
          year: n(st.years, i.student.academicYear),
          department: n(st.departments, i.student.department),
          requestedAt: i.requestedAt,
          requestedBy: byReq.get(i.enrollmentId) ?? "—",
        }))}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} />
    </Section>
  );
}
