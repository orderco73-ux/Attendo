"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlay";
import { ConfirmAction } from "@/components/shared/confirm";
import { LectureForm, type LectureFormValues } from "@/components/shared/lecture-form";
import { cancelLectureAction, closeLectureAction, openLectureAction } from "@/server/actions/teaching";
import type { LectureStatus, SessionMode } from "@/lib/constants";

export function SessionControls({ lectureId, status, mode, initial, defaultRadius }: { lectureId: string; status: LectureStatus; mode: SessionMode; initial: LectureFormValues; defaultRadius: number }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const refresh = <T,>(r: T & { ok: boolean }) => {
    if (r.ok) router.refresh();
    return r;
  };
  return (
    <>
      {status !== "cancelled" && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Pencil /> تعديل</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تعديل المحاضرة</DialogTitle>
            </DialogHeader>
            <LectureForm lectureId={lectureId} initial={initial} defaultRadius={defaultRadius} locked={status === "scheduled" ? undefined : (status as "open" | "closed")} onDone={() => setEditOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
      {(status === "scheduled" || status === "open") && (
        <ConfirmAction
          trigger={<><Ban /> إلغاء المحاضرة</>}
          triggerProps={{ variant: "outline", className: "text-destructive" }}
          destructive
          title="إلغاء المحاضرة؟"
          description="المحاضرة الملغاة لا تُحتسب في الحضور أو الغياب. لا يمكن التراجع."
          reason={{ label: "سبب الإلغاء", required: true, placeholder: "مثال: عطلة رسمية" }}
          confirmLabel="إلغاء المحاضرة"
          success="تم إلغاء المحاضرة"
          onConfirm={async (reason) => refresh(await cancelLectureAction(lectureId, reason))}
        />
      )}
      {status === "scheduled" && (
        <ConfirmAction
          trigger={<><Play /> بدء الحضور</>}
          triggerProps={{ variant: "success" }}
          title="فتح جلسة الحضور الآن؟"
          description={mode === "scheduled" ? "الجلسة مجدولة تلقائيًا؛ فتحها الآن يحولها للتحكم اليدوي وستحتاج لإغلاقها بنفسك." : "سيتمكن الطلاب والطاقم المخول من تسجيل الحضور."}
          confirmLabel="فتح الحضور"
          success="تم فتح الحضور"
          onConfirm={async () => refresh(await openLectureAction(lectureId))}
        />
      )}
      {status === "open" && (
        <ConfirmAction
          trigger={<><Square /> إغلاق الحضور</>}
          triggerProps={{ variant: "destructive" }}
          destructive
          title="إغلاق جلسة الحضور؟"
          description="بعد الإغلاق يُحتسب غياب كل من لم يسجل، ولا يمكن التعديل إلا من خلالك مع ذكر السبب."
          confirmLabel="إغلاق"
          success="تم إغلاق الحضور"
          onConfirm={async () => refresh(await closeLectureAction(lectureId))}
        />
      )}
      {status === "closed" && (
        <ConfirmAction
          trigger={<><RotateCcw /> إعادة فتح</>}
          triggerProps={{ variant: "outline" }}
          title="إعادة فتح جلسة الحضور؟"
          description="سيتمكن الطلاب والطاقم من التسجيل مرة أخرى. يُسجل هذا الإجراء في سجل العمليات."
          confirmLabel="إعادة فتح"
          success="تمت إعادة الفتح"
          onConfirm={async () => refresh(await openLectureAction(lectureId))}
        />
      )}
    </>
  );
}
