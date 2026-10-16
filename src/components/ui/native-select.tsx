import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD } from "./input";

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select data-slot="select" className={cn(FIELD, "h-10 cursor-pointer appearance-none pe-9 sm:h-9", className)} {...props}>
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
