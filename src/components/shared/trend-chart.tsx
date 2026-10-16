"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Single-series daily attendance rate (closed sessions only). One hue, thin bars, hover tooltip. */
export function TrendChart({ data }: { data: { day: string; rate: number; present: number }[] }) {
  return (
    <div className="h-56 w-full" dir="ltr" role="img" aria-label="نسبة الحضور اليومية لآخر 14 يومًا">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            cursor={{ fill: "var(--fill)" }}
            contentStyle={{ borderRadius: 14, border: "0.5px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)", boxShadow: "var(--shadow-pop)", fontFamily: "var(--font-arabic)", direction: "rtl", fontSize: 12 }}
            formatter={(v, _n, item) => [`${v}% (${(item?.payload as { present: number })?.present ?? 0} حضور)`, "نسبة الحضور"]}
            labelFormatter={(l) => `يوم ${l}`}
          />
          <Bar dataKey="rate" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
