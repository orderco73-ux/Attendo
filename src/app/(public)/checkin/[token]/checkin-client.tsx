"use client";
import { useState } from "react";
import { CheckCircle2, Loader2, MapPin, QrCode, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/form";
import { QrScanner } from "@/components/shared/qr-scanner";
import type { AttendanceMethod } from "@/lib/constants";
import type { CheckinOutcome } from "@/server/services/attendance";

type Step = "idle" | "locating" | "sending";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(Object.assign(new Error("unsupported"), { code: -1 }));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

function geoMessage(err: unknown) {
  const code = (err as { code?: number }).code;
  if (code === 1) return "تم رفض إذن الموقع. فعّل الوصول للموقع لهذا الموقع من إعدادات المتصفح ثم أعد المحاولة.";
  if (code === 2) return "تعذر تحديد موقعك (GPS غير متاح). فعّل خدمة الموقع وأعد المحاولة.";
  if (code === 3) return "انتهت مهلة تحديد الموقع. انتقل لمكان مفتوح وأعد المحاولة.";
  return "المتصفح لا يدعم تحديد الموقع.";
}

export function CheckinClient({ token, method }: { token: string; method: AttendanceMethod }) {
  const needsQr = method === "qr" || method === "location_qr";
  const needsLocation = method === "location" || method === "location_qr";
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<CheckinOutcome | null>(null);

  const submit = async (qrPayload = qr) => {
    setResult(null);
    let coords: { lat: number; lng: number; accuracy: number } | undefined;
    if (needsLocation) {
      setStep("locating");
      try {
        const p = await getPosition();
        coords = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
      } catch (err) {
        setStep("idle");
        setResult({ ok: false, reason: "location", message: geoMessage(err) });
        return;
      }
    }
    setStep("sending");
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: code || undefined, qr: qrPayload || undefined, ...coords }),
      });
      const json = (await res.json()) as CheckinOutcome | { error: string };
      setResult("ok" in json ? json : { ok: false, reason: "error", message: json.error });
    } catch {
      setResult({ ok: false, reason: "network", message: "تعذر الاتصال بالخادم. تحقق من الإنترنت." });
    } finally {
      setStep("idle");
    }
  };

  if (result?.ok) {
    return (
      <div className="rounded-2xl bg-success-soft p-8 text-center" role="status">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h2 className="mt-3 text-xl font-bold text-success">{result.message}</h2>
        <p className="mt-1 text-sm text-success/80">مرحبًا {result.studentName} 👋</p>
      </div>
    );
  }

  const busy = step !== "idle";
  return (
    <div className="grid gap-4 rounded-2xl bg-card shadow-card p-5">
      {needsQr ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">امسح رمز QR الموجود على بطاقة الطالب الخاصة بك.</p>
          {qr ? (
            <div className="flex items-center justify-between rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
              <span className="flex items-center gap-2"><QrCode className="size-4" /> تم قراءة البطاقة <span className="ltr font-mono">{qr.split(".")[1]}</span></span>
              <button type="button" onClick={() => setQr(null)} aria-label="مسح"><X className="size-4" /></button>
            </div>
          ) : scanning ? (
            <QrScanner
              onResult={(text) => {
                if (!text.startsWith("ATD1.")) return;
                setQr(text);
                setScanning(false);
              }}
            />
          ) : (
            <Button type="button" variant="secondary" size="lg" onClick={() => setScanning(true)}><QrCode /> مسح بطاقة الطالب</Button>
          )}
        </div>
      ) : (
        <Field label="كود الطالب" htmlFor="code">
          <Input id="code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ST00005" autoComplete="off" className="h-11 text-left font-mono text-lg uppercase" maxLength={20} />
        </Field>
      )}
      {needsLocation && (
        <p className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" /> سيُطلب إذن الوصول إلى موقعك للتحقق من وجودك في مكان المحاضرة. لا يتم حفظ موقعك، فقط المسافة.
        </p>
      )}
      <Button size="lg" disabled={busy || (needsQr ? !qr : code.trim().length < 3)} onClick={() => submit()}>
        {busy && <Loader2 className="animate-spin" />}
        {step === "locating" ? "جارٍ تحديد الموقع…" : step === "sending" ? "جارٍ التسجيل…" : "تسجيل الحضور"}
      </Button>
      {result && !result.ok && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-destructive">
          <XCircle className="mt-0.5 size-4 shrink-0" /> {result.message}
        </div>
      )}
    </div>
  );
}
