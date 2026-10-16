"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/display";
import { ConfirmAction } from "@/components/shared/confirm";
import { cancelImportAction, processImportBatchAction } from "@/server/actions/students";

type Totals = { rows: number; valid: number; invalid: number; duplicate: number; created: number; failed: number };

/** Drives the batched import from the browser: each call processes one bounded batch on the server. */
export function ImportRunner({ jobId, status, pendingValid, totals }: { jobId: string; status: string; pendingValid: number; totals: Totals }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [t, setT] = useState(totals);
  const done = status === "completed";
  const target = Math.max(1, totals.valid);
  const progress = ((t.created + Math.max(0, t.duplicate - totals.duplicate) + Math.max(0, t.failed - totals.failed)) / target) * 100;

  const start = async () => {
    setRunning(true);
    try {
      for (let i = 0; i < 1000; i++) {
        const res = await processImportBatchAction(jobId);
        if (!res.ok) {
          toast.error(res.error);
          break;
        }
        setT(res.data.totals);
        if (res.data.done) {
          toast.success(`اكتمل الاستيراد: ${res.data.totals.created} طالب`);
          break;
        }
        if ("busy" in res.data && res.data.busy) await new Promise((r) => setTimeout(r, 1500));
      }
    } finally {
      setRunning(false);
      router.refresh();
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
        <CheckCircle2 className="size-5" /> اكتمل الاستيراد. تم إنشاء {t.created} طالب بأكواد جديدة.
      </div>
    );
  }
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
        <XCircle className="size-5" /> تم إلغاء هذا الاستيراد.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-semibold">2. تأكيد الاستيراد</div>
          <div className="text-muted-foreground">سيتم إنشاء {pendingValid} طالب. يتم التنفيذ على دفعات ويمكن استئنافه لاحقًا إذا انقطع.</div>
        </div>
        <div className="flex gap-2">
          <ConfirmAction
            trigger="إلغاء الاستيراد"
            triggerProps={{ variant: "outline", disabled: running }}
            destructive
            title="إلغاء الاستيراد؟"
            description="لن يتم إنشاء الصفوف المتبقية. الطلاب الذين تم إنشاؤهم بالفعل يبقون."
            onConfirm={async () => {
              const r = await cancelImportAction(jobId);
              if (r.ok) router.refresh();
              return r;
            }}
          />
          <Button onClick={start} loading={running} disabled={pendingValid === 0}>
            {!running && <Play />} {status === "processing" ? "استئناف الاستيراد" : "بدء الاستيراد"}
          </Button>
        </div>
      </div>
      {(running || t.created > 0) && (
        <div className="mt-4 grid gap-1.5">
          <Progress value={progress} />
          <div className="text-xs text-muted-foreground tabular-nums">تم إنشاء {t.created} من {totals.valid}</div>
        </div>
      )}
    </div>
  );
}
