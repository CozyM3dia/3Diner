"use client";

import MenuCard from "./MenuCard";
import type { Menu } from "@/types";

interface MenuGridProps {
  menus: Menu[];
  cafeId: string;
  slug: string;
}

export default function MenuGrid({ menus, cafeId, slug }: MenuGridProps) {
  if (menus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "#F5E6D3" }}
        >
          <span className="text-3xl">☕</span>
        </div>
        <p
          className="text-base font-medium"
          style={{ color: "#8B5E3C", fontFamily: "var(--font-playfair)" }}
        >
          Menu belum tersedia
        </p>
        <p className="text-sm mt-1" style={{ color: "#C4956A" }}>
          Silakan tanyakan kepada staff kami
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {menus.map((menu, index) => (
        <MenuCard
          key={menu.id_menu}
          menu={menu}
          cafeId={cafeId}
          slug={slug}
          index={index}
        />
      ))}
    </div>
  );
}
