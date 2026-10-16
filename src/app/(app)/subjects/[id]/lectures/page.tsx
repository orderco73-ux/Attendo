import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { listSubjectLectures } from "@/server/services/lectures";
import { subjectCapabilities } from "@/server/services/subjects";
import { getSettings } from "@/server/services/settings";
import { Section, EmptyState } from "@/components/shared/page";
import { ParamTabs } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { LectureStatusBadge } from "@/components/shared/badges";
import { formatDate, formatTime, formatWeekday, todayKey } from "@/lib/time";
import { ATTENDANCE_METHOD_LABELS, SESSION_MODE_LABELS } from "@/lib/constants";
import { NewLectureButton } from "./new-lecture";

export default async function LecturesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const [data, settings] = await Promise.all([listSubjectLectures(actor, id, { status: sp.status, page: Number(sp.page) || 1 }), getSettings()]);
  const caps = subjectCapabilities(actor, data.subject);
  return (
    <Section title="المحاضرات وجلسات الحضور" actions={caps.manage && <NewLectureButton subjectId={id} defaultRadius={settings.defaultRadiusM} today={todayKey()} />}>
      <div className="border-b-[0.5px] px-4 py-3">
        <ParamTabs
          name="status"
          options={[
            { value: "all", label: "الكل" },
            { value: "open", label: "مفتوحة" },
            { value: "scheduled", label: "مجدولة" },
            { value: "closed", label: "مغلقة" },
            { value: "cancelled", label: "ملغاة" },
          ]}
        />
      </div>
      {data.items.length === 0 ? (
        <EmptyState icon={CalendarClock} title="لا توجد محاضرات" description={caps.manage ? "أنشئ محاضرة وحدد طريقة الحضور." : undefined} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المحاضرة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الوقت</TableHead>
              <TableHead className="hidden md:table-cell">المكان</TableHead>
              <TableHead className="hidden md:table-cell">الطريقة</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <Link href={`/lectures/${l.id}`} className="font-medium text-primary hover:underline">
                    {l.number ? `${l.number}. ` : ""}
                    {l.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">{SESSION_MODE_LABELS[l.mode]}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(l.startsAt)}
                  <div className="text-xs text-muted-foreground">{formatWeekday(l.startsAt)}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatTime(l.startsAt)} – {formatTime(l.endsAt)}</TableCell>
                <TableCell className="hidden md:table-cell">{l.venue || "—"}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{ATTENDANCE_METHOD_LABELS[l.method]}</TableCell>
                <TableCell><LectureStatusBadge status={l.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} />
    </Section>
  );
}
