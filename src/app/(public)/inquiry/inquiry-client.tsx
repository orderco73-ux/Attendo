"use client";
import { useState, useTransition } from "react";
import { AlertCircle, CalendarClock, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/display";
import { Field } from "@/components/shared/form";
import { PercentBadge } from "@/components/shared/badges";
import { inquiryAction } from "@/server/actions/public";
import type { InquiryResult } from "@/server/services/inquiry";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const HIST: Record<string, { label: string; v: "success" | "danger" | "warning" | "muted" }> = {
  present: { label: "حاضر", v: "success" },
  absent: { label: "غائب", v: "danger" },
  excused: { label: "بعذر", v: "warning" },
  pending: { label: "لم تُغلق بعد", v: "muted" },
  na: { label: "قبل التسجيل", v: "muted" },
};

export function InquiryClient({ needsVerification }: { needsVerification: boolean }) {
  const [code, setCode] = useState("");
  const [verify, setVerify] = useState("");
  const [result, setResult] = useState<InquiryResult | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-6 grid gap-6">
      <form
        className="grid gap-3 rounded-2xl bg-card shadow-card p-4 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setResult(await inquiryAction(code, verify));
            setOpen(null);
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="كود الطالب" htmlFor="code" className={needsVerification ? "" : "sm:col-span-2"}>
            <Input id="code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ST00005" autoComplete="off" required maxLength={20} className="text-left font-mono uppercase" />
          </Field>
          {needsVerification && (
            <Field label="رقم القيد" htmlFor="verify">
              <Input id="verify" dir="ltr" value={verify} onChange={(e) => setVerify(e.target.value)} autoComplete="off" required maxLength={40} className="text-left" />
            </Field>
          )}
        </div>
        <Button type="submit" loading={pending} size="lg">{!pending && <Search />} استعلام</Button>
      </form>

      {result && !result.ok && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {result.message}
        </div>
      )}

      {result?.ok && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card shadow-card px-4 py-3">
            <div>
              <div className="text-lg font-bold">{result.student.name}</div>
              <div className="text-sm text-muted-foreground">{result.student.year} — {result.student.department}</div>
            </div>
            <span className="ltr rounded-xl bg-brand-soft px-2.5 py-1 font-mono text-sm font-semibold text-primary">{result.student.code}</span>
          </div>
          {result.subjects.length === 0 && <p className="rounded-2xl bg-card shadow-card px-4 py-8 text-center text-sm text-muted-foreground">لا توجد مواد مسجلة لهذا الطالب.</p>}
          {result.subjects.map((s) => {
            const isOpen = open === s.code;
            return (
              <div key={s.code} className="overflow-hidden rounded-2xl bg-card shadow-card">
                <button type="button" onClick={() => setOpen(isOpen ? null : s.code)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-fill/50" aria-expanded={isOpen}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{s.name}</div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>محتسبة: <b className="text-foreground tabular-nums">{s.eligible}</b></span>
                      <span>حضور: <b className="text-success tabular-nums">{s.attended}</b></span>
                      <span>غياب: <b className="text-destructive tabular-nums">{s.absences}</b></span>
                      {s.excused > 0 && <span>بعذر: <b className="text-warning tabular-nums">{s.excused}</b></span>}
                    </div>
                  </div>
                  <PercentBadge value={s.percentage} threshold={result.lowThreshold} />
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="border-t">
                    {s.upcoming.length > 0 && (
                      <div className="border-b bg-brand-soft/40 px-4 py-3">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary"><CalendarClock className="size-3.5" /> المحاضرات القادمة</div>
                        <ul className="grid gap-1 text-sm">
                          {s.upcoming.map((u, i) => (
                            <li key={i} className="flex flex-wrap justify-between gap-2">
                              <span>{u.title}</span>
                              <span className="text-xs text-muted-foreground">{formatDateTime(u.startsAt)}{u.venue ? ` · ${u.venue}` : ""}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.history.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">لا توجد محاضرات سابقة.</p>
                    ) : (
                      <ul className="divide-y-[0.5px]">
                        {s.history.map((h, i) => (
                          <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                            <div className="min-w-0">
                              <div className="truncate">{h.title}</div>
                              <div className="text-xs text-muted-foreground">{formatDate(h.startsAt)} · {formatTime(h.startsAt)}</div>
                            </div>
                            <Badge variant={HIST[h.status].v}>{HIST[h.status].label}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">يُحتسب الغياب فقط بعد إغلاق جلسة الحضور. المحاضرات الملغاة لا تُحتسب. للاستفسار تواصل مع دكتور المادة.</p>
        </div>
      )}
    </div>
  );
}
