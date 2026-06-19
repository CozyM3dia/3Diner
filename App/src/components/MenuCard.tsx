"use client";

import Link from "next/link";
import { Box } from "lucide-react";
import { logEvent } from "@/lib/supabase";
import type { Menu } from "@/types";

interface MenuCardProps {
  menu: Menu;
  cafeId: string;
  slug: string;
  index: number;
}

/** Format Rupiah */
function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Stagger class by index (caps at 6) */
function staggerClass(index: number): string {
  const n = Math.min(index + 1, 6);
  return `fade-up stagger-${n}`;
}

export default function MenuCard({ menu, cafeId, slug, index }: MenuCardProps) {
  function handleClick() {
    // Fire analytics — non-blocking, doesn't prevent navigation
    logEvent({
      cafe_id: cafeId,
      menu_id: menu.id_menu,
      event_type: "click_menu",
      duration: 0,
    });
  }

  return (
    // Use <Link> (renders as <a>) for reliable native navigation on all
    // browsers / mobile devices — avoids JS-only router.push() issues.
    <Link
      href={`/${slug}/${menu.id_menu}`}
      onClick={handleClick}
      className={`menu-card block w-full text-left rounded-2xl overflow-hidden shadow-sm ${staggerClass(index)}`}
      style={{ background: "#FFFBF5", border: "1px solid #E8D5C0" }}
      aria-label={`Lihat detail ${menu.nama_menu}`}
    >
      {/* Image / 3D Preview placeholder */}
      <div
        className="relative w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #F5E6D3 0%, #E8D5C0 50%, #F5E6D3 100%)",
        }}
      >
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, #D4A574 0%, transparent 50%), radial-gradient(circle at 70% 70%, #C4956A 0%, transparent 50%)",
          }}
        />

        {/* 3D icon */}
        <div
          className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
          style={{ background: "rgba(255,251,245,0.7)", backdropFilter: "blur(8px)" }}
        >
          <Box size={26} color="#8B5E3C" strokeWidth={1.5} />
        </div>

        {/* 3D badge */}
        <span
          className="relative z-10 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(44,24,16,0.65)",
            color: "#FDF6EC",
            backdropFilter: "blur(4px)",
            letterSpacing: "0.05em",
          }}
        >
          TAP · LIHAT 3D
        </span>
      </div>

      {/* Card body */}
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-base leading-snug truncate"
              style={{ color: "#2C1810", fontFamily: "var(--font-jakarta)" }}
            >
              {menu.nama_menu}
            </h3>

            {menu.description_menu && (
              <p
                className="text-xs mt-0.5 line-clamp-2 leading-relaxed"
                style={{ color: "#8B5E3C" }}
              >
                {menu.description_menu}
              </p>
            )}
          </div>

          {/* Arrow — decorative, replaced by full card being a link */}
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
            style={{ background: "#F5E6D3" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8B5E3C"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between mt-3">
          <span
            className="text-base font-bold"
            style={{
              color: "#8B5E3C",
              fontFamily: "var(--font-playfair)",
            }}
          >
            {formatRupiah(menu.harga_menu)}
          </span>

          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: "#F5E6D3",
              color: "#C4956A",
              border: "1px solid #E8D5C0",
            }}
          >
            3D · AR
          </span>
        </div>
      </div>
    </Link>
  );
}
