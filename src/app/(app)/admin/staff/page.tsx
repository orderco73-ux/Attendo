import Link from "next/link";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import { getStructure } from "@/server/services/academic";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@/components/ui/display";
import { ActiveBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { STAFF_KIND_LABELS, type StaffKind } from "@/lib/constants";
import { ToggleActive } from "../doctors/account-dialog";

export const metadata = { title: "الطاقم والصلاحيات" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor(["admin"]);
  const sp = await searchParams;
  const [data, st] = await Promise.all([listUsers(actor, { role: "staff", q: sp.q, page: Number(sp.page) || 1, status: sp.status }), getStructure()]);
  const name = (list: { id: string; name: string }[], ids: string[]) => (ids.length ? ids.map((i) => list.find((x) => x.id === i)?.name ?? "؟").join("، ") : "الكل");
  return (
    <>
      <PageHeader
        title="الطاقم والصلاحيات"
        description="قادة الدفعات وقادة التخصصات وأي أدوار مساعدة، مع نطاق أكاديمي وصلاحيات قابلة للتخصيص."
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "الطاقم" }]}
        actions={<Button asChild><Link href="/admin/staff/new"><Plus /> إضافة عضو</Link></Button>}
      />
      <Section>
        <FilterBar searchPlaceholder="بحث بالاسم أو البريد…" selects={[{ name: "status", label: "الحالات", options: [{ value: "active", label: "نشط" }, { value: "inactive", label: "معطل" }] }]} />
        {data.items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="لا يوجد أعضاء طاقم" description="أضف قائد دفعة أو قائد تخصص وحدد صلاحياته ونطاقه." action={<Button asChild size="sm"><Link href="/admin/staff/new"><Plus /> إضافة عضو</Link></Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>النطاق</TableHead>
                <TableHead>الصلاحيات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="ltr text-start text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{u.staff?.title || STAFF_KIND_LABELS[(u.staff?.kind ?? "custom") as StaffKind]}</Badge>
                  </TableCell>
                  <TableCell className="max-w-64 text-xs text-muted-foreground">
                    {u.staff?.scope.college ? (
                      <>
                        <div>السنوات: {name(st.years, u.staff.scope.academicYears)}</div>
                        <div>الأقسام: {name(st.departments, u.staff.scope.departments)}</div>
                        {u.staff.scope.sections.length > 0 && <div>الشعب: {name(st.sections, u.staff.scope.sections)}</div>}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{u.staff?.permissions.length ?? 0}</TableCell>
                  <TableCell><ActiveBadge active={u.active} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm" aria-label="تعديل"><Link href={`/admin/staff/${u.id}`}><Pencil /></Link></Button>
                      <ToggleActive id={u.id} active={u.active} name={u.name} />
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
