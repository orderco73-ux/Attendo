"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Pencil, Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/overlay";
import { Field, handleResult } from "@/components/shared/form";
import { ConfirmAction } from "@/components/shared/confirm";
import { saveAdminAction, saveDoctorAction, setUserActiveAction } from "@/server/actions/admin";

type Values = { name: string; email: string; phone: string; password: string; active: boolean };

export function AccountDialog({ role, user }: { role: "doctor" | "admin"; user?: { id: string; name: string; email: string; phone: string; active: boolean } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const form = useForm<Values>({ defaultValues: { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", password: "", active: user?.active ?? true } });
  const { register, formState, watch, setValue } = form;
  const label = role === "doctor" ? "دكتور" : "مدير";

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) form.reset(); }}>
      <DialogTrigger asChild>
        {user ? (
          <Button variant="ghost" size="icon-sm" aria-label="تعديل"><Pencil /></Button>
        ) : (
          <Button><Plus /> إضافة {label}</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? `تعديل حساب ${label}` : `إضافة ${label}`}</DialogTitle>
          <DialogDescription>{user ? "اترك كلمة المرور فارغة للإبقاء عليها. تغييرها يسجل خروج المستخدم من كل الأجهزة." : "سيستخدم البريد وكلمة المرور لتسجيل الدخول."}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) =>
            start(async () => {
              const res = await (role === "doctor" ? saveDoctorAction : saveAdminAction)(v, user?.id);
              if (handleResult(form, res, "تم حفظ الحساب")) {
                setOpen(false);
                router.refresh();
              }
            }),
          )}
        >
          <Field label="الاسم الكامل" required error={formState.errors.name?.message}>
            <Input {...register("name", { required: "مطلوب" })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="البريد الإلكتروني" required error={formState.errors.email?.message}>
              <Input dir="ltr" type="email" {...register("email", { required: "مطلوب" })} />
            </Field>
            <Field label="الهاتف" error={formState.errors.phone?.message}>
              <Input dir="ltr" {...register("phone")} />
            </Field>
          </div>
          <Field label={user ? "كلمة مرور جديدة" : "كلمة المرور"} required={!user} error={formState.errors.password?.message} hint="8 أحرف على الأقل">
            <Input dir="ltr" type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <label className="flex items-center justify-between rounded-xl bg-fill/60 px-3.5 py-3 text-sm">
            الحساب نشط
            <Switch checked={watch("active")} onCheckedChange={(c) => setValue("active", c)} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={pending}>حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ToggleActive({ id, active, name }: { id: string; active: boolean; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Power />}
      triggerProps={{ variant: "ghost", size: "icon-sm", "aria-label": active ? "تعطيل" : "تفعيل", className: active ? "text-destructive" : "text-success" }}
      title={active ? `تعطيل حساب ${name}؟` : `تفعيل حساب ${name}؟`}
      description={active ? "لن يتمكن من تسجيل الدخول وسيتم إنهاء جلساته الحالية. لن تُحذف أي بيانات." : "سيتمكن من تسجيل الدخول مجددًا."}
      destructive={active}
      confirmLabel={active ? "تعطيل" : "تفعيل"}
      success="تم التحديث"
      onConfirm={async () => {
        const r = await setUserActiveAction(id, !active);
        if (r.ok) router.refresh();
        return r;
      }}
    />
  );
}
