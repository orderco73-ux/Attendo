import { requireActor } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import { PageHeader } from "@/components/shared/page";
import { SettingsForm } from "./settings-form";
import { APP_TIMEZONE } from "@/lib/time";

export const metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  await requireActor(["admin"]);
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="إعدادات النظام" description={`المنطقة الزمنية للمؤسسة: ${APP_TIMEZONE} (تُضبط عبر متغير البيئة APP_TIMEZONE).`} breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "الإعدادات" }]} />
      <SettingsForm initial={settings} />
    </>
  );
}
