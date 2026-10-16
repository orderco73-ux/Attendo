import { AppShell } from "@/components/layout/app-shell";
import { requireActor } from "@/server/auth/session";
import { buildNav } from "@/lib/nav";
import { ROLE_LABELS, STAFF_KIND_LABELS } from "@/lib/constants";
import { getSettings } from "@/server/services/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const settings = await getSettings();
  const roleLabel = actor.staff ? actor.staff.title || STAFF_KIND_LABELS[actor.staff.kind] : ROLE_LABELS[actor.role];
  return (
    <AppShell groups={buildNav(actor)} user={{ name: actor.name, email: actor.email, roleLabel }} institution={settings.institutionName}>
      {children}
    </AppShell>
  );
}
