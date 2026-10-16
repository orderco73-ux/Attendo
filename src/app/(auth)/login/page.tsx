import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { getCurrentActor } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  let signedIn = false;
  try {
    signedIn = !!(await getCurrentActor());
  } catch {
    signedIn = false;
  }
  if (signedIn) redirect("/dashboard");
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-surface px-5 py-12">
      {/* soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.16),transparent)] dark:bg-[radial-gradient(closest-side,rgba(59,130,246,0.22),transparent)]"
      />

      <div className="relative w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="pressable mb-5 grid size-[72px] place-items-center rounded-[22px] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)]">
            <ClipboardCheck className="size-9" strokeWidth={2} />
          </Link>
          <h1 className="text-[28px] font-bold tracking-tight">تسجيل الدخول</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">Attendo nosait — للإدارة والدكاترة والطاقم</p>
        </div>

        <div className="rounded-[22px] bg-card p-6 shadow-pop ring-[0.5px] ring-border">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          طالب؟{" "}
          <Link href="/inquiry" className="font-medium text-primary hover:opacity-70">
            استعلم عن حضورك من هنا
          </Link>
        </p>
      </div>
    </div>
  );
}
