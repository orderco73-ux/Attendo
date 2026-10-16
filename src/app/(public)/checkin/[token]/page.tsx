import { XCircle } from "lucide-react";
import { connectDB } from "@/server/db/connect";
import { checkinInfo } from "@/server/services/attendance";
import { LectureStatusBadge } from "@/components/shared/badges";
import { formatDate, formatTime } from "@/lib/time";
import { ATTENDANCE_METHOD_LABELS } from "@/lib/constants";
import { CheckinClient } from "./checkin-client";

export const metadata = { title: "تسجيل الحضور" };
export const dynamic = "force-dynamic";

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connectDB();
  const info = await checkinInfo(token);
  if (!info) {
    return (
      <div className="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
        <XCircle className="mx-auto size-10 text-destructive" />
        <h1 className="mt-3 text-lg font-bold">رابط الحضور غير صالح</h1>
        <p className="mt-1 text-sm text-muted-foreground">تأكد من مسح الرمز المعروض في القاعة، أو اطلب رابطًا جديدًا من الدكتور.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto grid max-w-md gap-5">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{info.subjectName}</div>
            <h1 className="mt-0.5 text-lg font-bold">{info.title}</h1>
          </div>
          <LectureStatusBadge status={info.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{formatDate(info.startsAt)}</span>
          <span>{formatTime(info.startsAt)} – {formatTime(info.endsAt)}</span>
          {info.venue && <span>{info.venue}</span>}
          <span>الطريقة: {ATTENDANCE_METHOD_LABELS[info.method]}</span>
        </div>
      </div>
      {info.status === "open" && info.method !== "staff_only" ? (
        <CheckinClient token={token} method={info.method} />
      ) : (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          {info.method === "staff_only"
            ? "يتم تسجيل الحضور في هذه المحاضرة بواسطة الدكتور أو المسؤول."
            : info.status === "scheduled"
              ? "لم يبدأ تسجيل الحضور بعد. أعد تحميل الصفحة عند بدء المحاضرة."
              : info.status === "cancelled"
                ? "تم إلغاء هذه المحاضرة."
                : "انتهى وقت تسجيل الحضور لهذه المحاضرة."}
        </div>
      )}
    </div>
  );
}
