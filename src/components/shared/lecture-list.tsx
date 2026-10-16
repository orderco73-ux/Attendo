import Link from "next/link";
import { CalendarClock, ChevronLeft, MapPin } from "lucide-react";
import { LectureStatusBadge } from "./badges";
import { EmptyState } from "./page";
import { formatDate, formatTime, formatWeekday } from "@/lib/time";
import { ATTENDANCE_METHOD_LABELS, type AttendanceMethod, type LectureStatus } from "@/lib/constants";

export interface LectureListItem {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue?: string;
  status: LectureStatus;
  method: AttendanceMethod;
  subjectName?: string;
  subjectCode?: string;
}

export function LectureList({ items, emptyTitle = "لا توجد محاضرات", emptyDescription, showDate = false }: { items: LectureListItem[]; emptyTitle?: string; emptyDescription?: string; showDate?: boolean }) {
  if (!items.length) return <EmptyState icon={CalendarClock} title={emptyTitle} description={emptyDescription} className="py-10" />;
  return (
    <ul className="divide-y">
      {items.map((l) => (
        <li key={l.id}>
          <Link href={`/lectures/${l.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5">
            <div className="w-16 shrink-0 text-center">
              <div className="text-sm font-semibold tabular-nums">{formatTime(l.startsAt)}</div>
              {showDate && <div className="text-[11px] text-muted-foreground">{formatWeekday(l.startsAt)}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{l.subjectName ? `${l.subjectName} — ${l.title}` : l.title}</span>
                <LectureStatusBadge status={l.status} />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {showDate && <span>{formatDate(l.startsAt)}</span>}
                <span>
                  {formatTime(l.startsAt)} – {formatTime(l.endsAt)}
                </span>
                {l.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {l.venue}
                  </span>
                )}
                <span>{ATTENDANCE_METHOD_LABELS[l.method]}</span>
              </div>
            </div>
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
