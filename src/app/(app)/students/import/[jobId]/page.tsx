import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { getImportJob } from "@/server/services/imports";
import { AppError } from "@/server/errors";
import { PageHeader, Section, StatStrip, EmptyState } from "@/components/shared/page";
import { ParamTabs } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { ImportRunner } from "./runner";

export const metadata = { title: "معاينة الاستيراد" };

const ROW: Record<string, [string, "success" | "danger" | "warning" | "default" | "muted"]> = {
  valid: ["صالح", "default"],
  created: ["تم الإنشاء", "success"],
  invalid: ["مرفوض", "danger"],
  duplicate: ["مكرر", "warning"],
  failed: ["فشل", "danger"],
};

export default async function ImportJobPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const { jobId } = await params;
  const sp = await searchParams;
  let data;
  try {
    data = await getImportJob(actor, jobId, { status: sp.status, page: Number(sp.page) || 1 });
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const { job, rows, total, page, pageSize } = data;
  const t = job.totals;
  const pendingValid = t.valid - t.created;
  const hasErrors = t.invalid + t.duplicate + t.failed > 0;
  return (
    <>
      <PageHeader
        title={`استيراد: ${job.fileName}`}
        description="راجع النتائج قبل التأكيد. الصفوف المرفوضة أو المكررة لن تُستورد ويمكن تحميلها مع أسبابها."
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { href: "/students", label: "الطلاب" }, { href: "/students/import", label: "استيراد" }, { label: "معاينة" }]}
        actions={hasErrors && <Button asChild variant="outline"><a href={`/api/imports/${jobId}/errors`}><Download /> تقرير الأخطاء</a></Button>}
      />
      <StatStrip
        items={[
          { label: "إجمالي الصفوف", value: t.rows },
          { label: "صالحة للاستيراد", value: t.valid, tone: "primary" },
          { label: "تم إنشاؤهم", value: t.created, tone: "success" },
          { label: "مرفوضة", value: t.invalid, tone: t.invalid ? "danger" : "default" },
          { label: "مكررة", value: t.duplicate, tone: t.duplicate ? "warning" : "default" },
          { label: "فشل", value: t.failed, tone: t.failed ? "danger" : "default" },
        ]}
      />
      <div className="mt-6">
        <ImportRunner jobId={jobId} status={job.status} pendingValid={pendingValid} totals={t} />
      </div>
      <Section className="mt-6" title="الصفوف">
        <div className="border-b-[0.5px] px-4 py-3">
          <ParamTabs
            name="status"
            options={[
              { value: "all", label: "الكل", count: t.rows },
              { value: "valid", label: "صالح", count: pendingValid },
              { value: "created", label: "تم الإنشاء", count: t.created },
              { value: "invalid", label: "مرفوض", count: t.invalid },
              { value: "duplicate", label: "مكرر", count: t.duplicate },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="لا توجد صفوف في هذا التصنيف" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">الصف</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>السنة</TableHead>
                <TableHead>التخصص</TableHead>
                <TableHead>رقم القيد</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r._id)}>
                  <TableCell className="tabular-nums text-muted-foreground">{r.rowNumber}</TableCell>
                  <TableCell className="font-medium">{r.data.fullName || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{r.data.academicYear}</TableCell>
                  <TableCell>{r.data.department}</TableCell>
                  <TableCell className="ltr text-start text-xs">{r.data.registrationNumber}</TableCell>
                  <TableCell>
                    <Badge variant={ROW[r.status][1]}>{ROW[r.status][0]}</Badge>
                    {r.studentCode && <span className="ltr ms-2 font-mono text-xs text-primary">{r.studentCode}</span>}
                  </TableCell>
                  <TableCell className="max-w-sm text-xs text-destructive">{r.errors.join(" · ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Section>
    </>
  );
}
