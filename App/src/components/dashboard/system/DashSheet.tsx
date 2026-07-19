"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getDashPortal } from "./portal";

interface DashSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Judul accessible (sr-only) — wajib untuk Radix Dialog semantics. */
  title: string;
  side?: "left" | "right";
  children: React.ReactNode;
}

/** Sheet dashboard: primitive shadcn utuh (animasi CSS bawaan = pemilik
 *  tunggal motion), hanya diarahkan ke dashboard portal root supaya token
 *  .dash-portal-root ikut terbawa. Fallback ke body portal bila node belum
 *  ter-mount (SSR/first paint). */
export default function DashSheet({ open, onOpenChange, title, side = "left", children }: DashSheetProps) {
  // Portal node baru dibutuhkan saat sheet terbuka; saat itu shell sudah
  // ter-mount sehingga node pasti ada. SSR/closed -> undefined (default body).
  const container = open ? getDashPortal() ?? undefined : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        container={container}
        showCloseButton={false}
        className="w-[280px] max-w-[85vw] p-0 gap-0 border-r"
        style={{ background: "var(--dash-sidebar)", borderColor: "var(--dash-border)" }}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
