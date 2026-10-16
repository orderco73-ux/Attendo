import * as React from "react";
import { cn } from "@/lib/utils";

/** iOS-style filled field: tinted fill, no hard border, soft focus ring. */
const FIELD =
  "w-full min-w-0 rounded-[10px] border-0 bg-fill px-3 text-[15px] text-foreground transition-[background-color,box-shadow] outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/35 aria-invalid:ring-2 aria-invalid:ring-destructive/50 sm:text-sm";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(FIELD, "h-10 py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium sm:h-9", className)}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(FIELD, "flex min-h-20 py-2.5", className)} {...props} />;
}

export { Input, Textarea, FIELD };
