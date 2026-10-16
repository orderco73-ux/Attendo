"use client";
import * as React from "react";
import { Dialog as DialogPrimitive, DropdownMenu as DropdownPrimitive, Tabs as TabsPrimitive, Popover as PopoverPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- Dialog ---------------- */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 dark:bg-black/55",
        className,
      )}
      {...props}
    />
  );
}

/** Round grey close button (iOS style). */
function CloseButton({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      className={cn(
        "pressable absolute end-4 top-4 grid size-7 place-items-center rounded-full bg-fill text-muted-foreground hover:bg-fill-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X className="size-3.5" strokeWidth={2.5} />
      <span className="sr-only">إغلاق النافذة</span>
    </DialogPrimitive.Close>
  );
}

/**
 * Responsive modal: a bottom sheet with a grabber on phones, a centered card on larger screens.
 */
function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        dir="rtl"
        className={cn(
          "fixed z-50 grid w-full gap-4 overflow-y-auto bg-popover p-5 text-popover-foreground shadow-pop outline-none",
          // phone: bottom sheet
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px] pt-7 pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:duration-300 data-[state=closed]:duration-200",
          // tablet/desktop: centered card
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:p-6 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      >
        <span aria-hidden className="absolute top-2 left-1/2 h-[5px] w-9 -translate-x-1/2 rounded-full bg-fill-strong sm:hidden" />
        {children}
        {showClose && <CloseButton />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 pe-9 text-start", className)} {...props} />;
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end [&>button]:max-sm:h-11 [&>button]:max-sm:text-[15px]", className)} {...props} />;
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-[19px] font-semibold tracking-tight", className)} {...props} />;
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}

/* ---------------- Sheet (side drawer) ---------------- */
function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "right" | "left" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        dir="rtl"
        className={cn(
          "glass fixed inset-y-0 z-50 flex h-full w-80 max-w-[86vw] flex-col shadow-pop outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-300",
          side === "right" ? "right-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right" : "left-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          className,
        )}
        {...props}
      >
        {children}
        <CloseButton className="top-4" />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ---------------- Dropdown menu (iOS context menu look) ---------------- */
const DropdownMenu = DropdownPrimitive.Root;
const DropdownMenuTrigger = DropdownPrimitive.Trigger;

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "glass z-50 min-w-52 overflow-hidden rounded-2xl p-1.5 text-popover-foreground shadow-pop ring-[0.5px] ring-border data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm outline-none select-none focus:bg-fill data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        variant === "destructive" && "text-destructive focus:bg-danger-soft [&_svg]:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn("px-2.5 py-1.5 text-xs text-muted-foreground", className)} {...props} />;
}
function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn("-mx-1.5 my-1.5 h-[0.5px] bg-border", className)} {...props} />;
}

/* ---------------- Tabs → iOS segmented control ---------------- */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root dir="rtl" className={cn("flex flex-col gap-4", className)} {...props} />;
}
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("scrollbar-none inline-flex h-9 w-fit max-w-full items-center overflow-x-auto rounded-[10px] bg-fill p-[3px] text-foreground", className)}
      {...props}
    />
  );
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-[7px] px-3.5 text-[13px] font-medium whitespace-nowrap transition-all duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-[0_3px_8px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:data-[state=active]:bg-[#636366] [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0", className)} {...props} />;
}

/* ---------------- Popover ---------------- */
const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
function PopoverContent({ className, align = "center", sideOffset = 6, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "glass z-50 w-72 rounded-2xl p-4 text-popover-foreground shadow-pop ring-[0.5px] ring-border outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  SheetContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Popover,
  PopoverTrigger,
  PopoverContent,
};
