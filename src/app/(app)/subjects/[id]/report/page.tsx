import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { subjectReport } from "@/server/services/reports";
import { reportFilters } from "@/lib/report-filters";
import { getStructure } from "@/server/services/academic";
import { getSettings } from "@/server/services/settings";
import { AppError } from "@/server/errors";
import { Section, StatStrip, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { PercentBadge } from "@/components/shared/badges";
import { PrintButton } from "@/components/shared/print-button";
import { SortHeader } from "@/components/shared/sort-header";
import { formatDateTime } from "@/lib/time";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const f = reportFilters(sp);
  let r;
  try {
    r = await subjectReport(actor, id, f);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const [st, settings] = await Promise.all([getStructure(), getSettings()]);
  const n = (list: { id: string; name: string }[], v: string | null) => (v ? list.find((x) => x.id === v)?.name ?? "—" : "—");
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  const el = r.subject.eligibility;
  const years = st.years.filter((y) => y.college === String(r.subject.college) && (!el.academicYears.length || el.academicYears.map(String).includes(y.id)));
  const depts = st.departments.filter((d) => d.college === String(r.subject.college) && (!el.departments.length || el.departments.map(String).includes(d.id)));
  const low = r.allRows.filter((x) => x.percentage != null && x.percentage < settings.lowAttendanceThreshold).length;
  return (
    <div className="grid gap-5">
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">تقرير حضور: {r.subject.name} ({r.subject.code})</h2>
        <p className="text-xs">تاريخ الطباعة: {formatDateTime(new Date())}{f.from || f.to ? ` — الفترة: ${f.from ?? "…"} إلى ${f.to ?? "…"}` : ""}</p>
      </div>
      <StatStrip
        items={[
          { label: "الطلاب", value: r.total },
          { label: "المحاضرات المغلقة", value: r.closedCount },
          { label: "إجمالي الحضور", value: r.totals.attended, tone: "success" },
          { label: "إجمالي الغياب", value: r.totals.absences, tone: "danger" },
          { label: "متوسط نسبة الحضور", value: r.totals.percentage != null ? `${r.totals.percentage}%` : "—", tone: "primary" },
          { label: `أقل من ${settings.lowAttendanceThreshold}%`, value: low, tone: low ? "warning" : "default" },
        ]}
      />
      <Section
        className="print-area"
        title="حضور وغياب الطلاب"
        description="يُحتسب الغياب فقط للمحاضرات المغلقة. الملغاة لا تُحتسب. النسبة = الحضور ÷ (المحتسبة − بعذر)، مقربة لرقم عشري واحد."
        actions={
          <>
            <PrintButton />
            <Button asChild size="sm" variant="outline"><a href={`/api/reports/subject/${id}?${qs}`}><Download /> Excel</a></Button>
          </>
        }
      >
        <FilterBar
          searchPlaceholder="بحث بالاسم أو الكود…"
          selects={[
            { name: "year", label: "السنوات", options: years.map((y) => ({ value: y.id, label: y.name })) },
            { name: "department", label: "التخصصات", options: depts.map((d) => ({ value: d.id, label: d.name })) },
            { name: "below", label: "النسبة", allLabel: "كل النسب", options: [50, 60, 75, 85].map((x) => ({ value: String(x), label: `أقل من ${x}%` })) },
          ]}
          extra={[{ name: "from", label: "من", type: "date" }, { name: "to", label: "إلى", type: "date" }]}
        />
        {r.rows.length === 0 ? (
          <EmptyState title="لا توجد بيانات" description="لا يوجد طلاب مسجلون مطابقون للفلاتر." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader field="code">الكود</SortHeader></TableHead>
                <TableHead><SortHeader field="name">الاسم</SortHeader></TableHead>
                <TableHead>السنة</TableHead>
                <TableHead>التخصص</TableHead>
                <TableHead className="text-center">المحتسبة</TableHead>
                <TableHead className="text-center">حضور</TableHead>
                <TableHead className="text-center">بعذر</TableHead>
                <TableHead className="text-center"><SortHeader field="absences">غياب</SortHeader></TableHead>
                <TableHead className="text-center"><SortHeader field="percentage">النسبة</SortHeader></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.rows.map((x) => (
                <TableRow key={x.studentId}>
                  <TableCell data-cell="subtitle" className="ltr font-mono text-xs font-semibold text-primary">{x.code}</TableCell>
                  <TableCell data-cell="title" className="font-medium">{x.fullName}</TableCell>
                  <TableCell data-cell="hide" className="whitespace-nowrap">{n(st.years, x.academicYear)}</TableCell>
                  <TableCell data-cell="hide" className="whitespace-nowrap text-muted-foreground">{n(st.departments, x.department)}</TableCell>
                  <TableCell data-label="محتسبة" className="text-center tabular-nums">{x.eligible}</TableCell>
                  <TableCell data-label="حضور" className="text-center tabular-nums text-success">{x.attended}</TableCell>
                  <TableCell data-label="بعذر" className="text-center tabular-nums text-warning">{x.excused}</TableCell>
                  <TableCell data-label="غياب" className="text-center tabular-nums text-destructive">{x.absences}</TableCell>
                  <TableCell data-cell="trailing" className="text-center"><PercentBadge value={x.percentage} threshold={settings.lowAttendanceThreshold} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={r.page} pageSize={r.pageSize} total={r.total} />
      </Section>
    </div>
  );
}
