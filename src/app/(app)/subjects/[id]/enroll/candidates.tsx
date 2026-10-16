"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { Checkbox } from "@/components/ui/misc";
import { EmptyState } from "@/components/shared/page";
import { ConfirmAction } from "@/components/shared/confirm";
import { enrollAllAction, enrollStudentsAction } from "@/server/actions/teaching";
import type { StudentQuery } from "@/server/services/students";

type Row = { id: string; code: string; fullName: string; year: string; department: string };

export function CandidatesTable({ subjectId, items, manage, today, total, filters }: { subjectId: string; items: Row[]; manage: boolean; today: string; total: number; filters: StudentQuery }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [effective, setEffective] = useState(today);
  const [pending, start] = useTransition();
  const allOnPage = items.length > 0 && items.every((i) => selected.includes(i.id));

  const enroll = () =>
    start(async () => {
      const res = await enrollStudentsAction(subjectId, { studentIds: selected, effectiveFrom: manage ? effective : undefined });
      if (!res.ok) return void toast.error(res.error);
      const { added, status, rejected } = res.data;
      toast.success(status === "pending" ? `تم إرسال ${added} طلب تسجيل للدكتور` : `تم تسجيل ${added} طالب`);
      if (rejected.length) toast.warning(`تم رفض ${rejected.length}: ${rejected.map((r) => `${r.code} (${r.reason})`).join("، ")}`);
      setSelected([]);
      router.refresh();
    });

  if (!items.length) return <EmptyState icon={Users} title="لا يوجد طلاب مؤهلون غير مسجلين" description="كل الطلاب المطابقين مسجلون بالفعل أو لا يوجد طلاب مطابقون للأهلية." />;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b bg-surface px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">محدد: <span className="font-semibold text-foreground tabular-nums">{selected.length}</span></span>
        {manage && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            احتساب الحضور من
            <Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} className="h-8 w-38" />
          </label>
        )}
        <div className="ms-auto flex gap-2">
          {manage && (
            <ConfirmAction
              trigger={<><Users /> تسجيل كل المؤهلين ({total})</>}
              triggerProps={{ variant: "outline" }}
              title={`تسجيل ${total} طالب؟`}
              description="سيتم تسجيل كل الطلاب المؤهلين المطابقين للفلاتر الحالية."
              confirmLabel="تسجيل الكل"
              onConfirm={async () => {
                const r = await enrollAllAction(subjectId, filters, effective);
                if (r.ok) {
                  toast.success(`تم تسجيل ${r.data.added} طالب`);
                  router.refresh();
                }
                return r;
              }}
            />
          )}
          <Button size="sm" disabled={!selected.length} loading={pending} onClick={enroll}>
            <UserPlus /> {manage ? "تسجيل المحددين" : "إرسال طلب التسجيل"}
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="تحديد الكل"
                checked={allOnPage}
                onCheckedChange={(c) => setSelected(c ? [...new Set([...selected, ...items.map((i) => i.id)])] : selected.filter((s) => !items.some((i) => i.id === s)))}
              />
            </TableHead>
            <TableHead>الكود</TableHead>
            <TableHead>الاسم</TableHead>
            <TableHead>السنة</TableHead>
            <TableHead>التخصص</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => {
            const on = selected.includes(s.id);
            return (
              <TableRow key={s.id} className={on ? "bg-brand-soft/50" : undefined}>
                <TableCell data-cell="select">
                  <Checkbox aria-label={`تحديد ${s.fullName}`} checked={on} onCheckedChange={(c) => setSelected(c ? [...selected, s.id] : selected.filter((x) => x !== s.id))} />
                </TableCell>
                <TableCell data-cell="subtitle" className="ltr font-mono text-xs font-semibold text-primary">{s.code}</TableCell>
                <TableCell data-cell="title" className="font-medium">{s.fullName}</TableCell>
                <TableCell>{s.year}</TableCell>
                <TableCell className="text-muted-foreground">{s.department}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
