"use client";
import * as React from "react";
import { Label as LabelPrimitive, Separator as SeparatorPrimitive, Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:opacity-50", className)}
      {...props}
    />
  );
}

function Separator({ className, orientation = "horizontal", decorative = true, ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer size-[18px] shrink-0 cursor-pointer rounded-full border-[1.5px] border-muted-foreground/45 bg-background outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      dir="ltr"
      className={cn(
        "peer inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full p-[2px] outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50 data-[state=checked]:bg-switch-on data-[state=unchecked]:bg-fill-strong",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-transform duration-200 ease-[var(--ease-ios)] data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export { Label, Separator, Checkbox, Switch };
