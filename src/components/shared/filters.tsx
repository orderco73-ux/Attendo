"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export interface FilterSelect {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  /** Hide options whose `parent` doesn't match the current value of another filter */
  dependsOn?: string;
  optionParents?: Record<string, string>;
}

function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (updates: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") q.delete(k);
      else q.set(k, v);
    }
    q.delete("page");
    start(() => router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false }));
  };
  return { sp, set, pending };
}

/** URL-driven search + select filters. Server components read the same search params. */
export function FilterBar({ searchPlaceholder = "بحث…", selects = [], children, className, extra }: { searchPlaceholder?: string; selects?: FilterSelect[]; children?: React.ReactNode; className?: string; extra?: { name: string; label: string; type: "date" }[] }) {
  const { sp, set, pending } = useUrlState();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) set({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = selects.some((s) => sp.get(s.name)) || !!sp.get("q") || (extra ?? []).some((e) => sp.get(e.name));

  return (
    <div className={cn("no-print flex flex-wrap items-center gap-2 border-b-[0.5px] px-4 py-3 sm:px-5", className)}>
      <div className="relative w-full min-w-52 flex-1 sm:w-auto sm:max-w-xs">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="ps-9" aria-label="بحث" type="search" />
      </div>
      {/* phones: two filters per row; larger screens: inline */}
      <div className="grid w-full grid-cols-2 gap-2 empty:hidden sm:flex sm:w-auto sm:flex-wrap">
      {selects.map((s) => {
        const parentVal = s.dependsOn ? sp.get(s.dependsOn) : null;
        const opts = s.optionParents && parentVal ? s.options.filter((o) => !s.optionParents![o.value] || s.optionParents![o.value] === parentVal) : s.options;
        return (
          <div key={s.name} className="min-w-0 sm:w-44">
            <NativeSelect aria-label={s.label} value={sp.get(s.name) ?? ""} onChange={(e) => set({ [s.name]: e.target.value })}>
              <option value="">{s.allLabel ?? `كل ${s.label}`}</option>
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        );
      })}
      {(extra ?? []).map((e) => (
        <label key={e.name} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">{e.label}</span>
          <Input type="date" className="min-w-0 sm:w-38" value={sp.get(e.name) ?? ""} onChange={(ev) => set({ [e.name]: ev.target.value })} />
        </label>
      ))}
      </div>
      {children}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {active && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            set(Object.fromEntries([["q", null], ...selects.map((s) => [s.name, null]), ...(extra ?? []).map((e) => [e.name, null])]));
          }}
          className="pressable flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-primary hover:bg-brand-soft"
        >
          <X className="size-3.5" /> مسح الفلاتر
        </button>
      )}
    </div>
  );
}

/** Simple tab-like links bound to one search param. */
export function ParamTabs({ name, options, className }: { name: string; options: { value: string; label: string; count?: number }[]; className?: string }) {
  const { sp, set } = useUrlState();
  const current = sp.get(name) ?? options[0]?.value ?? "";
  return (
    <div className={cn("no-print scrollbar-none inline-flex h-9 max-w-full items-center overflow-x-auto rounded-[10px] bg-fill p-[3px]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => set({ [name]: o.value === options[0].value ? null : o.value })}
          className={cn(
            "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-[7px] px-3.5 text-[13px] font-medium whitespace-nowrap text-foreground/75 transition-all duration-200",
            current === o.value && "bg-background font-semibold text-foreground shadow-[0_3px_8px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-[#636366]",
          )}
        >
          {o.label}
          {o.count != null && <span className="rounded-full bg-fill-strong px-1.5 text-[11px] tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
