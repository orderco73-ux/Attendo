import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Download, MapPin, Radar } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { lectureSheet } from "@/server/services/attendance";
import { subjectCapabilities } from "@/server/services/subjects";
import { getSettings } from "@/server/services/settings";
import { AppError } from "@/server/errors";
import { PageHeader, Section, StatStrip } from "@/components/shared/page";
import { LectureStatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { formatDate, formatDateTime, formatTime, utcToZonedParts } from "@/lib/time";
import { ATTENDANCE_METHOD_LABELS, SESSION_MODE_LABELS } from "@/lib/constants";
import { SessionControls } from "./session-controls";
import { StaffMarker } from "./staff-marker";
import { AttendanceSheet } from "./attendance-sheet";
import { CheckinPanel } from "./checkin-panel";

export const metadata = { title: "جلسة الحضور" };

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function LecturePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  let sheet;
  try {
    sheet = await lectureSheet(actor, id, { q: sp.q, filter: sp.filter, page: Number(sp.page) || 1, pageSize: 50 });
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const { lecture: l, subject, status, summary } = sheet;
  const caps = subjectCapabilities(actor, subject);
  const settings = await getSettings();
  const absentNow = status === "closed" ? summary.enrolled - summary.present - summary.excused : summary.absentExplicit;
  const checkinUrl = `${await baseUrl()}/checkin/${l.attendance.checkinToken}`;
  const showCheckin = caps.manage && l.attendance.method !== "staff_only" && (status === "open" || status === "scheduled");
  const checkinQr = showCheckin ? await QRCode.toDataURL(checkinUrl, { margin: 1, width: 360, errorCorrectionLevel: "M" }) : null;
  const s = utcToZonedParts(l.startsAt);
  const e = utcToZonedParts(l.endsAt);
  const o = l.attendance.opensAt ? utcToZonedParts(l.attendance.opensAt) : null;
  const c = l.attendance.closesAt ? utcToZonedParts(l.attendance.closesAt) : null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {l.number ? `${l.number}. ` : ""}
            {l.title}
            <LectureStatusBadge status={status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={`/subjects/${subject._id}`} className="font-medium text-primary hover:underline">{subject.name}</Link>
            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(l.startsAt)}</span>
            <span className="flex items-center gap-1"><Clock className="size-3.5" />{formatTime(l.startsAt)} – {formatTime(l.endsAt)}</span>
            {l.venue && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{l.venue}</span>}
          </span>
        }
        breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { href: `/subjects/${subject._id}/lectures`, label: subject.name }, { label: l.title }]}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><a href={`/api/lectures/${id}/export`}><Download /> Excel</a></Button>
            {caps.manage && (
              <SessionControls
                lectureId={id}
                status={status}
                mode={l.attendance.mode}
                defaultRadius={settings.defaultRadiusM}
                initial={{
                  title: l.title,
                  number: l.number ? String(l.number) : "",
                  date: s.date,
                  startTime: s.time,
                  endTime: e.time,
                  venue: l.venue ?? "",
                  mode: l.attendance.mode,
                  method: l.attendance.method,
                  opensDate: o?.date ?? s.date,
                  opensTime: o?.time ?? "",
                  closesDate: c?.date ?? s.date,
                  closesTime: c?.time ?? "",
                  lat: l.attendance.location ? String(l.attendance.location.lat) : "",
                  lng: l.attendance.location ? String(l.attendance.location.lng) : "",
                  radiusM: l.attendance.radiusM ? String(l.attendance.radiusM) : "",
                  repeatWeeks: "1",
                }}
              />
            )}
          </>
        }
      />

      {status === "cancelled" && (
        <div className="mb-5 rounded-md border border-destructive/20 bg-danger-soft px-4 py-3 text-sm text-destructive">
          المحاضرة ملغاة{l.cancelReason ? `: ${l.cancelReason}` : ""}. لا تُحتسب ضمن الحضور أو الغياب.
        </div>
      )}

      <StatStrip
        items={[
          { label: "المسجلون في المادة", value: summary.enrolled },
          { label: "حاضر", value: summary.present, tone: "success" },
          { label: "بعذر", value: summary.excused, tone: "warning" },
          { label: status === "closed" ? "غائب" : "غائب (مسجل)", value: absentNow, tone: "danger", hint: status === "closed" ? undefined : "يُحتسب الغياب بعد الإغلاق" },
          { label: "نسبة الحضور", value: summary.enrolled ? `${Math.round((summary.present / summary.enrolled) * 1000) / 10}%` : "—", tone: "primary" },
        ]}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          {caps.mark && status === "open" && <StaffMarker lectureId={id} />}
          <AttendanceSheet
            lectureId={id}
            status={status}
            canEdit={caps.manage}
            total={sheet.total}
            page={sheet.page}
            pageSize={sheet.pageSize}
            items={sheet.items.map((i) => ({ studentId: i.student.id, code: i.student.code, fullName: i.student.fullName, record: i.record }))}
          />
        </div>
        <div className="grid content-start gap-6">
          <Section title="تفاصيل الجلسة">
            <dl className="grid gap-3 p-5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">طريقة الحضور</dt><dd><Badge>{ATTENDANCE_METHOD_LABELS[l.attendance.method]}</Badge></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">نوع التشغيل</dt><dd>{SESSION_MODE_LABELS[l.attendance.mode]}</dd></div>
              {l.attendance.opensAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">يفتح</dt><dd>{formatDateTime(l.attendance.opensAt)}</dd></div>}
              {l.attendance.closesAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">يغلق</dt><dd>{formatDateTime(l.attendance.closesAt)}</dd></div>}
              {l.openedAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">فُتح فعليًا</dt><dd>{formatDateTime(l.openedAt)}</dd></div>}
              {l.closedAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">أُغلق فعليًا</dt><dd>{formatDateTime(l.closedAt)}</dd></div>}
              {l.attendance.location && (
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1 text-muted-foreground"><Radar className="size-3.5" />النطاق</dt>
                  <dd>
                    <a className="text-primary hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${l.attendance.location.lat},${l.attendance.location.lng}`}>
                      {l.attendance.radiusM} م حول الموقع
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Section>
          {showCheckin && checkinQr && <CheckinPanel lectureId={id} url={checkinUrl} qr={checkinQr} open={status === "open"} title={`${subject.name} — ${l.title}`} />}
        </div>
      </div>
    </>
  );
}
