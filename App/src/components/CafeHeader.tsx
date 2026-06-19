import Image from "next/image";
import { MapPin, Sparkles } from "lucide-react";
import type { Cafe } from "@/types";

interface CafeHeaderProps {
  cafe: Cafe;
  menuCount: number;
}

export default function CafeHeader({ cafe, menuCount }: CafeHeaderProps) {
  const greeting = cafe.greeting ?? "Selamat datang";

  return (
    <header className="relative overflow-hidden grain rounded-b-[32px]">
      {/* Cover background */}
      <div className="absolute inset-0">
        {cafe.cover_url && (
          <Image src={cafe.cover_url} alt="" fill priority className="object-cover" sizes="100vw" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: cafe.cover_url
              ? "linear-gradient(165deg, rgba(2,44,96,0.80) 0%, rgba(0,35,85,0.96) 100%)"
              : "linear-gradient(165deg, #022C60 0%, #002355 100%)",
          }}
        />
      </div>

      {/* Decorative orange arc + glow */}
      <div
        className="absolute -top-24 -right-20 w-64 h-64 rounded-full blur-2xl"
        style={{ background: "rgba(253,80,2,0.45)" }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-52 h-52 rounded-full"
        style={{ border: "1.5px solid rgba(253,253,253,0.10)" }}
      />

      {/* Content */}
      <div className="relative z-10 px-6 pt-14 pb-12">
        {/* Logo + powered tag */}
        <div className="flex items-center justify-between mb-7">
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center float"
            style={{ background: "rgba(253,253,253,0.10)", border: "1px solid rgba(253,253,253,0.18)", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}
          >
            <Image
              src={cafe.logo_url ?? "/brand/logo-3diner-mark.svg"}
              alt={cafe.nama_cafe}
              width={64}
              height={64}
              className="object-contain p-2"
            />
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-wide"
            style={{ background: "rgba(253,253,253,0.10)", color: "rgba(253,253,253,0.8)", border: "1px solid rgba(253,253,253,0.14)" }}
          >
            <Sparkles size={11} color="#FD5002" />
            MENU 3D · AR
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(253,253,253,0.55)" }}>
          {greeting}
        </p>
        <h1
          className="font-display text-[2.6rem] leading-[1.02] font-semibold text-white"
          style={{ letterSpacing: "-0.01em" }}
        >
          {cafe.nama_cafe}
        </h1>

        <div className="flex items-center gap-1.5 mt-3">
          <MapPin size={13} color="rgba(253,253,253,0.6)" className="shrink-0" />
          <p className="text-xs" style={{ color: "rgba(253,253,253,0.7)" }}>
            {cafe.alamat_cafe}
          </p>
        </div>

        {/* Count chips */}
        <div className="flex items-center gap-2 mt-6">
          <span
            className="inline-flex items-baseline gap-1.5 px-3.5 py-2 rounded-full"
            style={{ background: "#FD5002", boxShadow: "0 8px 22px rgba(253,80,2,0.4)" }}
          >
            <span className="font-display text-lg font-bold leading-none text-white">{menuCount}</span>
            <span className="text-[11px] font-medium text-white/90">menu siap dijelajahi</span>
          </span>
        </div>
      </div>
    </header>
  );
}
