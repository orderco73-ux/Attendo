"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, handleResult } from "@/components/shared/form";
import { changePasswordAction } from "@/server/actions/auth";

type V = { currentPassword: string; newPassword: string; confirm: string };

export function PasswordForm() {
  const [pending, start] = useTransition();
  const form = useForm<V>({ defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const { register, formState } = form;
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const res = await changePasswordAction(v);
          if (handleResult(form, res, "تم تغيير كلمة المرور")) form.reset();
        }),
      )}
    >
      <Field label="كلمة المرور الحالية" error={formState.errors.currentPassword?.message}>
        <Input dir="ltr" type="password" autoComplete="current-password" {...register("currentPassword", { required: "مطلوب" })} />
      </Field>
      <Field label="كلمة المرور الجديدة" error={formState.errors.newPassword?.message} hint="8 أحرف على الأقل">
        <Input dir="ltr" type="password" autoComplete="new-password" {...register("newPassword", { required: "مطلوب", minLength: { value: 8, message: "8 أحرف على الأقل" } })} />
      </Field>
      <Field label="تأكيد كلمة المرور" error={formState.errors.confirm?.message}>
        <Input dir="ltr" type="password" autoComplete="new-password" {...register("confirm", { required: "مطلوب" })} />
      </Field>
      <div>
        <Button type="submit" loading={pending}>حفظ</Button>
      </div>
    </form>
  );
}
