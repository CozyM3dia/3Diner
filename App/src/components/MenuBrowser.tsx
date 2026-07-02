"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, SearchX, WifiOff, Box, BadgePercent } from "lucide-react";
import MenuCard from "./MenuCard";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatRupiah } from "@/lib/format";
import { effectivePrice, hasDiscount } from "@/lib/menu-availability";
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
  const [only3d, setOnly3d] = useState(false);
  const isOnline = useOnlineStatus();

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of menus) if (m.category) set.add(m.category);
    return [ALL, ...Array.from(set)];
  }, [menus]);

  const deals = useMemo(
    () => menus.filter((m) => hasDiscount(m) && m.is_active !== false),
    [menus]
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return menus.filter((m) => {
      const matchCat = cat === ALL || m.category === cat;
      const match3d = !only3d || Boolean(m.model_3d_url);
      const matchText =
        !t ||
        m.nama_menu.toLowerCase().includes(t) ||
        (m.description_menu ?? "").toLowerCase().includes(t);
      return matchCat && match3d && matchText;
    });
  }, [menus, q, cat, only3d]);

  const isFiltering = Boolean(q.trim()) || cat !== ALL || only3d;

  return (
    <>
      {/* Sticky toolbar: search + 3D toggle + category chips */}
      <div
        className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2.5"
        style={{
          background: "rgba(246,248,251,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="search-field relative flex-1 rounded-full" style={{ background: "var(--white)" }}>
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--navy-muted)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari hidangan..."
              aria-label="Cari hidangan"
              className="w-full h-12 pl-11 pr-4 rounded-full text-sm bg-transparent outline-none"
              style={{ color: "var(--navy)" }}
            />
          </div>

          {/* 3D-only filter — Swiggy VEG-toggle style */}
          <button
            onClick={() => setOnly3d((v) => !v)}
            aria-pressed={only3d}
            aria-label="Tampilkan hanya menu 3D"
            className="press shrink-0 flex flex-col items-center justify-center gap-1 h-12 px-3 rounded-2xl"
            style={{
              background: "var(--white)",
              boxShadow: "var(--shadow-sm)",
              border: only3d ? "1.5px solid var(--orange)" : "1.5px solid transparent",
            }}
          >
            <span className="text-[9px] font-extrabold tracking-widest" style={{ color: only3d ? "var(--orange-ink)" : "var(--navy-muted)" }}>
              3D
            </span>
            <span
              className="switch-track relative w-7 h-3.5 rounded-full"
              style={{ background: only3d ? "var(--orange)" : "var(--surface)" }}
            >
              <span
                className="switch-knob absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full"
                style={{
                  background: "var(--white)",
                  boxShadow: "0 1px 3px rgba(2,44,96,0.3)",
                  transform: only3d ? "translateX(14px)" : "translateX(0)",
                }}
              />
            </span>
          </button>
        </div>

        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-fade-r -mx-4 px-4 mt-2.5">
            {categories.map((c) => {
              const active = c === cat;
              const count = c === ALL ? menus.length : menus.filter((m) => m.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  aria-pressed={active}
                  className="chip shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wide"
                  style={
                    active
                      ? { background: "var(--navy)", color: "#fff" }
                      : { background: "var(--white)", color: "var(--navy-muted)", boxShadow: "var(--shadow-sm)" }
                  }
                >
                  {c}
                  <span
                    className="text-[10px] font-bold px-1.5 py-px rounded-full tabular-nums"
                    style={
                      active
                        ? { background: "rgba(255,255,255,0.18)", color: "#fff" }
                        : { background: "var(--surface)", color: "var(--navy-muted)" }
                    }
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Deals rail — discounted dishes, horizontal scroll */}
      {deals.length > 0 && !isFiltering && (
        <section className="mt-4 -mx-4" aria-label="Promo hari ini">
          <div className="flex items-center gap-2 px-4 mb-2.5">
            <BadgePercent size={16} style={{ color: "var(--orange-ink)" }} strokeWidth={2.2} />
            <h2 className="font-display text-[15px] font-bold" style={{ color: "var(--navy)" }}>
              Promo Hari Ini
            </h2>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ background: "var(--orange-blush)", color: "var(--orange-ink)" }}
            >
              {deals.length} menu
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar scroll-fade-r px-4 pb-1">
            {deals.map((m, i) => (
              <Link
                key={m.id_menu}
                href={`/${slug}/${m.id_menu}`}
                className={`deal-card card shrink-0 w-[150px] overflow-hidden fade-up stagger-${Math.min(i + 1, 6)}`}
                aria-label={`Promo ${m.nama_menu}, diskon ${m.discount_pct}%`}
              >
                <div className="relative w-full aspect-square overflow-hidden">
                  {m.image_url ? (
                    <Image src={m.image_url} alt={m.nama_menu} fill sizes="150px" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 dish-mesh flex items-center justify-center">
                      <Box size={26} color="rgba(253,253,253,0.5)" strokeWidth={1.4} />
                    </div>
                  )}
                  {/* Swiggy-style offer strip */}
                  <div
                    className="absolute inset-x-0 bottom-0 px-2.5 pt-6 pb-1.5"
                    style={{ background: "linear-gradient(to top, rgba(2,20,50,0.85), transparent)" }}
                  >
                    <p className="text-white font-display font-extrabold text-[15px] leading-none tracking-tight">
                      {m.discount_pct}% OFF
                    </p>
                  </div>
                </div>
                <div className="p-2.5">
                  <h3 className="font-display text-[13px] font-semibold leading-snug line-clamp-1" style={{ color: "var(--navy)" }}>
                    {m.nama_menu}
                  </h3>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <p className="text-[13px] font-bold" style={{ color: "var(--orange-ink)" }}>
                      {formatRupiah(effectivePrice(m))}
                    </p>
                    <p className="text-[10px] line-through" style={{ color: "var(--navy-muted)" }}>
                      {formatRupiah(m.harga_menu)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="h-4" />

      {/* Section label for main grid */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-display text-[15px] font-bold" style={{ color: "var(--navy)" }}>
            {cat === ALL ? "Semua Hidangan" : cat}
          </h2>
          <span className="text-xs tabular-nums" style={{ color: "var(--navy-muted)" }}>
            {filtered.length} menu
          </span>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SearchX size={36} style={{ color: "var(--navy-muted)" }} strokeWidth={1.5} />
          <p className="font-display text-lg font-bold mt-3" style={{ color: "var(--navy)" }}>
            Tidak ada hasil
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--navy-muted)" }}>
            {q ? `untuk "${q}"` : only3d ? "Belum ada menu 3D di kategori ini" : "Coba kategori lain"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {filtered.map((m, i) => (
            <MenuCard key={m.id_menu} menu={m} cafeId={cafeId} slug={slug} index={i} />
          ))}
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: "rgba(2,44,96,0.92)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}
        >
          <WifiOff size={16} style={{ color: "#FD5002", flexShrink: 0 }} strokeWidth={2} />
          <p className="text-sm font-medium text-white leading-snug">
            Anda sedang offline. Menampilkan menu dari memori lokal.
          </p>
        </div>
      )}
    </>
  );
}
