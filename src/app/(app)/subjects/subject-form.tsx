"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/misc";
import { Field, handleResult, CheckList } from "@/components/shared/form";
import { Section } from "@/components/shared/page";
import type { Structure } from "@/server/services/academic";
import { saveSubjectAction } from "@/server/actions/admin";

export interface SubjectFormValues {
  name: string;
  code: string;
  description: string;
  college: string;
  academicYears: string[];
  departments: string[];
  sections: string[];
  doctors: string[];
  requiresEnrollmentApproval: boolean;
  active: boolean;
}

export function SubjectForm({ structure, doctors, id, initial }: { structure: Structure; doctors: { id: string; name: string; email: string }[]; id?: string; initial: SubjectFormValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<SubjectFormValues>({ defaultValues: initial });
  const { register, watch, setValue, formState } = form;
  const v = watch();
  const years = structure.years.filter((y) => y.college === v.college);
  const depts = structure.departments.filter((d) => d.college === v.college);
  const sections = structure.sections.filter((s) => s.college === v.college && (!v.academicYears.length || v.academicYears.includes(s.academicYear)));
  return (
    <form
      className="grid gap-6 lg:grid-cols-3"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = await saveSubjectAction(values, id);
          if (handleResult(form, res, "تم حفظ المادة")) {
            router.push(`/subjects/${res.data}`);
            router.refresh();
          }
        }),
      )}
    >
      <div className="grid content-start gap-6 lg:col-span-2">
        <Section title="بيانات المادة">
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="اسم المادة" required error={formState.errors.name?.message} className="sm:col-span-2">
              <Input {...register("name", { required: "مطلوب" })} />
            </Field>
            <Field label="كود المادة" required error={formState.errors.code?.message}>
              <Input dir="ltr" {...register("code", { required: "مطلوب" })} placeholder="PE101" />
            </Field>
            <Field label="الوصف" className="sm:col-span-3">
              <Textarea rows={2} {...register("description")} />
            </Field>
          </div>
        </Section>
        <Section title="الأهلية" description="الطلاب الذين يمكن تسجيلهم في المادة. القائمة الفارغة تعني «الكل».">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="الكلية" required className="sm:col-span-2">
              <NativeSelect
                value={v.college}
                onChange={(e) => {
                  setValue("college", e.target.value);
                  setValue("academicYears", []);
                  setValue("departments", []);
                  setValue("sections", []);
                }}
              >
                {structure.colleges.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="السنوات الدراسية">
              <CheckList options={years.map((y) => ({ value: y.id, label: y.name }))} value={v.academicYears} onChange={(x) => setValue("academicYears", x)} />
            </Field>
            <Field label="الأقسام / التخصصات">
              <CheckList options={depts.map((d) => ({ value: d.id, label: d.name }))} value={v.departments} onChange={(x) => setValue("departments", x)} />
            </Field>
            {sections.length > 0 && (
              <Field label="قصر على شعب محددة (اختياري)" className="sm:col-span-2">
                <CheckList options={sections.map((s) => ({ value: s.id, label: s.name, hint: structure.years.find((y) => y.id === s.academicYear)?.name }))} value={v.sections} onChange={(x) => setValue("sections", x)} />
              </Field>
            )}
          </div>
        </Section>
      </div>
      <div className="grid content-start gap-6">
        <Section title="الدكاترة المسؤولون">
          <div className="p-5">
            <CheckList options={doctors.map((d) => ({ value: d.id, label: d.name, hint: d.email }))} value={v.doctors} onChange={(x) => setValue("doctors", x)} emptyText="لا يوجد دكاترة. أضفهم من صفحة الدكاترة." maxHeight="16rem" />
          </div>
        </Section>
        <Section title="الخيارات">
          <div className="divide-y-[0.5px]">
            <label className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
              <span>
                طلبات التسجيل تتطلب موافقة الدكتور
                <span className="block text-xs text-muted-foreground">تنطبق على الطلبات المقدمة من الطاقم.</span>
              </span>
              <Switch checked={v.requiresEnrollmentApproval} onCheckedChange={(c) => setValue("requiresEnrollmentApproval", c)} />
            </label>
            <label className="flex items-center justify-between px-5 py-3.5 text-sm">
              المادة مفعلة
              <Switch checked={v.active} onCheckedChange={(c) => setValue("active", c)} />
            </label>
          </div>
        </Section>
        <div className="flex gap-2">
          <Button type="submit" loading={pending} className="flex-1">حفظ المادة</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
        </div>
      </div>
    </form>
  );
}
