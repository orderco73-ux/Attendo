import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { hasPermission } from "@/server/authz/policy";
import { listImportJobs, IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "@/server/services/imports";
import { getStructure } from "@/server/services/academic";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/time";
import { UploadForm } from "./upload-form";

export const metadata = { title: "استيراد الطلاب" };

const STATUS: Record<string, [string, "muted" | "warning" | "success" | "danger"]> = {
  ready: ["جاهز للاستيراد", "warning"],
  processing: ["قيد التنفيذ", "warning"],
  completed: ["مكتمل", "success"],
  cancelled: ["ملغى", "muted"],
};

export default async function ImportPage() {
  const actor = await requireActor();
  if (!hasPermission(actor, "students.import")) redirect("/dashboard?denied=1");
  const [jobs, structure] = await Promise.all([listImportJobs(actor), getStructure()]);
  const colleges = structure.colleges.filter((c) => c.active && (!actor.staff || actor.staff.scope.college === c.id));
  return (
    <>
      <PageHeader title="استيراد الطلاب من Excel" description="ارفع الملف، راجع المعاينة، ثم أكد الاستيراد. لا يتم إنشاء أي طالب قبل التأكيد." breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { href: "/students", label: "الطلاب" }, { label: "استيراد" }]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="1. رفع الملف" className="lg:col-span-2">
          <div className="p-5">
            <UploadForm colleges={colleges.map((c) => ({ id: c.id, name: c.name }))} />
          </div>
        </Section>
        <Section title="القالب والتعليمات">
          <div className="grid gap-3 p-5 text-sm">
            <Button asChild variant="secondary">
              <a href={`/api/students/template${colleges[0] ? `?college=${colleges[0].id}` : ""}`}><Download /> تحميل قالب Excel</a>
            </Button>
            <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
              <li>الأعمدة: {IMPORT_COLUMNS.map((c) => c.header + (c.required ? "*" : "")).join("، ")}.</li>
              <li>صيغة .xlsx فقط، بحد أقصى 2 ميجابايت و{MAX_IMPORT_ROWS.toLocaleString("ar-EG")} صف.</li>
              <li>أسماء السنوات والتخصصات يجب أن تطابق القيم في الورقة الثانية من القالب.</li>
              <li>التكرار يُكتشف برقم القيد إن وجد، وإلا بالاسم الكامل (بعد توحيد الهمزات والتاء المربوطة).</li>
              <li>إعادة رفع نفس القائمة لا تنشئ طلابًا مكررين.</li>
            </ul>
          </div>
        </Section>
      </div>
      <Section title="عمليات الاستيراد الأخيرة" className="mt-6">
        {jobs.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="لا توجد عمليات استيراد بعد" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الملف</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الصفوف</TableHead>
                <TableHead>تم إنشاؤهم</TableHead>
                <TableHead>مرفوض / مكرر</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={String(j._id)}>
                  <TableCell data-cell="title"><Link className="font-medium text-primary hover:underline" href={`/students/import/${j._id}`}>{j.fileName}</Link></TableCell>
                  <TableCell data-cell="subtitle" className="text-xs text-muted-foreground">{formatDateTime(j.createdAt)}</TableCell>
                  <TableCell data-label="صفوف" className="tabular-nums">{j.totals.rows}</TableCell>
                  <TableCell data-label="أُنشئ" className="tabular-nums text-success">{j.totals.created}</TableCell>
                  <TableCell data-label="مرفوض/مكرر" className="tabular-nums">{j.totals.invalid} / {j.totals.duplicate}</TableCell>
                  <TableCell data-cell="trailing"><Badge variant={STATUS[j.status][1]}>{STATUS[j.status][0]}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
