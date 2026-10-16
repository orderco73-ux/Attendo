"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, handleResult } from "@/components/shared/form";
import { ATTENDANCE_METHODS, ATTENDANCE_METHOD_LABELS, SESSION_MODES, SESSION_MODE_LABELS, type AttendanceMethod, type SessionMode } from "@/lib/constants";
import { createLecturesAction, updateLectureAction } from "@/server/actions/teaching";
import { cn } from "@/lib/utils";

export interface LectureFormValues {
  title: string;
  number: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  mode: SessionMode;
  method: AttendanceMethod;
  opensDate: string;
  opensTime: string;
  closesDate: string;
  closesTime: string;
  lat: string;
  lng: string;
  radiusM: string;
  repeatWeeks: string;
}

/** Read-only look without dropping the value from the submitted form (disabled fields are omitted). */
const lockIf = (on: boolean) => (on ? { readOnly: true, tabIndex: -1, "aria-disabled": true, className: "pointer-events-none opacity-60" } : {});

const METHOD_HINTS: Record<AttendanceMethod, string> = {
  location: "الطالب يفتح رابط الحضور ويُتحقق من وجوده داخل نطاق المكان.",
  qr: "الطالب يمسح QR بطاقته؛ يثبت امتلاك البطاقة وليس الحضور الفعلي.",
  location_qr: "يجب تحقق الشرطين: QR البطاقة + الموقع داخل النطاق. الأقوى.",
  staff_only: "لا يوجد تسجيل ذاتي؛ الدكتور أو المسؤول يسجل الحضور.",
};

/** Create (subjectId) or edit (lectureId) a lecture. `locked` limits edits once the session started. */
export function LectureForm({ subjectId, lectureId, initial, defaultRadius, locked, onDone }: { subjectId?: string; lectureId?: string; initial: LectureFormValues; defaultRadius: number; locked?: "open" | "closed"; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [locating, setLocating] = useState(false);
  const form = useForm<LectureFormValues>({ defaultValues: initial });
  const { register, watch, setValue, formState } = form;
  const v = watch();
  const needsLocation = v.method === "location" || v.method === "location_qr";
  const e = (k: keyof LectureFormValues) => formState.errors[k]?.message;
  const timeLocked = !!locked;

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("المتصفح لا يدعم تحديد الموقع");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValue("lat", p.coords.latitude.toFixed(6));
        setValue("lng", p.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success(`تم تحديد الموقع (دقة ${Math.round(p.coords.accuracy)} م)`);
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "تم رفض إذن الموقع" : "تعذر تحديد الموقع");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const payload = { ...values, radiusM: values.radiusM || String(defaultRadius) };
          const res = lectureId ? await updateLectureAction(lectureId, payload) : await createLecturesAction(subjectId!, payload);
          if (handleResult(form, res, lectureId ? "تم حفظ المحاضرة" : "تم إنشاء المحاضرة")) {
            onDone?.();
            router.refresh();
          }
        }),
      )}
    >
      {locked && (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          {locked === "open" ? "الجلسة مفتوحة: يمكن تعديل العنوان والمكان وطريقة الحضور وتمديد وقت الإغلاق فقط." : "الجلسة مغلقة: يمكن تعديل العنوان والمكان فقط."}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="عنوان المحاضرة" required error={e("title")} className="sm:col-span-3">
          <Input {...register("title", { required: "مطلوب" })} placeholder="مثال: مقدمة في فسيولوجيا الجهد البدني" />
        </Field>
        <Field label="رقم المحاضرة" error={e("number")}>
          <Input type="number" min={1} {...register("number")} />
        </Field>
        <Field label="التاريخ" required error={e("date")}>
          <Input type="date" {...lockIf(timeLocked)} {...register("date", { required: "مطلوب" })} />
        </Field>
        <Field label="من" required error={e("startTime")}>
          <Input type="time" {...lockIf(timeLocked)} {...register("startTime", { required: "مطلوب" })} />
        </Field>
        <Field label="إلى" required error={e("endTime")}>
          <Input type="time" {...lockIf(timeLocked)} {...register("endTime", { required: "مطلوب" })} />
        </Field>
        <Field label="المكان / القاعة" error={e("venue")}>
          <Input {...register("venue")} />
        </Field>
      </div>

      <div className="grid gap-4 rounded-lg border bg-surface p-4 sm:grid-cols-2">
        <Field label="طريقة الحضور" hint={METHOD_HINTS[v.method]}>
          <NativeSelect {...lockIf(locked === "closed")} {...register("method")}>
            {ATTENDANCE_METHODS.map((m) => (
              <option key={m} value={m}>{ATTENDANCE_METHOD_LABELS[m]}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="فتح وإغلاق الحضور" hint={v.mode === "manual" ? "تفتح الجلسة وتغلقها بنفسك من صفحة المحاضرة." : "تفتح وتغلق تلقائيًا حسب توقيت الخادم."}>
          <NativeSelect {...lockIf(timeLocked)} {...register("mode")}>
            {SESSION_MODES.map((m) => (
              <option key={m} value={m}>{SESSION_MODE_LABELS[m]}</option>
            ))}
          </NativeSelect>
        </Field>
        {v.mode === "scheduled" && (
          <>
            <Field label="يفتح الحضور" required error={e("opensTime")}>
              <div className="flex gap-2">
                <Input type="date" {...lockIf(timeLocked)} {...register("opensDate")} />
                <Input type="time" {...lockIf(timeLocked)} {...register("opensTime")} />
              </div>
            </Field>
            <Field label="يغلق الحضور" required error={e("closesTime")}>
              <div className="flex gap-2">
                <Input type="date" {...lockIf(locked === "closed")} {...register("closesDate")} />
                <Input type="time" {...lockIf(locked === "closed")} {...register("closesTime")} />
              </div>
            </Field>
          </>
        )}
        {needsLocation && (
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
            <Field label="خط العرض" required error={e("lat")}>
              <Input dir="ltr" inputMode="decimal" {...lockIf(locked === "closed")} {...register("lat")} placeholder="30.0444" />
            </Field>
            <Field label="خط الطول" required error={e("lng")}>
              <Input dir="ltr" inputMode="decimal" {...lockIf(locked === "closed")} {...register("lng")} placeholder="31.2357" />
            </Field>
            <Field label="النطاق (م)" error={e("radiusM")}>
              <Input type="number" min={10} max={5000} {...lockIf(locked === "closed")} {...register("radiusM")} placeholder={String(defaultRadius)} />
            </Field>
            <Button type="button" variant="outline" onClick={useMyLocation} loading={locating} {...lockIf(locked === "closed")}>
              {!locating && <Crosshair />} موقعي الحالي
            </Button>
          </div>
        )}
      </div>

      {!lectureId && (
        <Field label="تكرار أسبوعي" hint="إنشاء نفس المحاضرة أسبوعيًا لعدد من الأسابيع (بنفس اليوم والتوقيت).">
          <NativeSelect className={cn("sm:w-48")} {...register("repeatWeeks")}>
            {[1, 2, 4, 6, 8, 10, 12, 14, 16].map((n) => (
              <option key={n} value={n}>{n === 1 ? "مرة واحدة" : `${n} أسابيع`}</option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>{lectureId ? "حفظ التعديلات" : "إنشاء المحاضرة"}</Button>
        {onDone && <Button type="button" variant="outline" onClick={onDone}>إلغاء</Button>}
      </div>
    </form>
  );
}
