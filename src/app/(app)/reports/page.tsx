import Link from "next/link";
import { redirect } from "next/navigation";
import { PieChart } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { hasPermission, isAdmin, isDoctor } from "@/server/authz/policy";
import { groupReport } from "@/server/services/reports";
import { getStructure } from "@/server/services/academic";
import { getSettings } from "@/server/services/settings";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { PercentBadge } from "@/components/shared/badges";
import { PrintButton } from "@/components/shared/print-button";
import { reportFilters } from "@/lib/report-filters";

export const metadata = { title: "التقارير" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  if (!isAdmin(actor) && !isDoctor(actor) && !hasPermission(actor, "reports.view")) redirect("/dashboard?denied=1");
  const sp = await searchParams;
  const settings = await getSettings();
  const f = { ...reportFilters(sp), below: settings.lowAttendanceThreshold };
  const [rows, st] = await Promise.all([groupReport(actor, f), getStructure()]);
  const sc = actor.staff?.scope;
  const years = st.years.filter((y) => !sc || (y.college === sc.college && (!sc.academicYears.length || sc.academicYears.includes(y.id))));
  const depts = st.departments.filter((d) => !sc || (d.college === sc.college && (!sc.departments.length || sc.departments.includes(d.id))));
  return (
    <>
      <PageHeader
        title="التقارير"
        description="ملخص الحضور لكل مادة حسب الفرقة/التخصص والفترة. افتح أي مادة لعرض التقرير التفصيلي والمصفوفة والتصدير."
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "التقارير" }]}
        actions={<PrintButton />}
      />
      <Section className="print-area" title="ملخص المواد" description={`المحاضرات المغلقة فقط · منخفض = أقل من ${settings.lowAttendanceThreshold}%`}>
        <FilterBar
          searchPlaceholder="بحث عن طالب داخل الإحصاء…"
          selects={[
            { name: "year", label: "السنوات", options: years.map((y) => ({ value: y.id, label: y.name })) },
            { name: "department", label: "التخصصات", options: depts.map((d) => ({ value: d.id, label: d.name })) },
          ]}
          extra={[{ name: "from", label: "من", type: "date" }, { name: "to", label: "إلى", type: "date" }]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={PieChart} title="لا توجد بيانات" description="لا توجد مواد بها طلاب مطابقون للفلاتر." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المادة</TableHead>
                <TableHead className="text-center">الطلاب</TableHead>
                <TableHead className="text-center">محاضرات مغلقة</TableHead>
                <TableHead className="text-center">حضور</TableHead>
                <TableHead className="text-center">غياب</TableHead>
                <TableHead className="text-center">النسبة</TableHead>
                <TableHead className="text-center">منخفض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.subjectId}>
                  <TableCell data-cell="title">
                    <Link href={`/subjects/${r.subjectId}/report?${new URLSearchParams(Object.entries({ year: sp.year, department: sp.department, from: sp.from, to: sp.to }).filter(([, v]) => v) as [string, string][])}`} className="font-medium text-primary hover:underline">
                      {r.name}
                    </Link>
                    <div className="ltr text-start font-mono text-xs text-muted-foreground">{r.code}</div>
                  </TableCell>
                  <TableCell data-label="طلاب" className="text-center tabular-nums">{r.students}</TableCell>
                  <TableCell data-label="محاضرات" className="text-center tabular-nums">{r.lectures}</TableCell>
                  <TableCell data-label="حضور" className="text-center tabular-nums text-success">{r.attended}</TableCell>
                  <TableCell data-label="غياب" className="text-center tabular-nums text-destructive">{r.absences}</TableCell>
                  <TableCell data-cell="trailing" className="text-center"><PercentBadge value={r.percentage} threshold={settings.lowAttendanceThreshold} /></TableCell>
                  <TableCell data-label="منخفض" className="text-center tabular-nums">{r.below}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
