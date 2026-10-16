"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Maximize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/overlay";
import { Section } from "@/components/shared/page";
import { ConfirmAction } from "@/components/shared/confirm";
import { regenerateTokenAction } from "@/server/actions/teaching";

export function CheckinPanel({ lectureId, url, qr, open, title }: { lectureId: string; url: string; qr: string; open: boolean; title: string }) {
  const router = useRouter();
  return (
    <Section title="رابط التسجيل الذاتي" description={open ? "اعرض الرمز للطلاب ليمسحوه بهواتفهم." : "سيعمل الرابط عند فتح الجلسة."}>
      <div className="grid justify-items-center gap-3 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="رمز QR لرابط الحضور" className="size-48 rounded-md border p-1" />
        <div className="ltr w-full truncate rounded-md bg-surface px-2 py-1.5 text-center font-mono text-[11px] text-muted-foreground">{url}</div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(url).catch(() => null);
              toast.success("تم نسخ الرابط");
            }}
          >
            <Copy /> نسخ
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Maximize2 /> عرض كبير</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl justify-items-center">
              <DialogTitle className="text-center">{title}</DialogTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="رمز QR لرابط الحضور" className="w-full max-w-md" />
              <p className="text-center text-sm text-muted-foreground">امسح الرمز بكاميرا الهاتف لتسجيل الحضور</p>
            </DialogContent>
          </Dialog>
          <ConfirmAction
            trigger={<><RefreshCw /> رابط جديد</>}
            triggerProps={{ variant: "ghost" }}
            title="إنشاء رابط جديد؟"
            description="الرابط الحالي سيتوقف عن العمل فورًا (مفيد إذا تم تداوله خارج القاعة)."
            confirmLabel="إنشاء"
            success="تم إنشاء رابط جديد"
            onConfirm={async () => {
              const r = await regenerateTokenAction(lectureId);
              if (r.ok) router.refresh();
              return r;
            }}
          />
        </div>
      </div>
    </Section>
  );
}
