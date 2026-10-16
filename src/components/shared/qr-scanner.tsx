"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, Loader2 } from "lucide-react";

/**
 * Camera QR scanner (getUserMedia + jsQR). Calls onResult once per distinct code;
 * the same code is ignored for `cooldownMs` to avoid duplicate submissions.
 */
export function QrScanner({ onResult, cooldownMs = 2500, active = true }: { onResult: (text: string) => void; cooldownMs?: number; active?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const cb = useRef(onResult);
  const [state, setState] = useState<"starting" | "running" | "error">("starting");
  const [error, setError] = useState("");

  useEffect(() => {
    cb.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        const w = Math.min(640, v.videoWidth);
        const h = Math.round((v.videoHeight / v.videoWidth) * w);
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          const now = Date.now();
          if (code?.data && (code.data !== last.current.text || now - last.current.at > cooldownMs)) {
            last.current = { text: code.data, at: now };
            cb.current(code.data);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        setState("running");
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setState("error");
        const name = (e as { name?: string }).name;
        setError(name === "NotAllowedError" ? "تم رفض إذن الكاميرا. فعّله من إعدادات المتصفح." : name === "NotFoundError" ? "لا توجد كاميرا متاحة." : "تعذر تشغيل الكاميرا (تتطلب HTTPS).");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, cooldownMs]);

  return (
    <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-slate-900">
      <video ref={video} className="size-full object-cover" playsInline muted />
      <canvas ref={canvas} className="hidden" />
      {state === "running" && <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />}
      {state === "starting" && (
        <div className="absolute inset-0 grid place-items-center text-white">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white">
          <CameraOff className="size-7" />
          {error}
        </div>
      )}
    </div>
  );
}
