import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { getStructure } from "@/server/services/academic";
import { listUserOptions } from "@/server/services/users";
import { Subject } from "@/server/db/models";
import { isObjectId } from "@/server/ids";
import { SubjectForm } from "../../subject-form";

export const metadata = { title: "تعديل مادة" };

export default async function EditSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(["admin"]);
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  const s = await Subject.findById(id).lean();
  if (!s) notFound();
  const [structure, doctors] = await Promise.all([getStructure(), listUserOptions(actor, "doctor")]);
  return (
    <>
      <SubjectForm
        structure={structure}
        doctors={doctors}
        id={id}
        initial={{
          name: s.name,
          code: s.code,
          description: s.description ?? "",
          college: String(s.college),
          academicYears: s.eligibility.academicYears.map(String),
          departments: s.eligibility.departments.map(String),
          sections: s.eligibility.sections.map(String),
          doctors: s.doctors.map(String),
          requiresEnrollmentApproval: s.requiresEnrollmentApproval,
          active: s.active,
        }}
      />
    </>
  );
}
