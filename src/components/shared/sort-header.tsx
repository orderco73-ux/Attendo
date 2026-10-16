"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function SortHeader({ field, children }: { field: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("sort") === field;
  const dir = active && sp.get("dir") !== "desc" ? "desc" : "asc";
  const q = new URLSearchParams(sp.toString());
  q.set("sort", field);
  q.set("dir", dir);
  q.delete("page");
  const Icon = !active ? ArrowUpDown : sp.get("dir") === "desc" ? ArrowDown : ArrowUp;
  return (
    <Link href={`${pathname}?${q}`} scroll={false} className="inline-flex items-center gap-1 hover:text-foreground">
      {children}
      <Icon className="no-print size-3" />
    </Link>
  );
}
