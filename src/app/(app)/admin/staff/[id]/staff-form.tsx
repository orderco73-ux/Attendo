"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/misc";
import { Field, handleResult, CheckList } from "@/components/shared/form";
import { Section } from "@/components/shared/page";
import type { Structure } from "@/server/services/academic";
import { DEFAULT_KIND_PERMISSIONS, PERMISSIONS, PERMISSION_LABELS, STAFF_KINDS, STAFF_KIND_LABELS, type Permission, type StaffKind } from "@/lib/constants";
import { saveStaffAction } from "@/server/actions/admin";

export interface StaffFormValues {
  name: string;
  email: string;
  phone: string;
  password: string;
  active: boolean;
  kind: StaffKind;
  title: string;
  permissions: Permission[];
  scope: { college: string; academicYears: string[]; departments: string[]; sections: string[] };
}

export function StaffForm({ structure, id, initial }: { structure: Structure; id?: string; initial: StaffFormValues | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<StaffFormValues>({
    defaultValues: initial ?? {
      name: "",
      email: "",
      phone: "",
      password: "",
      active: true,
      kind: "class_leader",
      title: "",
      permissions: DEFAULT_KIND_PERMISSIONS.class_leader,
      scope: { college: structure.colleges[0]?.id ?? "", academicYears: [], departments: [], sections: [] },
    },
  });
  const { register, watch, setValue, formState } = form;
  const v = watch();
  const years = structure.years.filter((y) => y.college === v.scope.college);
  const depts = structure.departments.filter((d) => d.college === v.scope.college);
  const sections = structure.sections.filter((s) => s.college === v.scope.college && (!v.scope.academicYears.length || v.scope.academicYears.includes(s.academicYear)));
  const groups = [...new Set(PERMISSIONS.map((p) => PERMISSION_LABELS[p].group))];
  const err = (k: string) => (formState.errors as Record<string, { message?: string }>)[k]?.message;

  return (
    <form
      className="grid gap-6 lg:grid-cols-3"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = await saveStaffAction(values, id);
          if (handleResult(form, res, "تم حفظ عضو الطاقم")) {
            router.push("/admin/staff");
            router.refresh();
          }
        }),
      )}
    >
      <div className="grid gap-6 lg:col-span-2">
        <Section title="بيانات الحساب">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="الاسم الكامل" required error={err("name")} className="sm:col-span-2">
              <Input {...register("name", { required: "مطلوب" })} />
            </Field>
            <Field label="البريد الإلكتروني" required error={err("email")}>
              <Input dir="ltr" type="email" {...register("email", { required: "مطلوب" })} />
            </Field>
            <Field label="الهاتف">
              <Input dir="ltr" {...register("phone")} />
            </Field>
            <Field label={id ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"} required={!id} error={err("password")} hint="8 أحرف على الأقل">
              <Input dir="ltr" type="password" autoComplete="new-password" {...register("password")} />
            </Field>
            <label className="flex items-center justify-between self-end rounded-xl bg-fill/60 px-3.5 py-2.5 text-sm">
              الحساب نشط
              <Switch checked={v.active} onCheckedChange={(c) => setValue("active", c)} />
            </label>
          </div>
        </Section>

        <Section title="النطاق الأكاديمي" description="ترك القائمة فارغة يعني «الكل» داخل الكلية المختارة.">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="الكلية" required error={err("scope.college")} className="sm:col-span-2">
              <NativeSelect
                value={v.scope.college}
                onChange={(e) => setValue("scope", { college: e.target.value, academicYears: [], departments: [], sections: [] })}
              >
                {structure.colleges.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="السنوات الدراسية">
              <CheckList options={years.map((y) => ({ value: y.id, label: y.name }))} value={v.scope.academicYears} onChange={(x) => setValue("scope.academicYears", x)} />
            </Field>
            <Field label="الأقسام / التخصصات">
              <CheckList options={depts.map((d) => ({ value: d.id, label: d.name }))} value={v.scope.departments} onChange={(x) => setValue("scope.departments", x)} />
            </Field>
            {sections.length > 0 && (
              <Field label="الشعب" className="sm:col-span-2">
                <CheckList options={sections.map((s) => ({ value: s.id, label: s.name, hint: structure.years.find((y) => y.id === s.academicYear)?.name }))} value={v.scope.sections} onChange={(x) => setValue("scope.sections", x)} />
              </Field>
            )}
          </div>
        </Section>
      </div>

      <div className="grid content-start gap-6">
        <Section title="الدور">
          <div className="grid gap-4 p-5">
            <Field label="نوع الدور">
              <NativeSelect
                value={v.kind}
                onChange={(e) => {
                  const k = e.target.value as StaffKind;
                  setValue("kind", k);
                  if (!id) setValue("permissions", DEFAULT_KIND_PERMISSIONS[k]);
                }}
              >
                {STAFF_KINDS.map((k) => (
                  <option key={k} value={k}>{STAFF_KIND_LABELS[k]}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="المسمى الظاهر (اختياري)" hint="مثال: قائد الفرقة الأولى">
              <Input {...register("title")} />
            </Field>
          </div>
        </Section>
        <Section title="الصلاحيات" description={`${v.permissions.length} من ${PERMISSIONS.length}`}>
          <div className="grid gap-4 p-5">
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{g}</div>
                <div className="grid gap-1">
                  {PERMISSIONS.filter((p) => PERMISSION_LABELS[p].group === g).map((p) => {
                    const on = v.permissions.includes(p);
                    return (
                      <label key={p} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-fill/50">
                        {PERMISSION_LABELS[p].label}
                        <Switch checked={on} onCheckedChange={(c) => setValue("permissions", c ? [...v.permissions, p] : v.permissions.filter((x) => x !== p))} />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground">
              لا يستطيع أعضاء الطاقم فتح أو إغلاق الجلسات أو تعديل الحضور بعد الإغلاق. التسجيل متاح فقط أثناء فتح الجلسة.
            </p>
          </div>
        </Section>
        <div className="flex gap-2">
          <Button type="submit" loading={pending} className="flex-1">حفظ</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
        </div>
      </div>
    </form>
  );
}
