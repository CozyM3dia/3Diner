"use client";

import Link from "next/link";
import Image from "next/image";
import { Box } from "lucide-react";
import { logEvent } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import type { Menu } from "@/types";

interface MenuCardProps {
  menu: Menu;
  cafeId: string;
  slug: string;
  index: number;
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
    <Link
      href={`/${slug}/${menu.id_menu}`}
      onClick={handleClick}
      className={`menu-card block w-full text-left rounded-2xl overflow-hidden shadow-sm ${staggerClass(index)}`}
      style={{ background: "#FFFFFF", border: "1px solid #CFD9E4" }}
      aria-label={`Lihat detail ${menu.nama_menu}`}
    >
      {/* Photo / fallback */}
      <div
        className="relative w-full aspect-[4/3] overflow-hidden"
        style={{ background: "#022C60" }}
      >
        {menu.image_url ? (
          <Image
            src={menu.image_url}
            alt={menu.nama_menu}
            fill
            sizes="(max-width:768px) 50vw, 300px"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #022C60 0%, #002355 100%)" }}
          >
            <Box size={30} color="rgba(253,253,253,0.45)" strokeWidth={1.5} />
          </div>
        )}

        <span
          className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
          style={{ background: "#FD5002", letterSpacing: "0.04em" }}
        >
          3D · AR
        </span>
      </div>

      {/* Body */}
      <div className="px-3.5 py-3">
        <h3
          className="font-semibold text-sm leading-snug truncate"
          style={{ color: "#022C60" }}
        >
          {menu.nama_menu}
        </h3>

        {menu.description_menu && (
          <p
            className="text-xs mt-0.5 line-clamp-2 leading-relaxed"
            style={{ color: "#51698F" }}
          >
            {menu.description_menu}
          </p>
        )}

        <div className="flex items-center justify-between mt-2.5">
          <span className="text-sm font-bold" style={{ color: "#FD5002" }}>
            {formatRupiah(menu.harga_menu)}
          </span>
          <span
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "#E0E7EE" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#022C60"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
