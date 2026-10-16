import Link from "next/link";
import { ChevronLeft, ClipboardCheck, MapPin, QrCode, Search, ShieldCheck, Users } from "lucide-react";

const FEATURES = [
  { icon: MapPin, title: "الحضور بالموقع", text: "تحقق من وجود الطالب داخل نطاق القاعة." },
  { icon: QrCode, title: "بطاقات QR", text: "مسح سريع بكاميرا الهاتف." },
  { icon: ShieldCheck, title: "صلاحيات دقيقة", text: "كل مستخدم يرى نطاقه فقط." },
];

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[620px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.15),transparent)] dark:bg-[radial-gradient(closest-side,rgba(59,130,246,0.22),transparent)]"
      />
      <header className="glass sticky top-0 z-10 border-b-[0.5px]">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-white">
              <ClipboardCheck className="size-[18px]" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight">Attendo nosait</span>
          </div>
          <Link href="/login" className="pressable rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-white">
            دخول الطاقم
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pt-16 pb-20 text-center sm:pt-24">
        <span className="rounded-full bg-brand-soft px-3.5 py-1 text-[13px] font-medium text-accent-foreground">نظام إدارة الحضور الجامعي</span>
        <h1 className="mt-5 max-w-3xl text-[40px] leading-[1.15] font-bold tracking-tight sm:text-[56px]">
          حضور المحاضرات.
          <br />
          <span className="bg-gradient-to-l from-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent">بدقة، وبدون أوراق.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
          جدولة المحاضرات، فتح وإغلاق الجلسات، التسجيل بالموقع أو QR، وتقارير غياب دقيقة — في تطبيق واحد.
        </p>

        <div className="mt-12 grid w-full max-w-3xl gap-4 text-start sm:grid-cols-2">
          <Link href="/inquiry" className="pressable group flex items-center gap-4 rounded-[22px] bg-card p-5 shadow-card ring-[0.5px] ring-border transition-shadow hover:shadow-pop">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#34c759] to-[#248a3d] text-white">
              <Search className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">استعلام الطالب</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">اعرف حضورك وغيابك في كل مادة بكود الطالب.</span>
            </span>
            <ChevronLeft className="size-5 text-muted-foreground/60 transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <Link href="/login" className="pressable group flex items-center gap-4 rounded-[22px] bg-card p-5 shadow-card ring-[0.5px] ring-border transition-shadow hover:shadow-pop">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-white">
              <Users className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">الإدارة والدكاترة</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">المواد والطلاب والجلسات والتقارير.</span>
            </span>
            <ChevronLeft className="size-5 text-muted-foreground/60 transition-transform group-hover:-translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-2">
              <span className="grid size-11 place-items-center rounded-full bg-fill text-primary">
                <f.icon className="size-5" />
              </span>
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.text}</div>
            </div>
          ))}
        </div>
      </main>
      <footer className="relative py-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Attendo nosait</footer>
    </div>
  );
}
