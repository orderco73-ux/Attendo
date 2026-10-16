"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Ellipsis,
  FileSpreadsheet,
  GraduationCap,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  PieChart,
  Settings,
  ShieldCheck,
  Stethoscope,
  Sun,
  Users,
} from "lucide-react";
import type { NavGroup, NavIcon, NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/overlay";
import { logoutAction } from "@/server/actions/auth";
import { useTheme, type ThemeChoice } from "./theme";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
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

const initialsOf = (name: string) =>
  name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

function useActiveHref(groups: NavGroup[]) {
  const pathname = usePathname();
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  // Longest matching prefix wins (e.g. /students/import vs /students)
  return all.filter((h) => pathname === h || pathname.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
}

function Avatar({ name, size = "size-8 text-[12px]" }: { name: string; size?: string }) {
  return <span className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#8e8e93] to-[#6e6e73] font-semibold text-white", size)}>{initialsOf(name)}</span>;
}

function Brand() {
  return (
    <Link href="/dashboard" className="pressable flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[11px] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-white shadow-[0_2px_6px_rgba(37,99,235,0.35)]">
        <ClipboardCheck className="size-[18px]" strokeWidth={2.25} />
      </span>
      <span className="leading-tight">
        <span className="block text-[16px] font-semibold tracking-tight">Attendo</span>
        <span className="block text-[11px] text-muted-foreground">nosait</span>
      </span>
    </Link>
  );
}

/* ---------------- Theme segmented control ---------------- */
const THEMES: { value: ThemeChoice; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "فاتح", icon: Sun },
  { value: "system", label: "تلقائي", icon: Monitor },
  { value: "dark", label: "داكن", icon: Moon },
];

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="المظهر" className="grid grid-cols-3 gap-0.5 rounded-[10px] bg-fill p-[3px]">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          role="radio"
          aria-checked={theme === t.value}
          onClick={() => setTheme(t.value)}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-0.5 rounded-[7px] py-1.5 text-[11px] font-medium text-muted-foreground transition-all",
            theme === t.value && "bg-background text-foreground shadow-[0_2px_6px_rgba(0,0,0,0.12)] dark:bg-[#636366]",
          )}
        >
          <t.icon className="size-4" />
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Sidebar navigation (desktop + "more" sheet) ---------------- */
function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const active = useActiveHref(groups);
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.label && <div className="px-3 pb-1.5 text-[12px] font-medium text-muted-foreground">{g.label}</div>}
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
                  "flex items-center gap-3 rounded-[10px] px-3 py-[7px] text-[14px] text-foreground/85 transition-colors hover:bg-fill",
                  isActive && "bg-primary font-medium text-white hover:bg-primary",
                )}
              >
                <Icon className={cn("size-[18px]", isActive ? "text-white" : "text-primary")} strokeWidth={1.9} />
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
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <button
          className="pressable flex items-center gap-2.5 rounded-full p-0.5 text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:rounded-xl sm:py-1 sm:ps-1 sm:pe-3 sm:hover:bg-fill"
          aria-label="قائمة الحساب"
        >
          <Avatar name={user.name} />
          <span className="hidden leading-tight sm:block">
            <span className="block max-w-40 truncate text-[13px] font-medium">{user.name}</span>
            <span className="block text-[11px] text-muted-foreground">{user.roleLabel}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={user.name} size="size-10 text-sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
        <div className="px-1 pt-1 pb-2">
          <ThemeSwitcher />
        </div>
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

/* ---------------- Mobile bottom tab bar ---------------- */
function TabBar({ groups, user }: { groups: NavGroup[]; user: ShellUser }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [pending, start] = useTransition();
  const active = useActiveHref(groups);
  const flat: NavItem[] = groups.flatMap((g) => g.items);
  const tabs = flat.slice(0, 4);
  const moreActive = !!active && !tabs.some((t) => t.href === active);
  const tabCls = (on: boolean) =>
    cn("pressable flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[10px] font-medium", on ? "text-primary" : "text-muted-foreground");
  return (
    <>
      <nav aria-label="التنقل الرئيسي" className="glass no-print fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] lg:hidden">
        <div className="safe-bottom mx-auto flex max-w-lg items-stretch">
          {tabs.map((t) => {
            const Icon = ICONS[t.icon];
            const on = t.href === active;
            return (
              <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={cn(tabCls(on), "h-[52px]")}>
                <Icon className="size-[23px]" strokeWidth={on ? 2.2 : 1.8} />
                <span className="max-w-full truncate px-1">{t.short ?? t.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className={cn(tabCls(moreActive), "h-[52px] cursor-pointer")} aria-haspopup="dialog">
            <Ellipsis className="size-[23px]" strokeWidth={moreActive ? 2.2 : 1.8} />
            المزيد
          </button>
        </div>
      </nav>

      <DialogPrimitive.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent aria-describedby={undefined} className="gap-5">
          <DialogTitle>القائمة</DialogTitle>
          <div className="flex items-center gap-3 rounded-2xl bg-fill/60 p-3">
            <Avatar name={user.name} size="size-11 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.roleLabel}</div>
            </div>
          </div>
          <NavList groups={groups} onNavigate={() => setMoreOpen(false)} />
          <div className="grid gap-2">
            <div className="px-1 text-[12px] font-medium text-muted-foreground">المظهر</div>
            <ThemeSwitcher />
          </div>
          <div className="grid gap-1 border-t-[0.5px] pt-3">
            <Link href="/account" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] hover:bg-fill">
              <KeyRound className="size-[18px] text-primary" /> تغيير كلمة المرور
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => logoutAction())}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-start text-[15px] text-destructive hover:bg-danger-soft"
            >
              <LogOut className="size-[18px]" /> تسجيل الخروج
            </button>
          </div>
        </DialogContent>
      </DialogPrimitive.Root>
    </>
  );
}

export function AppShell({ groups, user, institution, children }: { groups: NavGroup[]; user: ShellUser; institution: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar (right side in RTL), frosted */}
      <aside className="glass no-print fixed inset-y-0 right-0 z-30 hidden w-[260px] flex-col border-l-[0.5px] lg:flex">
        <div className="flex h-[68px] items-center px-5">
          <Brand />
        </div>
        <div className="scrollbar-none flex-1 overflow-y-auto px-3 pt-2 pb-6">
          <NavList groups={groups} />
        </div>
        <div className="border-t-[0.5px] px-5 py-3.5 text-[11px] leading-relaxed text-muted-foreground">{institution}</div>
      </aside>

      <div className="min-w-0 lg:pr-[260px]">
        <header className="glass no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b-[0.5px] px-4 sm:px-6 lg:h-[68px] lg:px-8">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Brand />
          </div>
          <span className="hidden truncate text-[13px] text-muted-foreground lg:block">{institution}</span>
          <UserMenu user={user} />
        </header>
        <main className="mx-auto w-full max-w-[1320px] min-w-0 px-4 pt-5 pb-[calc(84px+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-7 lg:pb-12">{children}</main>
      </div>

      <TabBar groups={groups} user={user} />
    </div>
  );
}
