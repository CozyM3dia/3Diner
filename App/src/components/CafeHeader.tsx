"use client";

import { MapPin, Coffee } from "lucide-react";
import type { Cafe } from "@/types";

interface CafeHeaderProps {
  cafe: Cafe;
  menuCount: number;
}

export default function CafeHeader({ cafe, menuCount }: CafeHeaderProps) {
  return (
    <header className="relative overflow-hidden">
      {/* Warm gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, #8B5E3C 0%, #C4956A 50%, #D4A574 100%)",
        }}
      />

      {/* Decorative circles */}
      <div
        className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20"
        style={{ background: "#FDF6EC" }}
      />
      <div
        className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-15"
        style={{ background: "#2C1810" }}
      />

      {/* Content */}
      <div className="relative z-10 px-5 pt-12 pb-8">
        {/* Logo / Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
          style={{ background: "rgba(253,246,236,0.2)", backdropFilter: "blur(8px)" }}
        >
          <Coffee size={28} color="#FDF6EC" strokeWidth={1.5} />
        </div>

        {/* Cafe name */}
        <h1
          className="text-3xl font-bold leading-tight mb-1"
          style={{
            fontFamily: "var(--font-playfair)",
            color: "#FDF6EC",
          }}
        >
          {cafe.nama_cafe}
        </h1>

        {/* Address */}
        <div className="flex items-start gap-1.5 mt-2">
          <MapPin
            size={14}
            color="rgba(253,246,236,0.7)"
            className="mt-0.5 shrink-0"
          />
          <p
            className="text-sm leading-snug"
            style={{ color: "rgba(253,246,236,0.75)" }}
          >
            {cafe.alamat_cafe}
          </p>
        </div>

        {/* Menu count pill */}
        <div
          className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: "rgba(253,246,236,0.18)",
            color: "#FDF6EC",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(253,246,236,0.25)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#D4A574" }}
          />
          {menuCount} Menu Tersedia
        </div>
      </div>

      {/* Bottom wave */}
      <div className="relative h-6 overflow-hidden" style={{ marginTop: -1 }}>
        <svg
          viewBox="0 0 390 24"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          <path
            d="M0,0 C130,24 260,24 390,0 L390,24 L0,24 Z"
            fill="#FDF6EC"
          />
        </svg>
      </div>
    </header>
  );
}
