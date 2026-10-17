"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { Section, EmptyState } from "@/components/shared/page";
import { FilterBar, ParamTabs } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { RecordStatusBadge, SourceBadge } from "@/components/shared/badges";
import { ConfirmAction } from "@/components/shared/confirm";
import { clearStatusAction, markAllPresentAction, setStatusAction } from "@/server/actions/teaching";
import { RECORD_SOURCE_LABELS, RECORD_STATUS_LABELS, type LectureStatus, type RecordSource, type RecordStatus } from "@/lib/constants";
import { formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type Item = {
  studentId: string;
  code: string;
  fullName: string;
  record: null | {
    status: RecordStatus;
    source: RecordSource;
    markedAt: string;
    distanceM: number | null;
    history: { at: string; from: RecordStatus | null; to: RecordStatus; source: RecordSource; reason?: string }[];
  };
};

const BTN: Record<RecordStatus, string> = {
  present: "data-[on=true]:bg-success data-[on=true]:text-white",
  absent: "data-[on=true]:bg-destructive data-[on=true]:text-white",
  excused: "data-[on=true]:bg-warning data-[on=true]:text-white",
};

export function AttendanceSheet({ lectureId, status, canEdit, items, total, page, pageSize }: { lectureId: string; status: LectureStatus; canEdit: boolean; items: Item[]; total: number; page: number; pageSize: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [correction, setCorrection] = useState<{ item: Item; to: RecordStatus } | null>(null);
  // Pressing the already-active "present"/"excused" asks to undo that mark.
  const [undo, setUndo] = useState<{ item: Item; from: RecordStatus } | null>(null);
  const [reason, setReason] = useState("");
  const closed = status === "closed";
  const editable = canEdit && (status === "open" || status === "closed");

  const apply = (item: Item, to: RecordStatus, why?: string) =>
    start(async () => {
      const r = await setStatusAction(lectureId, { studentId: item.studentId, status: to, reason: why });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${item.fullName}: ${RECORD_STATUS_LABELS[to]}`);
      setCorrection(null);
      setReason("");
      router.refresh();
    });

  const effective = (i: Item): RecordStatus | null => i.record?.status ?? (closed ? "absent" : null);

  const clear = (item: Item, why?: string) =>
    start(async () => {
      const r = await clearStatusAction(lectureId, { studentId: item.studentId, reason: why });
      if (!r.ok) return void toast.error(r.error);
      toast.success(closed ? `${item.fullName}: غائب` : `تم إلغاء تسجيل ${item.fullName}`);
      setUndo(null);
      setReason("");
      router.refresh();
    });

  const onPress = (i: Item, s: RecordStatus, current: RecordStatus | null) => {
    if (current === s) {
      if (s !== "absent" && i.record) setUndo({ item: i, from: s });
      return;
    }
    if (closed) setCorrection({ item: i, to: s });
    else apply(i, s);
  };

  return (
    <Section
      title="كشف الحضور"
      description={closed ? "الجلسة مغلقة — التعديل متاح للدكتور فقط مع ذكر السبب." : status === "open" ? "يتم التحديث عند كل تسجيل." : undefined}
      actions={
        canEdit &&
        status === "open" && (
          <ConfirmAction
            trigger={<><UsersRound /> تحضير الكل</>}
            triggerProps={{ variant: "outline" }}
            title="تسجيل كل الطلاب غير المسجلين كحاضرين؟"
            description="مفيد عند الحضور الكامل. يمكنك بعدها تعديل الغائبين يدويًا."
            confirmLabel="تسجيل الكل"
            onConfirm={async () => {
              const r = await markAllPresentAction(lectureId);
              if (r.ok) {
                toast.success(`تم تسجيل ${r.data.marked} طالب`);
                router.refresh();
              }
              return r;
            }}
          />
        )
      }
    >
      <FilterBar searchPlaceholder="بحث بالاسم أو الكود…">
        <ParamTabs
          name="filter"
          options={[
            { value: "all", label: "الكل" },
            { value: "present", label: "حاضر" },
            { value: "absent", label: closed ? "غائب" : "لم يسجل" },
            { value: "excused", label: "بعذر" },
          ]}
        />
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState title="لا يوجد طلاب" description="لا يوجد طلاب مسجلون في المادة مطابقون للبحث." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الطالب</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="hidden sm:table-cell">التسجيل</TableHead>
              {editable && <TableHead className="text-end">تعديل</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => {
              const st = effective(i);
              return (
                <TableRow key={i.studentId}>
                  <TableCell data-cell="title">
                    {/* Name and code share one line to keep the phone card compact */}
                    <div className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="text-[13px] font-medium">{i.fullName}</span>
                      <span className="ltr font-mono text-[11px] font-normal text-primary">{i.code}</span>
                    </div>
                  </TableCell>
                  {/* Status column: shown on larger screens; on phones the highlighted button already shows it */}
                  <TableCell data-cell="hide">
                    <div className="flex items-center gap-1.5">
                      <RecordStatusBadge status={st} />
                      {i.record && i.record.history.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="rounded p-1 text-muted-foreground hover:bg-fill" aria-label="سجل التغييرات">
                              <History className="size-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="start">
                            <div className="mb-2 text-xs font-semibold">سجل التغييرات</div>
                            <ol className="grid gap-2 text-xs">
                              {i.record.history.map((h, k) => (
                                <li key={k} className="rounded border px-2 py-1.5">
                                  <div className="flex justify-between gap-2">
                                    <span>{h.from ? `${RECORD_STATUS_LABELS[h.from]} ← ` : ""}{RECORD_STATUS_LABELS[h.to]}</span>
                                    <span className="text-muted-foreground">{formatDateTime(h.at)}</span>
                                  </div>
                                  <div className="text-muted-foreground">{RECORD_SOURCE_LABELS[h.source]}{h.reason ? ` — ${h.reason}` : ""}</div>
                                </li>
                              ))}
                            </ol>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {i.record ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SourceBadge source={i.record.source} />
                        <span>{formatTime(i.record.markedAt)}</span>
                        {i.record.distanceM != null && <span>· {i.record.distanceM} م</span>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {editable && (
                    <TableCell data-cell="actions">
                      <div className="flex gap-1 sm:justify-end">
                        {(["present", "absent", "excused"] as const).map((s) => (
                          <button
                            key={s}
                            data-on={st === s}
                            aria-pressed={st === s}
                            title={st === s && s !== "absent" && i.record ? "اضغط لإلغاء التسجيل" : undefined}
                            disabled={pending || (st === s && (s === "absent" || !i.record))}
                            onClick={() => onPress(i, s, st)}
                            className={cn("pressable h-6 cursor-pointer rounded-full bg-fill px-2.5 text-[11px] font-medium transition-colors hover:bg-fill-strong disabled:cursor-default", BTN[s])}
                          >
                            {RECORD_STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} />

      <Dialog open={!!undo} onOpenChange={(o) => !o && (setUndo(null), setReason(""))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{undo?.from === "excused" ? "إلغاء العذر؟" : "إلغاء الحضور؟"}</DialogTitle>
            <DialogDescription>
              {undo &&
                (closed
                  ? `سيُسجل ${undo.item.fullName} غائبًا في هذه المحاضرة. اكتب سبب التصحيح.`
                  : `سيعود ${undo.item.fullName} إلى «لم يسجل». يمكنك تسجيله مرة أخرى في أي وقت أثناء فتح الجلسة.`)}
            </DialogDescription>
          </DialogHeader>
          {closed && (
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التصحيح (إلزامي)" maxLength={300} aria-label="سبب التصحيح" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndo(null)}>تراجع</Button>
            <Button variant="destructive" loading={pending} disabled={closed && reason.trim().length < 3} onClick={() => undo && clear(undo.item, closed ? reason.trim() : undefined)}>
              {undo?.from === "excused" ? "إلغاء العذر" : "إلغاء الحضور"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!correction} onOpenChange={(o) => !o && setCorrection(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تصحيح حضور بعد الإغلاق</DialogTitle>
            <DialogDescription>
              {correction && `${correction.item.fullName}: ${RECORD_STATUS_LABELS[effective(correction.item) ?? "absent"]} ← ${RECORD_STATUS_LABELS[correction.to]}`}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التصحيح (إلزامي)" maxLength={300} aria-label="سبب التصحيح" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrection(null)}>إلغاء</Button>
            <Button loading={pending} disabled={reason.trim().length < 3} onClick={() => correction && apply(correction.item, correction.to, reason.trim())}>حفظ التصحيح</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
