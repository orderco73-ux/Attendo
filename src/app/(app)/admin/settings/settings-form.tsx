"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/misc";
import { Field, handleResult } from "@/components/shared/form";
import { Section } from "@/components/shared/page";
import type { AppSettings } from "@/server/services/settings";
import { updateSettingsAction } from "@/server/actions/admin";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="text-sm">
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<AppSettings>({ defaultValues: initial });
  const { register, watch, setValue, formState } = form;
  const v = watch();
  return (
    <form
      className="grid max-w-3xl gap-6"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = await updateSettingsAction({ ...values, defaultRadiusM: Number(values.defaultRadiusM), maxLocationAccuracyM: Number(values.maxLocationAccuracyM), lowAttendanceThreshold: Number(values.lowAttendanceThreshold) });
          if (handleResult(form, res, "تم حفظ الإعدادات")) router.refresh();
        }),
      )}
    >
      <Section title="عام">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="اسم المؤسسة" error={formState.errors.institutionName?.message} className="sm:col-span-2">
            <Input {...register("institutionName")} />
          </Field>
          <Field label="حد نسبة الحضور المنخفضة %" hint="يُستخدم لتمييز الطلاب ذوي الحضور المنخفض في التقارير.">
            <Input type="number" min={0} max={100} {...register("lowAttendanceThreshold")} />
          </Field>
        </div>
      </Section>
      <Section title="استعلام الطلاب (صفحة عامة)">
        <div className="divide-y">
          <Toggle label="تفعيل صفحة الاستعلام" checked={v.inquiryEnabled} onChange={(c) => setValue("inquiryEnabled", c)} />
          <Toggle label="عرض المحاضرات القادمة" checked={v.showUpcomingInInquiry} onChange={(c) => setValue("showUpcomingInInquiry", c)} />
          <div className="px-5 py-3.5">
            <Field label="تحقق إضافي" hint="عند التفعيل يجب على الطالب إدخال رقم القيد مع الكود. الطلاب بدون رقم قيد لن يتمكنوا من الاستعلام.">
              <NativeSelect {...register("inquiryVerification")}>
                <option value="none">بدون (الكود فقط)</option>
                <option value="registration_number">الكود + رقم القيد</option>
              </NativeSelect>
            </Field>
          </div>
        </div>
      </Section>
      <Section title="الحضور بالموقع">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="النطاق الافتراضي (متر)">
            <Input type="number" min={10} max={5000} {...register("defaultRadiusM")} />
          </Field>
          <Field label="أقصى دقة مقبولة للموقع (متر)" hint="يُرفض الموقع إذا كانت دقته أسوأ من هذه القيمة.">
            <Input type="number" min={10} max={5000} {...register("maxLocationAccuracyM")} />
          </Field>
        </div>
      </Section>
      <Section title="المواد والتسجيل">
        <div className="divide-y">
          <Toggle label="طلبات التسجيل تتطلب موافقة الدكتور افتراضيًا" hint="يُطبق على المواد الجديدة." checked={v.defaultRequiresEnrollmentApproval} onChange={(c) => setValue("defaultRequiresEnrollmentApproval", c)} />
          <Toggle label="السماح للدكاترة بتعيين مساعدين للمادة" hint="المساعدون من أعضاء الطاقم يمكنهم تسجيل الحضور أثناء فتح الجلسة." checked={v.doctorsCanManageAssistants} onChange={(c) => setValue("doctorsCanManageAssistants", c)} />
        </div>
      </Section>
      <div>
        <Button type="submit" loading={pending}>حفظ الإعدادات</Button>
      </div>
    </form>
  );
}
