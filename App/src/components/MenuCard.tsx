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

function staggerClass(index: number): string {
  const n = Math.min(index + 1, 6);
  return `fade-up stagger-${n}`;
}

export default function MenuCard({ menu, cafeId, slug, index }: MenuCardProps) {
  const has3d = Boolean(menu.model_3d_url);

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
        <p className="text-sm font-bold mt-1.5" style={{ color: "var(--orange-ink)" }}>
          {formatRupiah(menu.harga_menu)}
        </p>
      </div>
    </Link>
  );
}
