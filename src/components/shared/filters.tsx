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
    <div className={cn("no-print flex flex-wrap items-center gap-2 border-b px-4 py-3", className)}>
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="ps-8" aria-label="بحث" />
      </div>
      {selects.map((s) => {
        const parentVal = s.dependsOn ? sp.get(s.dependsOn) : null;
        const opts = s.optionParents && parentVal ? s.options.filter((o) => !s.optionParents![o.value] || s.optionParents![o.value] === parentVal) : s.options;
        return (
          <div key={s.name} className="w-full min-w-36 sm:w-44">
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
        <label key={e.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {e.label}
          <Input type="date" className="w-38" value={sp.get(e.name) ?? ""} onChange={(ev) => set({ [e.name]: ev.target.value })} />
        </label>
      ))}
      {children}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {active && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            set(Object.fromEntries([["q", null], ...selects.map((s) => [s.name, null]), ...(extra ?? []).map((e) => [e.name, null])]));
          }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-slate-100 hover:text-foreground"
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
    <div className={cn("no-print inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg bg-slate-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => set({ [name]: o.value === options[0].value ? null : o.value })}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground",
            current === o.value && "bg-background text-foreground shadow-sm",
          )}
        >
          {o.label}
          {o.count != null && <span className="rounded bg-slate-200/80 px-1.5 text-[11px] tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
