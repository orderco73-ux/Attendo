import { requireActor } from "@/server/auth/session";
import { PageHeader, Section } from "@/components/shared/page";
import { PasswordForm } from "./password-form";

export const metadata = { title: "حسابي" };

export default async function AccountPage() {
  const actor = await requireActor();
  return (
    <>
      <PageHeader title="حسابي" description={actor.email} breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "حسابي" }]} />
      <Section title="تغيير كلمة المرور" description="سيتم تسجيل خروجك من جميع الأجهزة الأخرى." className="max-w-xl">
        <div className="p-5">
          <PasswordForm />
        </div>
      </Section>
    </>
  );
}
