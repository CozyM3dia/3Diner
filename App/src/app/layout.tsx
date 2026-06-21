import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Single-font system — Poppins is the 3Diner brand face (matches Stitch design).
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FDFDFD",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={poppins.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
