"use client";
import { Direction, Tooltip } from "radix-ui";
import { Toaster } from "sonner";
import { ThemeProvider } from "./theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Direction.DirectionProvider dir="rtl">
        <Tooltip.Provider delayDuration={200}>
          {children}
          <Toaster
            dir="rtl"
            position="top-center"
            closeButton
            toastOptions={{
              style: {
                fontFamily: "var(--font-arabic)",
                borderRadius: "16px",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "0.5px solid var(--border)",
                boxShadow: "var(--shadow-pop)",
              },
              classNames: { success: "[&_[data-icon]]:text-success", error: "[&_[data-icon]]:text-destructive" },
            }}
          />
        </Tooltip.Provider>
      </Direction.DirectionProvider>
    </ThemeProvider>
  );
}
