import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, Inbox, PlayCircle } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { isAdmin, isDoctor, visibleSubjectsFilter, hasPermission } from "@/server/authz/policy";
import { adminOverview, attendanceTrend } from "@/server/services/reports";
import { lecturesInRange, openLecturesFor, todayRange } from "@/server/services/lectures";
import { listSubjects } from "@/server/services/subjects";
import { listPendingRequests } from "@/server/services/enrollment";
import { recentActivity } from "@/server/services/attendance";
import { Subject } from "@/server/db/models";
import { PageHeader, Section, StatStrip, EmptyState } from "@/components/shared/page";
import { LectureList } from "@/components/shared/lecture-list";
import { TrendChart } from "@/components/shared/trend-chart";
import { RecordStatusBadge, SourceBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDate } from "@/lib/time";
import type { Actor } from "@/server/auth/actor";

export const metadata = { title: "لوحة التحكم" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const actor = await requireActor();
  const { denied } = await searchParams;
  return (
    <>
      {denied && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="size-4" /> ليس لديك صلاحية للوصول إلى الصفحة المطلوبة.
        </div>
      )}
      {isAdmin(actor) ? <AdminDashboard actor={actor} /> : isDoctor(actor) ? <DoctorDashboard actor={actor} /> : <StaffDashboard actor={actor} />}
    </>
  );
}

async function ActivityList({ subjectIds }: { subjectIds: Parameters<typeof recentActivity>[0] }) {
  const items = await recentActivity(subjectIds, 8);
  if (!items.length) return <EmptyState title="لا يوجد نشاط بعد" description="سيظهر هنا آخر تسجيلات الحضور." className="py-10" />;
  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
          <div className="min-w-0">
            <div className="truncate font-medium">{a.student}</div>
            <div className="truncate text-xs text-muted-foreground">
              {a.subject} · {formatDateTime(a.at)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <SourceBadge source={a.source} />
            <RecordStatusBadge status={a.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

async function AdminDashboard({ actor }: { actor: Actor }) {
  const { start, end } = todayRange();
  const [o, trend, today, open] = await Promise.all([adminOverview(actor), attendanceTrend({}), lecturesInRange(actor, start, end), openLecturesFor(actor)]);
  const tasks = [
    o.pendingRequests > 0 && { label: `${o.pendingRequests} طلب تسجيل بانتظار مراجعة الدكاترة`, href: "/requests" },
    o.subjectsWithoutDoctor > 0 && { label: `${o.subjectsWithoutDoctor} مادة بدون دكتور مسؤول`, href: "/subjects" },
  ].filter(Boolean) as { label: string; href: string }[];
  return (
    <>
      <PageHeader title={`مرحبًا، ${actor.name}`} description={`نظرة عامة على النظام — ${formatDate(new Date())}`} />
      <StatStrip
        items={[
          { label: "الطلاب النشطون", value: o.students },
          { label: "المواد المفعلة", value: o.subjects },
          { label: "الدكاترة", value: o.doctors },
          { label: "أعضاء الطاقم", value: o.staff },
          { label: "محاضرات اليوم", value: o.todayLectures, tone: "primary" },
          { label: "جلسات مفتوحة الآن", value: o.openSessions, tone: o.openSessions ? "success" : "default" },
        ]}
      />
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Section title="نسبة الحضور اليومية" description="آخر 14 يومًا — الجلسات المغلقة فقط" className="xl:col-span-2">
          <div className="p-4">{trend.length ? <TrendChart data={trend} /> : <EmptyState title="لا توجد جلسات مغلقة خلال آخر 14 يومًا" className="py-12" />}</div>
        </Section>
        <Section title="مهام معلقة">
          {tasks.length ? (
            <ul className="divide-y">
              {tasks.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} className="flex items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-slate-50">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-warning" />
                      {t.label}
                    </span>
                    <ArrowLeft className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد مهام معلقة" className="py-10" />
          )}
        </Section>
        <Section title="محاضرات اليوم" className="xl:col-span-2" actions={<Button asChild variant="outline" size="sm"><Link href="/admin/sessions">كل الجلسات</Link></Button>}>
          <LectureList items={today} emptyTitle="لا توجد محاضرات اليوم" />
        </Section>
        <Section title="الجلسات المفتوحة الآن">
          <LectureList items={open} emptyTitle="لا توجد جلسات مفتوحة" />
        </Section>
        <Section title="آخر نشاط حضور" className="xl:col-span-3">
          <ActivityList subjectIds={[]} />
        </Section>
      </div>
    </>
  );
}

async function DoctorDashboard({ actor }: { actor: Actor }) {
  const { start, end } = todayRange();
  const weekEnd = new Date(end.getTime() + 7 * 86_400_000);
  const [subjects, today, upcoming, open, pending, mySubjectIds] = await Promise.all([
    listSubjects(actor, { pageSize: 50 }),
    lecturesInRange(actor, start, end),
    lecturesInRange(actor, end, weekEnd, 10),
    openLecturesFor(actor),
    listPendingRequests(actor, 6),
    Subject.find(visibleSubjectsFilter(actor)).distinct("_id"),
  ]);
  const trend = await attendanceTrend({ _id: { $in: mySubjectIds } });
  return (
    <>
      <PageHeader title={`مرحبًا د. ${actor.name}`} description={formatDate(new Date())} />
      <StatStrip
        items={[
          { label: "موادي", value: subjects.total },
          { label: "الطلاب المسجلون", value: subjects.items.reduce((a, s) => a + s.enrolled, 0) },
          { label: "محاضرات اليوم", value: today.length, tone: "primary" },
          { label: "جلسات مفتوحة", value: open.length, tone: open.length ? "success" : "default" },
          { label: "طلبات معلقة", value: pending.length, tone: pending.length ? "warning" : "default" },
        ]}
      />
      {open.length > 0 && (
        <Section title="جلسات الحضور المفتوحة" className="mt-6 border-success/30">
          <LectureList items={open} />
        </Section>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Section title="محاضرات اليوم" className="xl:col-span-2">
          <LectureList items={today} emptyTitle="لا توجد محاضرات اليوم" />
        </Section>
        <Section title="موادي" actions={<Button asChild variant="outline" size="sm"><Link href="/subjects">عرض الكل</Link></Button>}>
          {subjects.items.length ? (
            <ul className="divide-y">
              {subjects.items.slice(0, 8).map((s) => (
                <li key={s.id}>
                  <Link href={`/subjects/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                    <span className="flex min-w-0 items-center gap-2">
                      <BookOpen className="size-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{s.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{s.enrolled} طالب</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لم يتم إسناد مواد لك بعد" description="تواصل مع مدير النظام." className="py-10" />
          )}
        </Section>
        <Section title="المحاضرات القادمة (7 أيام)" className="xl:col-span-2">
          <LectureList items={upcoming} showDate emptyTitle="لا توجد محاضرات قادمة" />
        </Section>
        <Section title="طلبات التسجيل" actions={<Button asChild variant="outline" size="sm"><Link href="/requests">مراجعة</Link></Button>}>
          {pending.length ? (
            <ul className="divide-y">
              {pending.map((p) => (
                <li key={String(p._id)} className="px-5 py-2.5 text-sm">
                  <div className="font-medium">{p.student?.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.student?.code} · {p.subject?.name}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Inbox} title="لا توجد طلبات معلقة" className="py-10" />
          )}
        </Section>
        <Section title="نسبة الحضور في موادي" description="آخر 14 يومًا" className="xl:col-span-2">
          <div className="p-4">{trend.length ? <TrendChart data={trend} /> : <EmptyState title="لا توجد جلسات مغلقة حديثًا" className="py-12" />}</div>
        </Section>
        <Section title="آخر نشاط">
          <ActivityList subjectIds={mySubjectIds} />
        </Section>
      </div>
    </>
  );
}

async function StaffDashboard({ actor }: { actor: Actor }) {
  const { start, end } = todayRange();
  const [open, today, subjects] = await Promise.all([openLecturesFor(actor), lecturesInRange(actor, start, end), listSubjects(actor, { pageSize: 50 })]);
  const canMark = hasPermission(actor, "attendance.mark");
  return (
    <>
      <PageHeader title={`مرحبًا، ${actor.name}`} description={actor.staff?.title || "عضو الطاقم"} />
      <StatStrip
        items={[
          { label: "المواد في نطاقك", value: subjects.total },
          { label: "محاضرات اليوم", value: today.length, tone: "primary" },
          { label: "جلسات مفتوحة", value: open.length, tone: open.length ? "success" : "default" },
          { label: "الصلاحيات", value: actor.staff?.permissions.length ?? 0 },
        ]}
      />
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Section title="الجلسات المفتوحة" description={canMark ? "اختر جلسة لتسجيل حضور الطلاب" : undefined}>
          <LectureList items={open} emptyTitle="لا توجد جلسات مفتوحة الآن" />
          {canMark && open.length > 0 && (
            <div className="border-t px-5 py-2.5 text-xs text-muted-foreground">
              <PlayCircle className="me-1 inline size-3.5" />
              يمكنك تسجيل الحضور فقط أثناء فتح الجلسة وللطلاب داخل نطاقك.
            </div>
          )}
        </Section>
        <Section title="محاضرات اليوم">
          <LectureList items={today} emptyTitle="لا توجد محاضرات اليوم" />
        </Section>
      </div>
    </>
  );
}
