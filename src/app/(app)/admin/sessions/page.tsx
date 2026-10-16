import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { Lecture, Subject } from "@/server/db/models";
import { reconcileLectures, toLectureView } from "@/server/services/lectures";
import { PageHeader, Section, EmptyState } from "@/components/shared/page";
import { FilterBar } from "@/components/shared/filters";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display";
import { LectureStatusBadge } from "@/components/shared/badges";
import { formatDate, formatTime, zonedToUtc, zonedDayRange } from "@/lib/time";
import { escapeRegex } from "@/lib/arabic";
import { ATTENDANCE_METHOD_LABELS, LECTURE_STATUS_LABELS, LECTURE_STATUSES } from "@/lib/constants";

export const metadata = { title: "جلسات الحضور" };
const PAGE = 25;

export default async function SessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor(["admin"]);
  const sp = await searchParams;
  await reconcileLectures();
  const filter: Record<string, unknown> = {};
  if (sp.status && (LECTURE_STATUSES as readonly string[]).includes(sp.status)) filter.status = sp.status;
  const range: Record<string, Date> = {};
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) range.$gte = zonedToUtc(sp.from, "00:00");
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) range.$lt = new Date(zonedToUtc(sp.to, "00:00").getTime() + 86_400_000);
  if (!sp.from && !sp.to && !sp.status) {
    const { start } = zonedDayRange();
    range.$gte = start;
  }
  if (Object.keys(range).length) filter.startsAt = range;
  if (sp.q) {
    const codePart = sp.q.replace(/[^A-Za-z0-9_-]/g, "");
    const or: Record<string, unknown>[] = [{ name: { $regex: escapeRegex(sp.q), $options: "i" } }];
    if (codePart) or.push({ code: { $regex: codePart, $options: "i" } });
    const subs = await Subject.find({ $or: or }).distinct("_id");
    filter.subject = { $in: subs };
  }
  const page = Math.max(1, Number(sp.page) || 1);
  const [items, total] = await Promise.all([Lecture.find(filter).sort({ startsAt: 1 }).skip((page - 1) * PAGE).limit(PAGE).lean(), Lecture.countDocuments(filter)]);
  const subjects = await Subject.find({ _id: { $in: items.map((i) => i.subject) } }).select("name code").lean();
  const sub = (id: unknown) => subjects.find((s) => String(s._id) === String(id));
  return (
    <>
      <PageHeader title="جلسات الحضور" description="كل المحاضرات وجلسات الحضور في النظام (افتراضيًا: من اليوم فصاعدًا)." breadcrumbs={[{ href: "/dashboard", label: "الرئيسية" }, { label: "جلسات الحضور" }]} />
      <Section>
        <FilterBar
          searchPlaceholder="بحث باسم أو كود المادة…"
          selects={[{ name: "status", label: "الحالات", options: LECTURE_STATUSES.map((s) => ({ value: s, label: LECTURE_STATUS_LABELS[s] })) }]}
          extra={[{ name: "from", label: "من", type: "date" }, { name: "to", label: "إلى", type: "date" }]}
        />
        {items.length === 0 ? (
          <EmptyState icon={CalendarClock} title="لا توجد جلسات مطابقة" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المادة</TableHead>
                <TableHead>المحاضرة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الوقت</TableHead>
                <TableHead>الطريقة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => {
                const v = toLectureView(l);
                return (
                  <TableRow key={v.id}>
                    <TableCell data-cell="subtitle">
                      <div className="font-medium">{sub(l.subject)?.name}</div>
                      <div className="ltr text-start text-xs text-muted-foreground">{sub(l.subject)?.code}</div>
                    </TableCell>
                    <TableCell data-cell="title">
                      <Link href={`/lectures/${v.id}`} className="font-medium text-primary hover:underline">{v.title}</Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(v.startsAt)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatTime(v.startsAt)} – {formatTime(v.endsAt)}</TableCell>
                    <TableCell data-cell="hide" className="text-xs">{ATTENDANCE_METHOD_LABELS[v.method]}</TableCell>
                    <TableCell data-cell="trailing"><LectureStatusBadge status={v.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} />
      </Section>
    </>
  );
}
