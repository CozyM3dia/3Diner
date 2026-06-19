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
          style={{ background: "#E0E7EE" }}
        >
          <span className="text-3xl">🍽️</span>
        </div>
        <p className="text-base font-semibold" style={{ color: "#022C60" }}>
          Menu belum tersedia
        </p>
        <p className="text-sm mt-1" style={{ color: "#51698F" }}>
          Silakan tanyakan kepada staff kami
        </p>
      </div>
    );
  }

  // Group menus by category (preserve insertion order)
  const groups = menus.reduce<Record<string, Menu[]>>((acc, m) => {
    const cat = m.category ?? "Lainnya";
    (acc[cat] ??= []).push(m);
    return acc;
  }, {});

  let idx = 0;

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([category, items]) => (
        <section key={category}>
          <h2
            className="text-sm font-semibold uppercase mb-3"
            style={{ color: "#FD5002", letterSpacing: "0.08em" }}
          >
            {category}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {items.map((menu) => (
              <MenuCard
                key={menu.id_menu}
                menu={menu}
                cafeId={cafeId}
                slug={slug}
                index={idx++}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
