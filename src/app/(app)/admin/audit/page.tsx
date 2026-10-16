import { History } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { AuditLog } from "@/server/db/models";
import { AUDIT_ACTION_LABELS } from "@/server/services/audit";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@/components/ui/display";
import { formatDateTime } from "@/lib/time";
import { escapeRegex } from "@/lib/arabic";

export const metadata = { title: "سجل العمليات" };
const PAGE = 30;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor(["admin"]);
  const sp = await searchParams;
  const filter: Record<string, unknown> = {};
  if (sp.action) filter.action = sp.action;
  if (sp.group) filter.action = { $regex: "^" + escapeRegex(sp.group) + "\\." };
  if (sp.q) {
    const rx = new RegExp(escapeRegex(sp.q), "i");
    filter.$or = [{ summary: rx }, { actorName: rx }];
  }
  const page = Math.max(1, Number(sp.page) || 1);
  const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE).limit(PAGE).lean(), AuditLog.countDocuments(filter)]);
  const groups = [
    { value: "auth", label: "الدخول" },
    { value: "user", label: "المستخدمون" },
    { value: "staff", label: "الصلاحيات" },
    { value: "student", label: "الطلاب" },
    { value: "import", label: "الاستيراد" },
    { value: "enrollment", label: "التسجيل في المواد" },
    { value: "lecture", label: "المحاضرات" },
    { value: "attendance", label: "الحضور" },
    { value: "security", label: "الأمان" },
    { value: "settings", label: "الإعدادات" },
  ];
  return (
    <>
      <PageHeader title="سجل العمليات" description="كل العمليات الحساسة مسجلة مع المنفذ والوقت." breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "سجل العمليات" }]} />
      <Section>
        <FilterBar searchPlaceholder="بحث في الوصف أو اسم المنفذ…" selects={[{ name: "group", label: "الأنواع", options: groups }]} />
        {items.length === 0 ? (
          <EmptyState icon={History} title="لا توجد عمليات مطابقة" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الوقت</TableHead>
                <TableHead>المنفذ</TableHead>
                <TableHead>العملية</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => (
                <TableRow key={String(l._id)}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.actorName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.action.startsWith("security") || l.action.endsWith("failed") ? "danger" : l.action.includes("correct") ? "warning" : "muted"}>
                      {AUDIT_ACTION_LABELS[l.action] ?? l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md text-sm">{l.summary}</TableCell>
                  <TableCell className="ltr text-xs text-muted-foreground">{l.ip ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} />
      </Section>
    </>
  );
}
