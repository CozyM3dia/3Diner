import type { Metadata, Viewport } from "next";
import { Poppins, Instrument_Sans, Geist } from "next/font/google";
import { DatadogAppRouter } from "@datadog/browser-rum-nextjs";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";
import ThemeSync from "@/components/dp/ThemeSync";
import "./globals.css";

// Poppins — 3Diner consumer brand face (customer-facing menu).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Instrument Sans — owner console face (dashboard-v2 only). Humanist grotesk
// with tabular figures; Poppins is geometric-wide and loses column alignment
// on money columns. Brand continuity in the console is carried by colour and
// navy ink, not by the typeface. Scoped via `.dv3-root` in console.css.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

// Geist — HANYA untuk angka di konsol (figur KPI, angka otoritatif, kolom
// tabel, sumbu grafik). Dipilih dengan mengukur, bukan selera: pada em 100px
// tinggi angkanya 73 — sama persis dengan Instrument Sans — jadi angka dan
// teks di sebelahnya duduk pada garis yang sama tanpa penyetelan. Titik
// ribuannya 23.6 lawan 27.9 pada Instrument Sans dan ~31 pada kandidat lain,
// yang penting untuk format Indonesia ("2.154.250"): separator yang gemuk
// memotong angka jadi tiga kepingan. Digitnya 10% lebih lebar, jadi figur
// besar berwibawa tanpa perlu berat tambahan.
// Huruf tetap Instrument Sans; ini font kedua untuk satu peran saja.
const geist = Geist({
  variable: "--font-angka",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "3Diner — Lihat Sebelum Memesan",
  description:
    "Jelajahi menu dalam tampilan 3D & AR yang memukau. Lihat sebelum memesan.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "3Diner",
  },
  icons: {
    apple: "/brand/logo-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#022C60",
};

// Anti-FOUC: tema harus terpasang SEBELUM paint pertama. Inline di <head>
// (via beforeInteractive di body-start juga terlambat untuk style pertama).
// Kontrak: localStorage "tema-3diner" = "light" | "dark" | "system";
// default mengikuti prefers-color-scheme; hasilnya di <html data-theme>.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("tema-3diner");if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var d=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=(t==="system"?(d?"dark":"light"):t);}catch(e){document.documentElement.dataset.theme="light";}})();`;

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${poppins.variable} ${instrumentSans.variable} ${geist.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT }}
        />
        {clerkConfigured ? (
          // Telemetry posts to clerk-telemetry.com, an origin the app CSP does not
          // allow. Disabling it keeps the console clean and keeps auth traffic on
          // the Clerk instance domain only.
          <ClerkProvider telemetry={{ disabled: true }}>
            <ThemeSync />
            <DatadogAppRouter />
            {children}
          </ClerkProvider>
        ) : (
          <>
            <ThemeSync />
            <DatadogAppRouter />
            {children}
          </>
        )}
      </body>
    </html>
  );
}
