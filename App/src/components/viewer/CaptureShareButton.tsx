"use client";

import { useState } from "react";
import { Camera, Check, Download, Loader2 } from "lucide-react";
import { composeShareImage, shareFileName, shareImage } from "@/lib/capture-share";
import { logEvent } from "@/lib/data";

type Phase = "idle" | "working" | "shared" | "downloaded" | "failed";

const LABEL: Record<Phase, string> = {
  idle: "Foto",
  working: "Menyiapkan",
  shared: "Terbagi",
  downloaded: "Tersimpan",
  failed: "Gagal",
};

/** Shutter di viewer 3D.
 *
 *  Sesi AR imersif dirender oleh compositor sistem, bukan oleh canvas halaman,
 *  jadi feed kamera tidak bisa dibaca dari sini — tangkapan layar bawaan
 *  perangkat satu-satunya jalan untuk itu. Yang bisa ditangkap dan dibagikan
 *  adalah frame viewer 3D, dan itulah yang dikerjakan tombol ini. */
export default function CaptureShareButton({
  capture,
  menuName,
  cafeName,
  cafeId,
  menuId,
}: {
  capture: (() => string | null) | null;
  menuName: string;
  cafeName: string;
  cafeId?: string;
  menuId?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  async function run() {
    if (!capture || phase === "working") return;
    setPhase("working");

    const frameDataUrl = capture();
    if (!frameDataUrl) {
      setPhase("failed");
      resetSoon(setPhase);
      return;
    }

    const blob = await composeShareImage({ frameDataUrl, menuName, cafeName });
    if (!blob) {
      setPhase("failed");
      resetSoon(setPhase);
      return;
    }

    const outcome = await shareImage(
      blob,
      shareFileName(menuName, cafeName),
      `${menuName} · ${cafeName}`
    );

    if (outcome !== "failed" && cafeId && menuId) {
      // Dicatat sebagai click_order supaya masuk corong analytics yang sudah ada
      // tanpa menambah tipe event baru ke skema.
      logEvent({ cafe_id: cafeId, menu_id: menuId, event_type: "click_order", duration: 0 });
    }

    setPhase(outcome === "failed" ? "failed" : outcome);
    resetSoon(setPhase);
  }

  const disabled = !capture || phase === "working";

  return (
    <button
      onClick={run}
      disabled={disabled}
      aria-label={`Ambil dan bagikan foto ${menuName}`}
      className="press inline-flex flex-col items-center justify-center gap-1 w-[68px] h-[62px] rounded-2xl disabled:opacity-45"
      style={{
        background: "rgba(0,35,85,0.55)",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "#FDFDFD",
      }}
    >
      {phase === "working" ? (
        <Loader2 size={19} className="animate-spin" />
      ) : phase === "shared" ? (
        <Check size={19} style={{ color: "var(--orange-bright)" }} />
      ) : phase === "downloaded" ? (
        <Download size={19} style={{ color: "var(--orange-bright)" }} />
      ) : (
        <Camera size={19} />
      )}
      <span className="text-[10px] font-semibold tracking-wide">{LABEL[phase]}</span>
    </button>
  );
}

function resetSoon(setPhase: (phase: Phase) => void) {
  setTimeout(() => setPhase("idle"), 2200);
}
