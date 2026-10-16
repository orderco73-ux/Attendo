import Link from "next/link";
import { Download, FileSpreadsheet, GraduationCap, Plus } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { hasPermission } from "@/server/authz/policy";
import { listStudents } from "@/server/services/students";
import { getStructure } from "@/server/services/academic";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export const metadata = { title: "الطلاب" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  if (!hasPermission(actor, "students.view")) redirect("/dashboard?denied=1");
  const sp = await searchParams;
  const [data, st] = await Promise.all([
    listStudents(actor, { q: sp.q, academicYear: sp.year, department: sp.department, section: sp.section, status: sp.status, page: Number(sp.page) || 1 }),
    getStructure(),
  ]);
  const sc = actor.staff?.scope;
  const years = st.years.filter((y) => !sc || ((!sc.college || y.college === sc.college) && (!sc.academicYears.length || sc.academicYears.includes(y.id))));
  const depts = st.departments.filter((d) => !sc || ((!sc.college || d.college === sc.college) && (!sc.departments.length || sc.departments.includes(d.id))));
  const sections = st.sections.filter((s) => !sc || !sc.sections.length || sc.sections.includes(s.id));
  const n = (list: { id: string; name: string }[], id: string | null) => (id ? list.find((x) => x.id === id)?.name ?? "—" : "—");
  const exportQs = new URLSearchParams(Object.entries({ q: sp.q, year: sp.year, department: sp.department, section: sp.section, status: sp.status }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader
        title="الطلاب"
        description="الطلاب لا يملكون حسابات؛ يُدار كل طالب بكود فريد يُولد تلقائيًا."
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "الطلاب" }]}
        actions={
          <>
            <Button asChild variant="outline"><a href={`/api/students/export?${exportQs}`}><Download /> تصدير</a></Button>
            {hasPermission(actor, "students.import") && <Button asChild variant="outline"><Link href="/students/import"><FileSpreadsheet /> استيراد Excel</Link></Button>}
            {hasPermission(actor, "students.create") && <Button asChild><Link href="/students/new"><Plus /> إضافة طالب</Link></Button>}
          </>
        }
      />
      <Section>
        <FilterBar
          searchPlaceholder="بحث بالاسم أو الكود أو رقم القيد…"
          selects={[
            { name: "year", label: "السنوات", options: years.map((y) => ({ value: y.id, label: y.name })) },
            { name: "department", label: "التخصصات", options: depts.map((d) => ({ value: d.id, label: d.name })) },
            ...(sections.length ? [{ name: "section", label: "الشعب", options: sections.map((s) => ({ value: s.id, label: `${s.name} — ${n(st.years, s.academicYear)}` })) }] : []),
            { name: "status", label: "الحالة", allLabel: "النشطون", options: [{ value: "archived", label: "المؤرشفون" }, { value: "all", label: "الكل" }] },
          ]}
        />
        {data.items.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="لا يوجد طلاب مطابقون"
            description={sp.q || sp.year ? "جرّب تغيير الفلاتر." : "أضف طالبًا يدويًا أو استورد قائمة من Excel."}
            action={hasPermission(actor, "students.create") ? <Button asChild size="sm"><Link href="/students/new"><Plus /> إضافة طالب</Link></Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>السنة</TableHead>
                <TableHead>التخصص</TableHead>
                <TableHead className="hidden md:table-cell">الشعبة</TableHead>
                <TableHead className="hidden md:table-cell">رقم القيد</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell data-cell="subtitle" className="ltr font-mono text-xs font-semibold text-primary">
                    <Link href={`/students/${s.id}`} className="hover:underline">{s.code}</Link>
                  </TableCell>
                  <TableCell data-cell="title" className="font-medium">
                    <Link href={`/students/${s.id}`} className="hover:text-primary">{s.fullName}</Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{n(st.years, s.academicYear)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{n(st.departments, s.department)}</TableCell>
                  <TableCell className="hidden md:table-cell">{n(st.sections, s.section)}</TableCell>
                  <TableCell className="ltr hidden text-start text-xs md:table-cell">{s.registrationNumber ?? "—"}</TableCell>
                  <TableCell data-cell="trailing">{s.status === "active" ? <Badge variant="success">نشط</Badge> : <Badge variant="muted">مؤرشف</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} />
      </Section>
    </>
  );
}
