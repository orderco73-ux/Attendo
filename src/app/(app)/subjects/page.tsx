import Link from "next/link";
import { BookOpen, Pencil, Plus } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { isAdmin } from "@/server/authz/policy";
import { listSubjects } from "@/server/services/subjects";
import { getStructure } from "@/server/services/academic";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { ActiveBadge } from "@/components/shared/badges";

export const metadata = { title: "المواد" };

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const [data, st] = await Promise.all([listSubjects(actor, { q: sp.q, page: Number(sp.page) || 1, status: sp.status }), getStructure()]);
  const admin = isAdmin(actor);
  const names = (list: { id: string; name: string }[], ids: string[], all: string) => (ids.length ? ids.map((i) => list.find((x) => x.id === i)?.name ?? "؟").join("، ") : all);
  return (
    <>
      <PageHeader
        title={actor.role === "doctor" ? "موادي" : "المواد"}
        description={admin ? "إنشاء المواد وتحديد الطلاب المؤهلين وإسناد الدكاترة." : "المواد المتاحة لك حسب صلاحياتك."}
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "المواد" }]}
        actions={admin && <Button asChild><Link href="/subjects/new"><Plus /> إضافة مادة</Link></Button>}
      />
      <Section>
        <FilterBar
          searchPlaceholder="بحث باسم أو كود المادة…"
          selects={admin ? [{ name: "status", label: "الحالة", allLabel: "المفعلة", options: [{ value: "inactive", label: "غير المفعلة" }, { value: "all", label: "الكل" }] }] : []}
        />
        {data.items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="لا توجد مواد"
            description={admin ? "أضف أول مادة وأسندها لدكتور." : actor.role === "doctor" ? "لم يتم إسناد مواد لك بعد." : "لا توجد مواد ضمن نطاقك."}
            action={admin ? <Button asChild size="sm"><Link href="/subjects/new"><Plus /> إضافة مادة</Link></Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المادة</TableHead>
                <TableHead>الفئة المؤهلة</TableHead>
                <TableHead>الدكتور</TableHead>
                <TableHead>المسجلون</TableHead>
                <TableHead>الحالة</TableHead>
                {admin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell data-cell="title">
                    <Link href={`/subjects/${s.id}`} className="font-medium hover:text-primary">{s.name}</Link>
                    <div className="ltr text-start font-mono text-xs text-muted-foreground">{s.code}</div>
                  </TableCell>
                  <TableCell data-cell="hide" className="max-w-64 text-xs text-muted-foreground">
                    <div>{names(st.years, s.eligibility.academicYears, "كل السنوات")}</div>
                    <div>{names(st.departments, s.eligibility.departments, "كل التخصصات")}</div>
                  </TableCell>
                  <TableCell className="text-sm">{s.doctors.length ? s.doctors.map((d) => d.name).join("، ") : <Badge variant="warning">غير مسند</Badge>}</TableCell>
                  <TableCell data-label="المسجلون" className="tabular-nums">
                    {s.enrolled}
                    {s.pending > 0 && <Badge variant="warning" className="ms-2">{s.pending} معلق</Badge>}
                  </TableCell>
                  <TableCell><ActiveBadge active={s.active} on="مفعلة" off="متوقفة" /></TableCell>
                  {admin && (
                    <TableCell data-cell="trailing">
                      <Button asChild variant="ghost" size="icon-sm" aria-label="تعديل"><Link href={`/subjects/${s.id}/edit`}><Pencil /></Link></Button>
                    </TableCell>
                  )}
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
