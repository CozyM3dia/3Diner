"use client";

import Link from "next/link";
import Image from "next/image";
import { Box, Eye } from "lucide-react";
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
      {/* Photo / branded placeholder */}
      <div className="relative w-full aspect-[4/5] overflow-hidden">
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
            <Box size={34} color="rgba(253,253,253,0.5)" strokeWidth={1.4} className="float" />
          </div>
        )}

        {/* Scrim */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,35,85,0.78) 0%, transparent 100%)" }}
        />

        {/* 3D badge */}
        <span
          className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full text-white"
          style={{ background: "#FD5002", boxShadow: "0 4px 12px rgba(253,80,2,0.4)" }}
        >
          <Box size={10} strokeWidth={2.5} /> 3D
        </span>

        {/* Name + price over scrim */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <h3 className="font-display text-base font-semibold leading-tight text-white line-clamp-2">
            {menu.nama_menu}
          </h3>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-sm font-bold" style={{ color: "#FF8A4C" }}>
              {formatRupiah(menu.harga_menu)}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "rgba(253,253,253,0.16)", color: "#FDFDFD" }}
            >
              <Eye size={10} /> Lihat
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
