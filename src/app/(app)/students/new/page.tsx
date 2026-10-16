import { redirect } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { hasPermission } from "@/server/authz/policy";
import { getStructure } from "@/server/services/academic";
import { PageHeader, Section } from "@/components/shared/page";
import { StudentForm } from "../student-form";
import { scopedYears } from "../scope";

export const metadata = { title: "إضافة طالب" };

export default async function NewStudentPage() {
  const actor = await requireActor();
  if (!hasPermission(actor, "students.create")) redirect("/dashboard?denied=1");
  const structure = await getStructure();
  return (
    <>
      <PageHeader title="إضافة طالب" description="سيتم توليد كود الطالب تلقائيًا بعد الحفظ." breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { href: "/students", label: "الطلاب" }, { label: "إضافة" }]} />
      <Section className="max-w-3xl">
        <div className="p-5">
          <StudentForm structure={structure} years={scopedYears(actor, structure)} />
        </div>
      </Section>
    </>
  );
}
