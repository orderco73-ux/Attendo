"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, handleResult } from "@/components/shared/form";
import type { Structure } from "@/server/services/academic";
import { createStudentAction, updateStudentAction } from "@/server/actions/students";

export interface StudentFormValues {
  fullName: string;
  registrationNumber: string;
  academicYear: string;
  department: string;
  section: string;
  notes: string;
  allowSameName: boolean;
}

export function StudentForm({ structure, id, initial, years }: { structure: Structure; id?: string; initial?: StudentFormValues; years: Structure["years"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sameNameConflict, setSameNameConflict] = useState(false);
  const form = useForm<StudentFormValues>({
    defaultValues: initial ?? { fullName: "", registrationNumber: "", academicYear: years[0]?.id ?? "", department: "", section: "", notes: "", allowSameName: false },
  });
  const { register, watch, setValue, formState } = form;
  const v = watch();
  const year = structure.years.find((y) => y.id === v.academicYear);
  const policy = year?.specializationPolicy;
  const depts = structure.departments.filter((d) => d.college === year?.college && d.active && (policy === "specialized" ? !d.isGeneral : policy === "general_only" ? d.isGeneral : true));
  const sections = structure.sections.filter((s) => s.academicYear === v.academicYear && s.active && (!s.department || s.department === v.department));

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = id ? await updateStudentAction(id, values) : await createStudentAction(values);
          if (!res.ok && res.error.includes("بنفس الاسم")) setSameNameConflict(true);
          if (handleResult(form, res, id ? "تم حفظ التعديلات" : `تمت إضافة الطالب`)) {
            if (id) router.refresh();
            else router.push(`/students/${res.data.id}`);
          }
        }),
      )}
    >
      <Field label="الاسم الكامل (رباعي)" required error={formState.errors.fullName?.message}>
        <Input {...register("fullName", { required: "الاسم مطلوب", minLength: { value: 5, message: "الاسم قصير" } })} autoFocus={!id} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="السنة الدراسية" required error={formState.errors.academicYear?.message}>
          <NativeSelect
            value={v.academicYear}
            onChange={(e) => {
              setValue("academicYear", e.target.value);
              setValue("department", "");
              setValue("section", "");
            }}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="التخصص"
          required={policy !== "general_only"}
          error={formState.errors.department?.message}
          hint={policy === "general_only" ? "طلاب هذه السنة يُسجلون تلقائيًا «بدون تخصص»." : undefined}
        >
          {policy === "general_only" ? (
            <Input value={structure.departments.find((d) => d.college === year?.college && d.isGeneral)?.name ?? "بدون تخصص"} disabled />
          ) : (
            <NativeSelect value={v.department} onChange={(e) => setValue("department", e.target.value)} aria-invalid={!!formState.errors.department}>
              <option value="">اختر التخصص</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="الشعبة" error={formState.errors.section?.message}>
          <NativeSelect value={v.section} onChange={(e) => setValue("section", e.target.value)} disabled={!sections.length}>
            <option value="">{sections.length ? "بدون شعبة" : "لا توجد شعب"}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="رقم القيد الجامعي" error={formState.errors.registrationNumber?.message} hint="اختياري — يُستخدم لمنع التكرار عند الاستيراد.">
          <Input dir="ltr" {...register("registrationNumber")} />
        </Field>
      </div>
      <Field label="ملاحظات">
        <Textarea rows={2} {...register("notes")} />
      </Field>
      {sameNameConflict && (
        <label className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <input type="checkbox" className="mt-1 size-4" {...register("allowSameName")} />
          <span>
            <Info className="me-1 inline size-4" />
            أؤكد أن هذا طالب مختلف يحمل نفس الاسم.
          </span>
        </label>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>{id ? "حفظ التعديلات" : "إضافة الطالب"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
      </div>
    </form>
  );
}
