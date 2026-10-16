import { Stethoscope } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import { Subject } from "@/server/db/models";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { FilterBar, ParamTabs } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { ActiveBadge } from "@/components/shared/badges";
import { formatDateTime } from "@/lib/time";
import { AccountDialog, ToggleActive } from "./account-dialog";

export const metadata = { title: "الدكاترة والمديرون" };

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor(["admin"]);
  const sp = await searchParams;
  const role = sp.role === "admin" ? "admin" : "doctor";
  const data = await listUsers(actor, { role, q: sp.q, page: Number(sp.page) || 1, status: sp.status });
  const subjectCounts = role === "doctor" ? await Subject.aggregate<{ _id: unknown; n: number }>([{ $unwind: "$doctors" }, { $group: { _id: "$doctors", n: { $sum: 1 } } }]) : [];
  const countFor = (id: string) => subjectCounts.find((c) => String(c._id) === id)?.n ?? 0;
  return (
    <>
      <PageHeader
        title="الدكاترة والمديرون"
        description="حسابات الدكاترة تُنشأ هنا ثم تُسند لهم المواد من صفحة المواد."
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "الدكاترة" }]}
        actions={<AccountDialog role={role} />}
      />
      <ParamTabs name="role" className="mb-4" options={[{ value: "doctor", label: "الدكاترة" }, { value: "admin", label: "مديرو النظام" }]} />
      <Section>
        <FilterBar searchPlaceholder="بحث بالاسم أو البريد…" selects={[{ name: "status", label: "الحالات", options: [{ value: "active", label: "نشط" }, { value: "inactive", label: "معطل" }] }]} />
        {data.items.length === 0 ? (
          <EmptyState icon={Stethoscope} title={role === "doctor" ? "لا يوجد دكاترة" : "لا يوجد مديرون"} description="أضف حسابًا جديدًا للبدء." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                {role === "doctor" && <TableHead>المواد</TableHead>}
                <TableHead>آخر دخول</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell data-cell="title" className="font-medium">{u.name}</TableCell>
                  <TableCell data-cell="subtitle" className="ltr text-start text-muted-foreground">{u.email}</TableCell>
                  {role === "doctor" && <TableCell data-label="مواد" className="tabular-nums">{countFor(u.id)}</TableCell>}
                  <TableCell className="text-xs text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "لم يسجل دخول"}</TableCell>
                  <TableCell><ActiveBadge active={u.active} /></TableCell>
                  <TableCell data-cell="trailing">
                    <div className="flex justify-end gap-1">
                      <AccountDialog role={role} user={{ id: u.id, name: u.name, email: u.email, phone: u.phone ?? "", active: u.active }} />
                      {u.id !== actor.id && <ToggleActive id={u.id} active={u.active} name={u.name} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} />
      </Section>
    </>
  );
}
