import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: "variable",
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Attendo nosait — إدارة الحضور الجامعي", template: "%s | Attendo nosait" },
  description: "منصة إدارة حضور المحاضرات الجامعية",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Attendo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/** Applies the saved theme (or the system one) before first paint to avoid a light/dark flash. */
const themeScript = `(function(){try{var t=localStorage.getItem("attendo-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={readex.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
