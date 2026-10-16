import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { listEnrollmentCandidates } from "@/server/services/enrollment";
import { subjectCapabilities } from "@/server/services/subjects";
import { getStructure } from "@/server/services/academic";
import { AppError } from "@/server/errors";
import { Subject } from "@/server/db/models";
import { Section } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { todayKey } from "@/lib/time";
import { CandidatesTable } from "./candidates";

export default async function EnrollPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  let data;
  try {
    data = await listEnrollmentCandidates(actor, id, { q: sp.q, academicYear: sp.year, department: sp.department, section: sp.section, page: Number(sp.page) || 1, pageSize: 50 });
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const subject = (await Subject.findById(id).lean())!;
  const caps = subjectCapabilities(actor, subject);
  const st = await getStructure();
  const el = subject.eligibility;
  const years = st.years.filter((y) => y.college === String(subject.college) && (!el.academicYears.length || el.academicYears.map(String).includes(y.id)));
  const depts = st.departments.filter((d) => d.college === String(subject.college) && (!el.departments.length || el.departments.map(String).includes(d.id)));
  const n = (list: { id: string; name: string }[], v: string | null) => (v ? list.find((x) => x.id === v)?.name ?? "—" : "—");
  return (
    <Section
      title={caps.manage ? "تسجيل طلاب في المادة" : "طلب تسجيل طلاب"}
      description={
        caps.manage
          ? "تظهر هنا الطلاب المؤهلون غير المسجلين فقط."
          : subject.requiresEnrollmentApproval
            ? "ستُرسل الطلبات للدكتور للموافقة."
            : "سيتم التسجيل مباشرة."
      }
    >
      <FilterBar
        searchPlaceholder="بحث بالاسم أو الكود…"
        selects={[
          { name: "year", label: "السنوات", options: years.map((y) => ({ value: y.id, label: y.name })) },
          { name: "department", label: "التخصصات", options: depts.map((d) => ({ value: d.id, label: d.name })) },
        ]}
      />
      <CandidatesTable
        subjectId={id}
        manage={caps.manage}
        today={todayKey()}
        total={data.total}
        filters={{ academicYear: sp.year, department: sp.department, section: sp.section }}
        items={data.items.map((s) => ({ id: s.id, code: s.code, fullName: s.fullName, year: n(st.years, s.academicYear), department: n(st.departments, s.department) }))}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} />
    </Section>
  );
}
