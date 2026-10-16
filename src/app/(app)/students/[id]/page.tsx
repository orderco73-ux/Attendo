import Link from "next/link";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { hasPermission } from "@/server/authz/policy";
import { studentOverview } from "@/server/services/students";
import { getStructure } from "@/server/services/academic";
import { studentQrPayload } from "@/server/qr";
import { AppError } from "@/server/errors";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { Badge } from "@/components/ui/display";
import { EnrollmentBadge } from "@/components/shared/badges";
import { formatDate } from "@/lib/time";
import { StudentForm } from "../student-form";
import { scopedYears } from "../scope";
import { ArchiveButton, PrintButton } from "./client";

export const metadata = { title: "ملف الطالب" };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  let data;
  try {
    data = await studentOverview(actor, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const { student: s, enrollments, presentCount } = data;
  const structure = await getStructure();
  const n = (list: { id: string; name: string }[], v: unknown) => list.find((x) => x.id === String(v))?.name ?? "—";
  const qr = await QRCode.toDataURL(studentQrPayload(s.code), { margin: 1, width: 220, errorCorrectionLevel: "M", color: { dark: "#0F172A", light: "#FFFFFF" } });
  const canEdit = hasPermission(actor, "students.edit");
  const canArchive = hasPermission(actor, "students.archive");
  const archived = s.status === "archived";

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {s.fullName}
            <span className="ltr rounded-xl bg-brand-soft px-2 py-0.5 font-mono text-base text-primary">{s.code}</span>
            {archived && <Badge variant="muted">مؤرشف</Badge>}
          </span>
        }
        description={`${n(structure.years, s.academicYear)} — ${n(structure.departments, s.department)} · أضيف في ${formatDate(s.createdAt)}`}
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { href: "/students", label: "الطلاب" }, { label: s.code }]}
        actions={
          canArchive && (
            <ArchiveButton id={String(s._id)} archived={archived} trigger={archived ? <><ArchiveRestore /> استعادة</> : <><Archive /> أرشفة</>} />
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          {canEdit && !archived ? (
            <Section title="تعديل البيانات">
              <div className="p-5">
                <StudentForm
                  structure={structure}
                  id={String(s._id)}
                  years={scopedYears(actor, structure)}
                  initial={{
                    fullName: s.fullName,
                    registrationNumber: s.registrationNumber ?? "",
                    academicYear: String(s.academicYear),
                    department: String(s.department),
                    section: s.section ? String(s.section) : "",
                    notes: s.notes ?? "",
                    allowSameName: false,
                  }}
                />
              </div>
            </Section>
          ) : (
            <Section title="البيانات">
              <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">السنة</dt><dd className="font-medium">{n(structure.years, s.academicYear)}</dd></div>
                <div><dt className="text-muted-foreground">التخصص</dt><dd className="font-medium">{n(structure.departments, s.department)}</dd></div>
                <div><dt className="text-muted-foreground">الشعبة</dt><dd className="font-medium">{s.section ? n(structure.sections, s.section) : "—"}</dd></div>
                <div><dt className="text-muted-foreground">رقم القيد</dt><dd className="ltr text-start font-medium">{s.registrationNumber ?? "—"}</dd></div>
              </dl>
            </Section>
          )}
          <Section title="المواد المسجل بها" description={`إجمالي مرات الحضور المسجلة: ${presentCount}`}>
            {enrollments.length === 0 ? (
              <EmptyState title="غير مسجل في أي مادة" className="py-10" />
            ) : (
              <ul className="divide-y-[0.5px]">
                {enrollments.map((e) => (
                  <li key={String(e._id)} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <Link href={`/subjects/${e.subject._id}`} className="font-medium hover:text-primary">
                      {e.subject.name} <span className="ltr text-xs text-muted-foreground">{e.subject.code}</span>
                    </Link>
                    <EnrollmentBadge status={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <Section title="بطاقة الطالب (QR)" description="تُطبع وتُسلم للطالب. تثبت امتلاك البطاقة وليس الحضور الفعلي.">
          <div className="print-area flex flex-col items-center gap-3 p-6">
            <div id="student-card" className="w-full max-w-64 rounded-[22px] bg-card p-5 text-center shadow-pop ring-[0.5px] ring-border">
              <div className="text-xs text-muted-foreground">Attendo nosait</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`رمز QR للطالب ${s.code}`} className="mx-auto my-2 size-44" />
              <div className="font-semibold">{s.fullName}</div>
              <div className="ltr font-mono text-sm text-primary">{s.code}</div>
            </div>
            <PrintButton />
          </div>
        </Section>
      </div>
    </>
  );
}
