"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, QrCode, Search, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/shared/page";
import { RecordStatusBadge } from "@/components/shared/badges";
import { QrScanner } from "@/components/shared/qr-scanner";
import { searchLectureStudentsAction, staffMarkAction } from "@/server/actions/teaching";
import type { RecordStatus } from "@/lib/constants";

type Hit = { studentId: string; code: string; fullName: string; status: RecordStatus | null };

/** Staff-assisted attendance: search by name/code or scan the student's card QR. */
export function StaffMarker({ lectureId }: { lectureId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [scan, setScan] = useState(false);
  const [last, setLast] = useState<{ name: string; code: string; already: boolean } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const r = await searchLectureStudentsAction(lectureId, term);
      if (r.ok) setHits(r.data);
    }, 250);
    return () => clearTimeout(t);
  }, [q, lectureId]);

  const mark = (ident: { studentId?: string; code?: string; qr?: string }) =>
    start(async () => {
      const r = await staffMarkAction(lectureId, ident);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setLast({ name: r.data.student.fullName, code: r.data.student.code, already: r.data.alreadyPresent });
      if (r.data.alreadyPresent) toast.info(`${r.data.student.fullName} مسجل حاضر بالفعل`);
      else toast.success(`تم تسجيل حضور ${r.data.student.fullName}`);
      setQ("");
      setHits([]);
      input.current?.focus();
      router.refresh();
    });

  // Results only apply to a meaningful term; stale hits are hidden instead of cleared in an effect.
  const shown = q.trim().length >= 2 ? hits : [];

  return (
    <Section
      title="تسجيل الحضور بواسطة الطاقم"
      description="ابحث بالاسم أو الكود، أو امسح QR بطاقة الطالب."
      actions={
        <Button size="sm" variant={scan ? "secondary" : "outline"} onClick={() => setScan((s) => !s)}>
          {scan ? <X /> : <QrCode />} {scan ? "إيقاف الكاميرا" : "مسح QR"}
        </Button>
      }
    >
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto]">
        <div className="grid content-start gap-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const term = q.trim();
              if (/^st\s*\d+$/i.test(term)) mark({ code: term });
              else if (shown.length === 1) mark({ studentId: shown[0].studentId });
              else if (shown.length > 1) toast.info("اختر الطالب من القائمة");
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم أو الكود (مثال ST00012)" className="ps-8" autoComplete="off" aria-label="بحث عن طالب" />
            </div>
            <Button type="submit" loading={pending}><UserCheck /> تسجيل</Button>
          </form>
          {shown.length > 0 && (
            <ul className="divide-y-[0.5px] overflow-hidden rounded-xl bg-fill/50">
              {shown.map((h) => (
                <li key={h.studentId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{h.fullName}</div>
                    <div className="ltr text-start font-mono text-xs text-primary">{h.code}</div>
                  </div>
                  {h.status === "present" ? (
                    <RecordStatusBadge status="present" />
                  ) : (
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => mark({ studentId: h.studentId })}>حاضر</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && shown.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد طالب مسجل في المادة بهذا الاسم/الكود ضمن نطاقك.</p>}
          {last && (
            <div className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm text-success" role="status">
              <CheckCircle2 className="size-4" />
              {last.already ? "مسجل مسبقًا:" : "آخر تسجيل:"} {last.name} <span className="ltr font-mono text-xs">{last.code}</span>
            </div>
          )}
        </div>
        {scan && (
          <div className="w-full md:w-72">
            <QrScanner onResult={(text) => mark(text.startsWith("ATD1.") ? { qr: text } : { code: text })} />
          </div>
        )}
      </div>
    </Section>
  );
}
