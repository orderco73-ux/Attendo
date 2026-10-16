import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { subjectMatrix, type MatrixCell } from "@/server/services/reports";
import { AppError } from "@/server/errors";
import { Section, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/shared/print-button";
import { formatShortDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { reportFilters } from "@/lib/report-filters";

const CELL: Record<MatrixCell, { sym: string; cls: string; label: string }> = {
  present: { sym: "✓", cls: "bg-success-soft text-success", label: "حاضر" },
  absent: { sym: "✗", cls: "bg-danger-soft text-destructive", label: "غائب" },
  excused: { sym: "ع", cls: "bg-warning-soft text-warning", label: "بعذر" },
  na: { sym: "—", cls: "text-muted-foreground", label: "غير محتسبة" },
  pending: { sym: "·", cls: "text-muted-foreground", label: "لم تُغلق بعد" },
};

export default async function MatrixPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  let m;
  try {
    m = await subjectMatrix(actor, id, { ...reportFilters(sp), pageSize: 50 });
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  return (
    <Section
      className="print-area"
      title="مصفوفة الحضور"
      description="الطلاب مقابل تواريخ المحاضرات (حتى 80 محاضرة؛ استخدم فلتر التاريخ لفترات أطول)."
      actions={
        <>
          <PrintButton />
          <Button asChild size="sm" variant="outline"><a href={`/api/reports/matrix/${id}?${qs}`}><Download /> Excel</a></Button>
        </>
      }
    >
      <FilterBar searchPlaceholder="بحث بالاسم أو الكود…" extra={[{ name: "from", label: "من", type: "date" }, { name: "to", label: "إلى", type: "date" }]} />
      <div className="flex flex-wrap gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
        {Object.values(CELL).map((c) => (
          <span key={c.label} className="flex items-center gap-1">
            <span className={cn("grid size-5 place-items-center rounded font-bold", c.cls)}>{c.sym}</span>
            {c.label}
          </span>
        ))}
      </div>
      {m.rows.length === 0 || m.lectures.length === 0 ? (
        <EmptyState title="لا توجد بيانات كافية" description={m.lectures.length === 0 ? "لا توجد محاضرات في الفترة المحددة." : "لا يوجد طلاب مسجلون."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface">
              <tr className="border-b">
                <th className="sticky right-0 z-10 bg-surface px-3 py-2 text-start text-xs font-semibold text-muted-foreground">الطالب</th>
                {m.lectures.map((l) => (
                  <th key={l.id} className="min-w-11 px-1 py-2 text-center text-[11px] font-medium text-muted-foreground">
                    <Link href={`/lectures/${l.id}`} className="block hover:text-primary" title={l.title}>
                      <span className="ltr block">{formatShortDate(l.startsAt).slice(5)}</span>
                    </Link>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">حضور</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">غياب</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.studentId} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="sticky right-0 z-10 bg-card px-3 py-1.5 whitespace-nowrap">
                    <div className="max-w-52 truncate font-medium">{r.fullName}</div>
                    <div className="ltr text-start font-mono text-[11px] text-primary">{r.code}</div>
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="px-1 py-1 text-center">
                      <span title={CELL[c].label} className={cn("inline-grid size-6 place-items-center rounded text-xs font-bold", CELL[c].cls)}>{CELL[c].sym}</span>
                    </td>
                  ))}
                  <td className="px-2 text-center tabular-nums text-success">{r.attended}</td>
                  <td className="px-2 text-center tabular-nums text-destructive">{r.absences}</td>
                  <td className="px-2 text-center tabular-nums">{r.percentage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={m.page} pageSize={m.pageSize} total={m.total} />
    </Section>
  );
}
