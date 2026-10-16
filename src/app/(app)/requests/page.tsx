import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { hasPermission, isAdmin, isDoctor } from "@/server/authz/policy";
import { listPendingRequests } from "@/server/services/enrollment";
import { getStructure } from "@/server/services/academic";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { EnrollmentBadge } from "@/components/shared/badges";
import { formatDateTime } from "@/lib/time";
import { RequestsTable } from "../subjects/[id]/requests/requests-table";

export const metadata = { title: "طلبات التسجيل" };

export default async function RequestsPage() {
  const actor = await requireActor();
  const manager = isAdmin(actor) || isDoctor(actor);
  if (!manager && !hasPermission(actor, "enrollment.request")) redirect("/dashboard?denied=1");
  const [items, st] = await Promise.all([listPendingRequests(actor, 200), getStructure()]);
  const n = (list: { id: string; name: string }[], v: unknown) => list.find((x) => x.id === String(v))?.name ?? "—";
  return (
    <>
      <PageHeader
        title="طلبات التسجيل في المواد"
        description={manager ? "الطلبات المقدمة من الطاقم بانتظار موافقتك." : "الطلبات التي قدمتها وحالتها."}
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "طلبات التسجيل" }]}
      />
      <Section>
        {manager ? (
          <RequestsTable
            showSubject
            items={items.map((e) => ({
              enrollmentId: String(e._id),
              subjectId: String(e.subject?._id),
              subjectName: e.subject?.name,
              code: e.student?.code ?? "",
              fullName: e.student?.fullName ?? "",
              year: n(st.years, e.student?.academicYear),
              department: n(st.departments, e.student?.department),
              requestedAt: e.createdAt.toISOString(),
              requestedBy: "",
            }))}
          />
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title="لم تقدم أي طلبات بعد" description="قدّم طلبات التسجيل من صفحة المادة." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>المادة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={String(e._id)}>
                  <TableCell data-cell="title">
                    <div className="font-medium">{e.student?.fullName}</div>
                    <div className="ltr text-start font-mono text-xs text-primary">{e.student?.code}</div>
                  </TableCell>
                  <TableCell>{e.subject?.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                  <TableCell data-cell="trailing"><EnrollmentBadge status={e.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
