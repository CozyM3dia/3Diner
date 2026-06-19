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
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "#E0E7EE" }}>
          <span className="text-3xl">🍽️</span>
        </div>
        <p className="font-display text-lg font-semibold" style={{ color: "#022C60" }}>
          Menu belum tersedia
        </p>
        <p className="text-sm mt-1" style={{ color: "#51698F" }}>
          Silakan tanyakan kepada staff kami
        </p>
      </div>
    );
  }

  const groups = menus.reduce<Record<string, Menu[]>>((acc, m) => {
    const cat = m.category ?? "Lainnya";
    (acc[cat] ??= []).push(m);
    return acc;
  }, {});

  let idx = 0;

  return (
    <div className="space-y-9">
      {Object.entries(groups).map(([category, items]) => (
        <section key={category}>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-display text-lg font-semibold shrink-0" style={{ color: "#022C60" }}>
              {category}
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: "#FDD8C3", color: "#FD5002" }}>
              {items.length}
            </span>
            <div className="flex-1 h-px" style={{ background: "#CFD9E4" }} />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            {items.map((menu) => (
              <MenuCard key={menu.id_menu} menu={menu} cafeId={cafeId} slug={slug} index={idx++} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
