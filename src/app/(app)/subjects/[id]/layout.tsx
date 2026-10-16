import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { getCurrentActor, requireActor } from "@/server/auth/session";
import { getSubjectFor, subjectCapabilities } from "@/server/services/subjects";
import { AppError } from "@/server/errors";
import { isAdmin } from "@/server/authz/policy";
import { User } from "@/server/db/models";
import { isObjectId } from "@/server/ids";
import { connectDB } from "@/server/db/connect";
import { PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { SubjectTabs } from "./tabs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Only reveal the subject name to actors who may view it.
  try {
    await connectDB();
    const actor = await getCurrentActor();
    if (!actor || !isObjectId(id)) return { title: "المادة" };
    const s = await getSubjectFor(actor, id, "view");
    return { title: s.name };
  } catch {
    return { title: "المادة" };
  }
}

export default async function SubjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  let subject;
  try {
    subject = await getSubjectFor(actor, id, "view");
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const caps = subjectCapabilities(actor, subject);
  const doctors = await User.find({ _id: { $in: subject.doctors } }).select("name").lean();
  const tabs = [
    { href: `/subjects/${id}`, label: "الطلاب المسجلون" },
    { href: `/subjects/${id}/lectures`, label: "المحاضرات" },
    ...(caps.requestEnrollment ? [{ href: `/subjects/${id}/enroll`, label: caps.manage ? "تسجيل طلاب" : "طلب تسجيل" }] : []),
    ...(caps.manage ? [{ href: `/subjects/${id}/requests`, label: "طلبات التسجيل" }] : []),
    ...(caps.reports ? [{ href: `/subjects/${id}/report`, label: "تقرير الحضور" }, { href: `/subjects/${id}/matrix`, label: "مصفوفة الحضور" }] : []),
    ...(caps.manage ? [{ href: `/subjects/${id}/settings`, label: "المساعدون" }] : []),
  ];
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {subject.name}
            <span className="ltr rounded-xl bg-brand-soft px-2 py-0.5 font-mono text-sm text-primary">{subject.code}</span>
            {!subject.active && <Badge variant="muted">متوقفة</Badge>}
          </span>
        }
        description={doctors.length ? doctors.map((d) => (/^د\.?\s/.test(d.name) ? d.name : `د. ${d.name}`)).join("، ") : "لم يُسند دكتور بعد"}
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { href: "/subjects", label: "المواد" }, { label: subject.name }]}
        actions={isAdmin(actor) && <Button asChild variant="outline" size="sm"><Link href={`/subjects/${id}/edit`}><Pencil /> تعديل المادة</Link></Button>}
        className="mb-4"
      />
      <SubjectTabs tabs={tabs} />
      <div className="mt-5">{children}</div>
    </>
  );
}
