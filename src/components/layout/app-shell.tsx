"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  BookOpen,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import type { NavGroup, NavIcon } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SheetContent,
} from "@/components/ui/overlay";
import { logoutAction } from "@/server/actions/auth";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  structure: Building2,
  subjects: BookOpen,
  doctors: Stethoscope,
  staff: ShieldCheck,
  students: GraduationCap,
  import: FileSpreadsheet,
  sessions: CalendarClock,
  reports: PieChart,
  requests: Inbox,
  audit: History,
  settings: Settings,
};

export interface ShellUser {
  name: string;
  email: string;
  roleLabel: string;
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
        <ClipboardCheck className="size-4.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">Attendo</span>
        <span className="block text-[11px] text-muted-foreground">nosait</span>
      </span>
    </Link>
  );
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  // Longest matching prefix wins (e.g. /students/import vs /students)
  const active = all.filter((h) => pathname === h || pathname.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.label && <div className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground/80">{g.label}</div>}
          {g.items.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground",
                  isActive && "bg-brand-soft text-primary hover:bg-brand-soft hover:text-primary",
                )}
              >
                <Icon className={cn("size-4", isActive ? "text-primary" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const [pending, start] = useTransition();
  const initials = user.name.trim().split(" ").slice(0, 2).map((p) => p[0]).join("");
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-1.5 py-1 text-start hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-primary">{initials}</span>
          <span className="hidden leading-tight sm:block">
            <span className="block max-w-40 truncate text-sm font-medium">{user.name}</span>
            <span className="block text-[11px] text-muted-foreground">{user.roleLabel}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <KeyRound /> تغيير كلمة المرور
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inquiry" target="_blank">
            <Users /> صفحة استعلام الطلاب
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => start(() => logoutAction())}>
          <LogOut /> تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ groups, user, institution, children }: { groups: NavGroup[]; user: ShellUser; institution: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar (right side in RTL) */}
      <aside className="no-print fixed inset-y-0 right-0 z-30 hidden w-64 flex-col border-l bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavList groups={groups} />
        </div>
        <div className="border-t px-5 py-3 text-[11px] text-muted-foreground">{institution}</div>
      </aside>

      <div className="min-w-0 lg:pr-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
              <DialogPrimitive.Trigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="القائمة">
                  <Menu className="size-5" />
                </Button>
              </DialogPrimitive.Trigger>
              <SheetContent side="right" aria-describedby={undefined}>
                <DialogPrimitive.Title className="sr-only">القائمة الرئيسية</DialogPrimitive.Title>
                <div className="flex h-16 items-center border-b px-4">
                  <Brand />
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-5">
                  <NavList groups={groups} onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </DialogPrimitive.Root>
            <div className="lg:hidden">
              <Brand />
            </div>
            <span className="hidden text-sm text-muted-foreground lg:block">{institution}</span>
          </div>
          <UserMenu user={user} />
        </header>
        <main className="mx-auto w-full max-w-[1400px] min-w-0 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
