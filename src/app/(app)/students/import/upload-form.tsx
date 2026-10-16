"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/shared/form";
import { cn } from "@/lib/utils";

const MAX = 2 * 1024 * 1024;

export function UploadForm({ colleges }: { colleges: { id: string; name: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [college, setCollege] = useState(colleges[0]?.id ?? "");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) return setError("الملف يجب أن يكون بصيغة .xlsx");
    if (f.size > MAX) return setError("حجم الملف يتجاوز 2 ميجابايت");
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("college", college);
      const res = await fetch("/api/imports", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { jobId?: string; error?: string };
      if (!res.ok || !json.jobId) throw new Error(json.error || "تعذر رفع الملف");
      toast.success("تم تحليل الملف، راجع المعاينة");
      router.push(`/students/import/${json.jobId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      {colleges.length > 1 && (
        <Field label="الكلية">
          <NativeSelect value={college} onChange={(e) => setCollege(e.target.value)}>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={cn("flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-fill-strong px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-brand-soft/40", drag && "border-primary bg-brand-soft")}
      >
        {file ? <FileSpreadsheet className="size-8 text-success" /> : <UploadCloud className="size-8 text-primary" />}
        <span className="font-medium">{file ? file.name : "اسحب ملف Excel هنا أو اضغط للاختيار"}</span>
        <span className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)} كيلوبايت` : ".xlsx — حتى 2 ميجابايت"}</span>
      </button>
      <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-destructive">{error}</p>}
      <div>
        <Button onClick={upload} disabled={!file || !college} loading={busy}>تحليل الملف ومعاينته</Button>
      </div>
    </div>
  );
}
