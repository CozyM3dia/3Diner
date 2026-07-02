"use client";

import Link from "next/link";
import Image from "next/image";
import { Box, Clock, Flame } from "lucide-react";
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
  const isActive = menu.is_active !== false;

  function handleClick() {
    logEvent({ cafe_id: cafeId, menu_id: menu.id_menu, event_type: "click_menu", duration: 0 });
  }

  const photoSection = (
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

      {!isActive && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(2,44,96,0.52)" }}
        >
          <span
            style={{
              padding: "5px 11px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.11)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            Stok Habis
          </span>
        </div>
      )}

      {has3d && isActive && (
        <span
          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
          style={{
            background: "rgba(2,44,96,0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.22)",
            color: "#fff",
          }}
        >
          <Box size={10} strokeWidth={2.5} /> 3D
        </span>
      )}

      {/* Swiggy-style offer strip — bold white on dark gradient */}
      {discounted && isActive && (
        <div
          className="absolute inset-x-0 bottom-0 px-3 pt-7 pb-1.5 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(2,20,50,0.85), transparent)" }}
        >
          <p className="text-white font-display font-extrabold text-base leading-none tracking-tight">
            {menu.discount_pct}% OFF
          </p>
        </div>
      )}
    </div>
  );

  const bodySection = (
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
      <div className="flex items-baseline gap-1.5 mt-1.5 min-w-0">
        <p className="text-sm font-bold" style={{ color: isActive ? "var(--orange-ink)" : "var(--navy-muted)" }}>
          {formatRupiah(price)}
        </p>
        {discounted && isActive && (
          <p className="text-[11px] line-through" style={{ color: "var(--navy-muted)" }}>
            {formatRupiah(menu.harga_menu)}
          </p>
        )}
      </div>

      {/* Meta row — Swiggy-style time + calories */}
      {isActive && (menu.prep_time_minutes || menu.calories) && (
        <div className="flex items-center gap-2.5 mt-1.5">
          {menu.prep_time_minutes && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--navy-muted)" }}>
              <Clock size={10} strokeWidth={2.2} />
              {menu.prep_time_minutes} mnt
            </span>
          )}
          {menu.calories && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--navy-muted)" }}>
              <Flame size={10} style={{ color: "var(--orange)" }} />
              {menu.calories} kal
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (!isActive) {
    return (
      <div
        className={`menu-card card block w-full overflow-hidden ${staggerClass(index)}`}
        style={{ opacity: 0.65, filter: "grayscale(0.3)", cursor: "default" }}
      >
        {photoSection}
        {bodySection}
      </div>
    );
  }

  return (
    <Link
      href={`/${slug}/${menu.id_menu}`}
      onClick={handleClick}
      className={`menu-card card block w-full overflow-hidden ${staggerClass(index)}`}
      aria-label={`Lihat detail ${menu.nama_menu}`}
    >
      {photoSection}
      {bodySection}
    </Link>
  );
}
