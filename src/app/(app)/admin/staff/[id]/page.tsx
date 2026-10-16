import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { getStructure } from "@/server/services/academic";
import { User } from "@/server/db/models";
import { isObjectId } from "@/server/ids";
import { PageHeader } from "@/components/shared/page";
import { StaffForm, type StaffFormValues } from "./staff-form";

export const metadata = { title: "عضو الطاقم" };

export default async function StaffEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor(["admin"]);
  const { id } = await params;
  const structure = await getStructure();
  let initial: StaffFormValues | null = null;
  if (id !== "new") {
    if (!isObjectId(id)) notFound();
    const u = await User.findOne({ _id: id, role: "staff" }).lean();
    if (!u) notFound();
    initial = {
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      password: "",
      active: u.active,
      kind: u.staff?.kind ?? "class_leader",
      title: u.staff?.title ?? "",
      permissions: u.staff?.permissions ?? [],
      scope: {
        college: u.staff?.scope?.college ? String(u.staff.scope.college) : structure.colleges[0]?.id ?? "",
        academicYears: (u.staff?.scope?.academicYears ?? []).map(String),
        departments: (u.staff?.scope?.departments ?? []).map(String),
        sections: (u.staff?.scope?.sections ?? []).map(String),
      },
    };
  }
  return (
    <>
      <PageHeader
        title={initial ? `تعديل: ${initial.name}` : "إضافة عضو طاقم"}
        description="حدد الدور والنطاق الأكاديمي والصلاحيات. يتم فرض كل ذلك على الخادم."
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { href: "/admin/staff", label: "الطاقم" }, { label: initial ? "تعديل" : "إضافة" }]}
      />
      <StaffForm structure={structure} id={id === "new" ? undefined : id} initial={initial} />
    </>
  );
}
