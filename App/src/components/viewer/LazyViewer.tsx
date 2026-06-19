"use client";

/**
 * LazyViewer — tap-to-load placeholder for the heavy 3D viewer.
 * Page opens instantly; the 40 MB model only downloads on user tap.
 */

import { useState } from "react";
import { Box, Loader2, Play } from "lucide-react";
import dynamic from "next/dynamic";

// SplatViewer is loaded only after the user taps, keeping initial JS bundle small
const SplatViewer = dynamic(() => import("./SplatViewer"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3"
      style={{ background: "linear-gradient(145deg, #F5E6D3, #E8D5C0)" }}
    >
      <Loader2 size={28} color="#8B5E3C" className="animate-spin" />
      <p className="text-sm font-semibold" style={{ color: "#8B5E3C" }}>
        Memuat viewer...
      </p>
    </div>
  ),
});

interface LazyViewerProps {
  url: string;
  menuName: string;
}

export default function LazyViewer({ url, menuName }: LazyViewerProps) {
  // "idle"     → show placeholder
  // "starting" → tap registered, show spinner (immediate feedback)
  // "active"   → SplatViewer mounted
  const [phase, setPhase] = useState<"idle" | "starting" | "active">("idle");

  function handleTap() {
    if (phase !== "idle") return;
    setPhase("starting");
    // Small delay so the loading UI paints before the heavy import kicks in
    setTimeout(() => setPhase("active"), 80);
  }

  // ── Idle placeholder ────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div
        className="relative w-full h-full flex flex-col items-center justify-center gap-3 select-none"
        style={{ background: "linear-gradient(145deg, #F5E6D3, #E8D5C0)" }}
      >
        {/* Decorative blobs — pointer-events none so they never block taps */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, #D4A574 0%, transparent 55%), radial-gradient(circle at 75% 75%, #C4956A 0%, transparent 55%)",
          }}
        />

        {/* Icon */}
        <div
          className="relative z-10 w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl"
          style={{ background: "rgba(255,251,245,0.85)", backdropFilter: "blur(8px)" }}
        >
          <Box size={38} color="#8B5E3C" strokeWidth={1.5} />
        </div>

        {/* Name */}
        <p
          className="relative z-10 font-semibold text-sm text-center px-6"
          style={{ color: "#8B5E3C", fontFamily: "var(--font-playfair)" }}
        >
          {menuName}
        </p>

        {/* CTA — onClick here, not on parent div, for reliable mobile tap */}
        <button
          type="button"
          onClick={handleTap}
          className="relative z-10 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold active:scale-95 transition-transform"
          style={{
            background: "#8B5E3C",
            color: "#FDF6EC",
            boxShadow: "0 4px 16px rgba(139,94,60,0.4)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <Play size={13} fill="#FDF6EC" strokeWidth={0} />
          Lihat 3D Model
        </button>

        <p className="relative z-10 text-xs text-center px-8" style={{ color: "#A0724A" }}>
          Model interaktif — bisa diputar 360°
        </p>
      </div>
    );
  }

  // ── Starting — immediate visual feedback while dynamic import fires ────
  if (phase === "starting") {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-3"
        style={{ background: "linear-gradient(145deg, #F5E6D3, #E8D5C0)" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: "#FFFBF5" }}
        >
          <Loader2 size={26} color="#8B5E3C" strokeWidth={2} className="animate-spin" />
        </div>
        <p className="text-sm font-semibold" style={{ color: "#8B5E3C" }}>
          Memuat model 3D...
        </p>
      </div>
    );
  }

  // ── Active — render the real 3D viewer ──────────────────────────────────
  return (
    <div className="w-full h-full">
      <SplatViewer url={url} className="w-full h-full" />
    </div>
  );
}
