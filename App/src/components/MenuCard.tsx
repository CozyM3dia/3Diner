"use client";

import Link from "next/link";
import Image from "next/image";
import { Box, Flame } from "lucide-react";
import { logEvent } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import { effectivePrice, hasDiscount } from "@/lib/menu-availability";
import type { Menu } from "@/types";

interface MenuCardProps {
  menu: Menu;
  cafeId: string;
  slug: string;
  index: number;
}

function staggerClass(index: number): string {
  const n = Math.min(index + 1, 6);
  return `fade-up stagger-${n}`;
}

export default function MenuCard({ menu, cafeId, slug, index }: MenuCardProps) {
  const has3d = Boolean(menu.model_3d_url);
  const discounted = hasDiscount(menu);
  const price = effectivePrice(menu);

  function handleClick() {
    logEvent({ cafe_id: cafeId, menu_id: menu.id_menu, event_type: "click_menu", duration: 0 });
  }

  return (
    <Link
      href={`/${slug}/${menu.id_menu}`}
      onClick={handleClick}
      className={`menu-card card block w-full overflow-hidden ${staggerClass(index)}`}
      aria-label={`Lihat detail ${menu.nama_menu}`}
    >
      {/* Photo */}
      <div className="relative w-full aspect-[5/4] overflow-hidden">
        {menu.image_url ? (
          <Image
            src={menu.image_url}
            alt={menu.nama_menu}
            fill
            sizes="(max-width:768px) 50vw, 300px"
            className="card-img object-cover"
          />
        ) : (
          <div className="card-img absolute inset-0 dish-mesh flex items-center justify-center">
            <Box size={32} color="rgba(253,253,253,0.5)" strokeWidth={1.4} className="float" />
          </div>
        )}

        {has3d && (
          <span className="badge-3d absolute bottom-2 left-2 inline-flex items-center gap-1">
            <Box size={10} strokeWidth={2.5} /> Lihat 3D
          </span>
        )}

        {discounted && (
          <span
            className="absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white"
            style={{ background: "var(--orange)" }}
          >
            -{menu.discount_pct}%
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <h3
          className="font-display text-sm font-semibold leading-snug line-clamp-1"
          style={{ color: "var(--navy)" }}
        >
          {menu.nama_menu}
        </h3>
        {menu.description_menu && (
          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--navy-muted)" }}>
            {menu.description_menu}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 mt-1.5">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <p className="text-sm font-bold" style={{ color: "var(--orange-ink)" }}>
              {formatRupiah(price)}
            </p>
            {discounted && (
              <p className="text-[11px] line-through" style={{ color: "var(--navy-muted)" }}>
                {formatRupiah(menu.harga_menu)}
              </p>
            )}
          </div>
          {menu.calories && (
            <span className="inline-flex items-center gap-0.5 text-[10px] shrink-0" style={{ color: "var(--navy-muted)" }}>
              <Flame size={10} style={{ color: "var(--orange)" }} />
              {menu.calories}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
