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
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <ClipboardCheck className="size-5" />
            </span>
            <span className="text-lg font-bold">Attendo nosait</span>
          </Link>
          <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-muted-foreground">للمديرين والدكاترة وأعضاء الطاقم فقط.</p>
          <LoginForm />
          <p className="mt-8 text-sm text-muted-foreground">
            طالب؟{" "}
            <Link href="/inquiry" className="font-medium text-primary hover:underline">
              استعلم عن حضورك من هنا
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden flex-col justify-end bg-primary p-12 text-primary-foreground lg:flex">
        <div className="max-w-md">
          <p className="text-2xl leading-relaxed font-semibold">نظام موحد لمتابعة حضور الطلاب في كل المحاضرات.</p>
          <ul className="mt-6 space-y-2 text-sm text-blue-100">
            <li>• جلسات حضور يدوية أو مجدولة تلقائيًا</li>
            <li>• التسجيل بالموقع الجغرافي أو رمز QR أو بواسطة الطاقم</li>
            <li>• تقارير غياب دقيقة وتصدير Excel</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
