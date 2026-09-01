import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { DatadogAppRouter } from "@datadog/browser-rum-nextjs";
import { ClerkProvider } from "@clerk/nextjs";
import ThemeSync from "@/components/dp/ThemeSync";
import "./globals.css";

// Poppins — 3Diner consumer brand face (customer-facing menu).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
  maximumScale: 1,
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
    <html lang="id" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-dvh">
        {clerkConfigured ? (
          <ClerkProvider>
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
