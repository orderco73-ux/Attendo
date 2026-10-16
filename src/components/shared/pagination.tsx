"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageSize, total, param = "page" }: { page: number; pageSize: number; total: number; param?: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(sp.toString());
    if (p <= 1) q.delete(param);
    else q.set(param, String(p));
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex size-8 items-center justify-center rounded-md border text-sm hover:bg-accent aria-disabled:pointer-events-none aria-disabled:opacity-40";
  const nums: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p);
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        عرض <span className="tabular-nums">{from}</span>–<span className="tabular-nums">{to}</span> من <span className="tabular-nums">{total}</span>
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <Link href={href(page - 1)} aria-disabled={page <= 1} className={btn} aria-label="السابق">
            <ChevronRight className="size-4" />
          </Link>
          {nums.map((p) => (
            <Link key={p} href={href(p)} className={cn(btn, "tabular-nums", p === page && "border-primary bg-primary text-primary-foreground hover:bg-primary")}>
              {p}
            </Link>
          ))}
          <Link href={href(page + 1)} aria-disabled={page >= pages} className={btn} aria-label="التالي">
            <ChevronLeft className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
