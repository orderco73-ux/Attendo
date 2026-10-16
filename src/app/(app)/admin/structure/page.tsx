import { requireActor } from "@/server/auth/session";
import { getStructure } from "@/server/services/academic";
import { PageHeader } from "@/components/shared/page";
import { StructureManager } from "./structure-manager";

export const metadata = { title: "الهيكل الأكاديمي" };

export default async function StructurePage() {
  await requireActor(["admin"]);
  const structure = await getStructure();
  return (
    <>
      <PageHeader title="الهيكل الأكاديمي" description="الكليات والسنوات الدراسية والأقسام/التخصصات والشُعب." breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "الهيكل الأكاديمي" }]} />
      <StructureManager structure={structure} />
    </>
  );
}
