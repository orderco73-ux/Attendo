"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlay";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import type { ActionResult } from "@/server/actions/_run";

/** Runs an action and shows a toast. Returns true on success. */
export async function runWithToast<T>(p: Promise<ActionResult<T>>, success?: string): Promise<ActionResult<T>> {
  const res = await p;
  if (res.ok) {
    if (success) toast.success(success);
  } else toast.error(res.error);
  return res;
}

/**
 * Button that asks for confirmation before running a (usually destructive) action.
 * Optionally collects a reason.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "تأكيد",
  destructive,
  reason,
  onConfirm,
  success,
  triggerProps,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  reason?: { label: string; required?: boolean; placeholder?: string };
  onConfirm: (reason: string) => Promise<ActionResult<unknown>>;
  success?: string;
  triggerProps?: ButtonProps;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const disabled = !!reason?.required && text.trim().length < 3;
  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || setText(""))}>
      <DialogTrigger asChild>
        <Button variant={destructive ? "outline" : "default"} size="sm" {...triggerProps}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {reason && (
          <div className="grid gap-2">
            <Label htmlFor="confirm-reason">{reason.label}</Label>
            <Textarea id="confirm-reason" value={text} onChange={(e) => setText(e.target.value)} placeholder={reason.placeholder} maxLength={300} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            disabled={disabled}
            onClick={() =>
              start(async () => {
                const res = await runWithToast(onConfirm(text.trim()), success);
                if (res.ok) setOpen(false);
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
