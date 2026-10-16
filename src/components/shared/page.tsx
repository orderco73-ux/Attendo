import Link from "next/link";
import { ChevronLeft, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** iOS-style large title header with a quiet breadcrumb trail above it. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { href?: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex flex-col gap-2", className)}>
      {breadcrumbs && breadcrumbs.length > 1 && (
        <nav aria-label="مسار التنقل" className="no-print flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {b.href ? (
                <Link href={b.href} className="text-primary transition-opacity hover:opacity-70">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronLeft className="size-3 opacity-60" />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-[32px]">{title}</h1>
          {description && <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center", className)}>
      <span className="mb-2 grid size-14 place-items-center rounded-[18px] bg-fill text-muted-foreground">
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <p className="text-[17px] font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Compact metric tiles (widget-like), dense enough to avoid oversized cards. */
export function StatStrip({ items, className }: { items: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "success" | "warning" | "danger" | "primary" }[]; className?: string }) {
  const tones = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };
  return (
    <div className={cn("grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3", items.length >= 4 && "lg:grid-cols-4", items.length >= 6 && "xl:grid-cols-6", className)}>
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl bg-card px-4 py-3.5 shadow-card">
          <div className="truncate text-[13px] text-muted-foreground">{it.label}</div>
          <div className={cn("mt-1 text-[26px] leading-none font-semibold tracking-tight tabular-nums", tones[it.tone ?? "default"])}>{it.value}</div>
          {it.hint && <div className="mt-1.5 text-[11px] text-muted-foreground">{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}

/** Grouped content container (iOS inset-grouped look). */
export function Section({ title, description, actions, children, className }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-2xl bg-card shadow-card", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-[0.5px] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
