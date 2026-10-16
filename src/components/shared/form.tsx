"use client";
import * as React from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Label } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/actions/_run";

export function Field({ label, error, hint, required, htmlFor, children, className }: { label: React.ReactNode; error?: string; hint?: React.ReactNode; required?: boolean; htmlFor?: string; children: React.ReactNode; className?: string }) {
  const autoId = React.useId();
  const msgId = `${autoId}-msg`;
  // Associate the label/message with a single control child automatically (accessible names + error announcement).
  let control = children;
  let id = htmlFor;
  const isControl = (t: unknown) => typeof t !== "string" || ["input", "select", "textarea"].includes(t);
  if (!htmlFor && React.isValidElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>(children) && isControl(children.type)) {
    const el = children;
    id = htmlFor ?? el.props.id ?? autoId;
    control = React.cloneElement(el, {
      id,
      "aria-invalid": error ? true : el.props["aria-invalid"],
      "aria-describedby": error || hint ? msgId : el.props["aria-describedby"],
    });
  }
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-[13px]">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {control}
      {error ? (
        <p id={msgId} role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={msgId} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Applies server field errors to a react-hook-form instance and toasts the result. */
export function handleResult<T extends FieldValues, R>(form: UseFormReturn<T> | null, res: ActionResult<R>, success?: string): res is { ok: true; data: R } {
  if (res.ok) {
    if (success) toast.success(success);
    return true;
  }
  if (form && res.fieldErrors) {
    for (const [k, v] of Object.entries(res.fieldErrors)) form.setError(k as Path<T>, { message: v });
  }
  toast.error(res.error);
  return false;
}

/** Multi-select rendered as a list of checkboxes with a filter (for small reference lists). */
export function CheckList({ options, value, onChange, emptyText = "لا توجد عناصر", maxHeight = "12rem" }: { options: { value: string; label: string; hint?: string }[]; value: string[]; onChange: (v: string[]) => void; emptyText?: string; maxHeight?: string }) {
  const [q, setQ] = React.useState("");
  const shown = q ? options.filter((o) => o.label.includes(q) || o.hint?.includes(q)) : options;
  return (
    <div className="overflow-hidden rounded-xl bg-fill/60">
      {options.length > 8 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="تصفية…" className="w-full border-b-[0.5px] bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
      )}
      <div className="overflow-y-auto p-1" style={{ maxHeight }}>
        {shown.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</p>}
        {shown.map((o) => {
          const checked = value.includes(o.value);
          return (
            <label key={o.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-fill">
              <input
                type="checkbox"
                className="size-[18px] cursor-pointer accent-[var(--primary)]"
                checked={checked}
                onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])}
              />
              <span className="flex-1">{o.label}</span>
              {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
