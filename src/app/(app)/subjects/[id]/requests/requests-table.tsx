"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { Checkbox } from "@/components/ui/misc";
import { EmptyState } from "@/components/shared/page";
import { decideEnrollmentsAction } from "@/server/actions/teaching";
import { formatDateTime } from "@/lib/time";

export type RequestRow = { enrollmentId: string; code: string; fullName: string; year: string; department: string; requestedAt: string; requestedBy: string; subjectId?: string; subjectName?: string };

export function RequestsTable({ subjectId, items, showSubject }: { subjectId?: string; items: RequestRow[]; showSubject?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const decide = (ids: string[], decision: "approve" | "reject") =>
    start(async () => {
      // Group by subject (the requests page lists several subjects)
      const groups = new Map<string, string[]>();
      for (const id of ids) {
        const sid = subjectId ?? items.find((i) => i.enrollmentId === id)?.subjectId;
        if (!sid) continue;
        groups.set(sid, [...(groups.get(sid) ?? []), id]);
      }
      let n = 0;
      for (const [sid, list] of groups) {
        const r = await decideEnrollmentsAction(sid, { enrollmentIds: list, decision });
        if (!r.ok) return void toast.error(r.error);
        n += r.data.updated;
      }
      toast.success(`${decision === "approve" ? "تم قبول" : "تم رفض"} ${n} طلب`);
      setSelected([]);
      router.refresh();
    });

  if (!items.length) return <EmptyState icon={Inbox} title="لا توجد طلبات معلقة" />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b bg-surface px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">محدد: <span className="font-semibold text-foreground">{selected.length}</span></span>
        <div className="ms-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={!selected.length || pending} onClick={() => decide(selected, "reject")}><X /> رفض المحدد</Button>
          <Button size="sm" variant="success" disabled={!selected.length} loading={pending} onClick={() => decide(selected, "approve")}><Check /> قبول المحدد</Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox aria-label="تحديد الكل" checked={selected.length === items.length} onCheckedChange={(c) => setSelected(c ? items.map((i) => i.enrollmentId) : [])} />
            </TableHead>
            <TableHead>الطالب</TableHead>
            {showSubject && <TableHead>المادة</TableHead>}
            <TableHead>السنة / التخصص</TableHead>
            <TableHead>مقدم الطلب</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.enrollmentId}>
              <TableCell>
                <Checkbox aria-label={`تحديد ${r.fullName}`} checked={selected.includes(r.enrollmentId)} onCheckedChange={(c) => setSelected(c ? [...selected, r.enrollmentId] : selected.filter((x) => x !== r.enrollmentId))} />
              </TableCell>
              <TableCell>
                <div className="font-medium">{r.fullName}</div>
                <div className="ltr text-start font-mono text-xs text-primary">{r.code}</div>
              </TableCell>
              {showSubject && <TableCell>{r.subjectName}</TableCell>}
              <TableCell className="text-sm">
                {r.year}
                <div className="text-xs text-muted-foreground">{r.department}</div>
              </TableCell>
              <TableCell className="text-xs">
                {r.requestedBy}
                <div className="text-muted-foreground">{formatDateTime(r.requestedAt)}</div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" className="text-success" aria-label="قبول" disabled={pending} onClick={() => decide([r.enrollmentId], "approve")}><Check /></Button>
                  <Button size="icon-sm" variant="ghost" className="text-destructive" aria-label="رفض" disabled={pending} onClick={() => decide([r.enrollmentId], "reject")}><X /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
