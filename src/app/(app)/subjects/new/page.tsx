import { requireActor } from "@/server/auth/session";
import { getStructure } from "@/server/services/academic";
import { listUserOptions } from "@/server/services/users";
import { getSettings } from "@/server/services/settings";
import { PageHeader } from "@/components/shared/page";
import { SubjectForm } from "../subject-form";

export const metadata = { title: "إضافة مادة" };

export default async function NewSubjectPage() {
  const actor = await requireActor(["admin"]);
  const [structure, doctors, settings] = await Promise.all([getStructure(), listUserOptions(actor, "doctor"), getSettings()]);
  return (
    <>
      <PageHeader title="إضافة مادة" breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { href: "/subjects", label: "المواد" }, { label: "إضافة" }]} />
      <SubjectForm
        structure={structure}
        doctors={doctors}
        initial={{
          name: "",
          code: "",
          description: "",
          college: structure.colleges[0]?.id ?? "",
          academicYears: [],
          departments: [],
          sections: [],
          doctors: [],
          requiresEnrollmentApproval: settings.defaultRequiresEnrollmentApproval,
          active: true,
        }}
      />
    </>
  );
}
