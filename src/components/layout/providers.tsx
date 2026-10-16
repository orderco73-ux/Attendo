"use client";
import { Direction, Tooltip } from "radix-ui";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Direction.DirectionProvider dir="rtl">
      <Tooltip.Provider delayDuration={200}>
        {children}
        <Toaster
          dir="rtl"
          position="top-center"
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: "var(--font-arabic)" } }}
        />
      </Tooltip.Provider>
    </Direction.DirectionProvider>
  );
}
