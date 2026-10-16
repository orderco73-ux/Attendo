import Link from "next/link";
import { Users } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { listSubjectStudents } from "@/server/services/enrollment";
import { subjectCapabilities } from "@/server/services/subjects";
import { getStructure } from "@/server/services/academic";
import { Section, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/time";
import { RemoveEnrollment } from "./client";

export default async function SubjectStudentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const [data, st] = await Promise.all([
    listSubjectStudents(actor, id, { q: sp.q, academicYear: sp.year, department: sp.department, page: Number(sp.page) || 1 }),
    getStructure(),
  ]);
  const caps = subjectCapabilities(actor, data.subject);
  const n = (list: { id: string; name: string }[], v: string | null) => (v ? list.find((x) => x.id === v)?.name ?? "—" : "—");
  const el = data.subject.eligibility;
  const years = st.years.filter((y) => y.college === String(data.subject.college) && (!el.academicYears.length || el.academicYears.map(String).includes(y.id)));
  const depts = st.departments.filter((d) => d.college === String(data.subject.college) && (!el.departments.length || el.departments.map(String).includes(d.id)));
  return (
    <Section title="الطلاب المسجلون" description={`${data.total} طالب`}>
      <FilterBar
        searchPlaceholder="بحث بالاسم أو الكود…"
        selects={[
          { name: "year", label: "السنوات", options: years.map((y) => ({ value: y.id, label: y.name })) },
          { name: "department", label: "التخصصات", options: depts.map((d) => ({ value: d.id, label: d.name })) },
        ]}
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد طلاب مسجلون"
          description={caps.requestEnrollment ? "سجّل الطلاب المؤهلين لهذه المادة." : undefined}
          action={caps.requestEnrollment ? <Button asChild size="sm"><Link href={`/subjects/${id}/enroll`}>تسجيل طلاب</Link></Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>السنة</TableHead>
              <TableHead>التخصص</TableHead>
              <TableHead>يُحتسب من</TableHead>
              {caps.manage && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((e) => (
              <TableRow key={e.enrollmentId}>
                <TableCell className="ltr font-mono text-xs font-semibold text-primary">{e.student.code}</TableCell>
                <TableCell className="font-medium">{e.student.fullName}</TableCell>
                <TableCell>{n(st.years, e.student.academicYear)}</TableCell>
                <TableCell className="text-muted-foreground">{n(st.departments, e.student.department)}</TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{formatShortDate(e.effectiveFrom)}</TableCell>
                {caps.manage && (
                  <TableCell>
                    <RemoveEnrollment subjectId={id} enrollmentId={e.enrollmentId} name={e.student.fullName} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} />
    </Section>
  );
}
