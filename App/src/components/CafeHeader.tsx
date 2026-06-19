import Image from "next/image";
import { MapPin } from "lucide-react";
import type { Cafe } from "@/types";

interface CafeHeaderProps {
  cafe: Cafe;
  menuCount: number;
}

export default function CafeHeader({ cafe, menuCount }: CafeHeaderProps) {
  const greeting = cafe.greeting ?? "Selamat datang";

  return (
    <header className="relative overflow-hidden">
      {/* Cover background */}
      <div className="absolute inset-0">
        {cafe.cover_url && (
          <Image
            src={cafe.cover_url}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: cafe.cover_url
              ? "linear-gradient(160deg, rgba(2,44,96,0.82) 0%, rgba(0,35,85,0.94) 100%)"
              : "linear-gradient(160deg, #022C60 0%, #002355 100%)",
          }}
        />
      </div>

      {/* Orange accent blob */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-25"
        style={{ background: "#FD5002" }}
      />

      {/* Content */}
      <div className="relative z-10 px-5 pt-12 pb-8">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center mb-4 shadow-lg bg-white/10 backdrop-blur">
          <Image
            src={cafe.logo_url ?? "/brand/logo-3diner-mark.svg"}
            alt={cafe.nama_cafe}
            width={64}
            height={64}
            className="object-contain p-1.5"
          />
        </div>

        <p className="text-sm mb-1" style={{ color: "rgba(253,253,253,0.75)" }}>
          {greeting}
        </p>
        <h1 className="text-3xl font-bold leading-tight text-white">
          {cafe.nama_cafe}
        </h1>

        <div className="flex items-start gap-1.5 mt-2">
          <MapPin size={14} color="rgba(253,253,253,0.7)" className="mt-0.5 shrink-0" />
          <p className="text-sm leading-snug" style={{ color: "rgba(253,253,253,0.75)" }}>
            {cafe.alamat_cafe}
          </p>
        </div>

        <div
          className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
          style={{ background: "#FD5002" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          {menuCount} Menu · Lihat dalam 3D
        </div>
      </div>
    </header>
  );
}
