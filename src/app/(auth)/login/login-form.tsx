"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/form";
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-8 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await loginAction({ email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") });
          if (res.ok) {
            router.replace("/dashboard");
            router.refresh();
          } else setError(res.error);
        });
      }}
    >
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
      <Field label="البريد الإلكتروني" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required dir="ltr" className="text-left" />
      </Field>
      <Field label="كلمة المرور" htmlFor="password">
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required dir="ltr" className="pe-10 text-left" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-2 w-full">
        دخول
      </Button>
    </form>
  );
}
