"use client";

import { useState, useMemo } from "react";
import { Search, SearchX } from "lucide-react";
import MenuCard from "./MenuCard";
import type { Menu } from "@/types";

interface MenuBrowserProps {
  menus: Menu[];
  cafeId: string;
  slug: string;
}

const ALL = "Semua";

export default function MenuBrowser({ menus, cafeId, slug }: MenuBrowserProps) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(ALL);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of menus) if (m.category) set.add(m.category);
    return [ALL, ...Array.from(set)];
  }, [menus]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return menus.filter((m) => {
      const matchCat = cat === ALL || m.category === cat;
      const matchText =
        !t ||
        m.nama_menu.toLowerCase().includes(t) ||
        (m.description_menu ?? "").toLowerCase().includes(t);
      return matchCat && matchText;
    });
  }, [menus, q, cat]);

  return (
    <>
      {/* Sticky toolbar: search + category chips */}
      <div
        className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2.5"
        style={{
          background: "rgba(246,248,251,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--navy-muted)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari hidangan..."
            aria-label="Cari hidangan"
            className="w-full h-12 pl-11 pr-4 rounded-full text-sm transition-shadow"
            style={{ background: "var(--surface)", color: "var(--navy)" }}
          />
        </div>

        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-fade-r -mx-4 px-4 mt-2.5">
            {categories.map((c) => {
              const active = c === cat;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  aria-pressed={active}
                  className="press shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors"
                  style={
                    active
                      ? { background: "var(--navy)", color: "#fff" }
                      : { background: "var(--surface)", color: "var(--navy-muted)" }
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-4" />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SearchX size={36} style={{ color: "var(--navy-muted)" }} strokeWidth={1.5} />
          <p className="font-display text-lg font-bold mt-3" style={{ color: "var(--navy)" }}>
            Tidak ada hasil
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--navy-muted)" }}>
            {q ? `untuk "${q}"` : "Coba kategori lain"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {filtered.map((m, i) => (
            <MenuCard key={m.id_menu} menu={m} cafeId={cafeId} slug={slug} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
