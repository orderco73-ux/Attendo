import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "pressable inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(37,99,235,0.25)] hover:brightness-110",
        destructive: "bg-destructive text-white hover:brightness-110",
        outline: "bg-card text-foreground shadow-card ring-[0.5px] ring-border hover:bg-fill",
        secondary: "bg-brand-soft text-accent-foreground hover:brightness-95 dark:hover:brightness-125",
        ghost: "text-foreground hover:bg-fill",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-white hover:brightness-110 dark:text-black",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
        lg: "h-11 rounded-xl px-6 text-[15px]",
        icon: "size-9 rounded-full",
        "icon-sm": "size-8 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

function Button({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
