"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Box, Sparkles, SearchX } from "lucide-react";
import { logEvent } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import MenuCard from "./MenuCard";
import type { Menu } from "@/types";

interface MenuBrowserProps {
  menus: Menu[];
  cafeId: string;
  slug: string;
}

export default function MenuBrowser({ menus, cafeId, slug }: MenuBrowserProps) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return menus;
    return menus.filter(
      (m) =>
        m.nama_menu.toLowerCase().includes(t) ||
        (m.description_menu ?? "").toLowerCase().includes(t)
    );
  }, [menus, q]);

  const groups = useMemo(() => {
    const g: Record<string, Menu[]> = {};
    for (const m of filtered) (g[m.category ?? "Lainnya"] ??= []).push(m);
    return g;
  }, [filtered]);

  const cats = Object.keys(groups);
  const spotlight = q.trim() ? null : menus[0];

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.getAttribute("data-cat") ?? "");
        }),
      { rootMargin: "-42% 0px -52% 0px" }
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [cats.join("|")]);

  function go(cat: string) {
    sectionRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* Sticky toolbar: search + category nav */}
      <div
        className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2.5"
        style={{
          background: "rgba(246,248,251,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid #E0E7EE",
        }}
      >
        <div className="relative mb-2.5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color="#51698F" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari menu…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2"
            style={{ background: "#FFFFFF", border: "1px solid #CFD9E4", color: "#022C60" }}
          />
        </div>
        {cats.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => go(c)}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={
                  active === c
                    ? { background: "#FD5002", color: "#FFFFFF" }
                    : { background: "#E0E7EE", color: "#254473" }
                }
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spotlight featured */}
      {spotlight && (
        <Link
          href={`/${slug}/${spotlight.id_menu}`}
          onClick={() =>
            logEvent({ cafe_id: cafeId, menu_id: spotlight.id_menu, event_type: "click_menu", duration: 0 })
          }
          className="menu-card card block overflow-hidden mt-5 fade-up"
        >
          <div className="relative w-full aspect-[16/10] overflow-hidden">
            {spotlight.image_url ? (
              <Image src={spotlight.image_url} alt={spotlight.nama_menu} fill sizes="100vw" className="card-img object-cover" />
            ) : (
              <div className="card-img absolute inset-0 dish-mesh flex items-center justify-center">
                <Box size={48} color="rgba(253,253,253,0.5)" strokeWidth={1.3} className="float" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "linear-gradient(to top, rgba(0,35,85,0.82), transparent)" }} />
            <span
              className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: "#FD5002", boxShadow: "0 6px 16px rgba(253,80,2,0.4)" }}
            >
              <Sparkles size={11} /> UNGGULAN
            </span>
            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="font-display text-2xl font-semibold text-white leading-tight">{spotlight.nama_menu}</h3>
              <div className="flex items-center justify-between mt-2">
                <span className="text-base font-bold" style={{ color: "#FF8A4C" }}>
                  {formatRupiah(spotlight.harga_menu)}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(253,253,253,0.16)", color: "#FFFFFF" }}>
                  Lihat 3D →
                </span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Sections */}
      {cats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SearchX size={36} color="#51698F" strokeWidth={1.5} />
          <p className="font-display text-lg font-semibold mt-3" style={{ color: "#022C60" }}>
            Tidak ada menu cocok
          </p>
          <p className="text-sm mt-1" style={{ color: "#51698F" }}>
            Coba kata kunci lain
          </p>
        </div>
      ) : (
        <div className="space-y-9 mt-7">
          {cats.map((cat) => {
            let items = groups[cat];
            if (spotlight) items = items.filter((i) => i.id_menu !== spotlight.id_menu);
            if (items.length === 0) return null;
            return (
              <section
                key={cat}
                data-cat={cat}
                ref={(el) => { sectionRefs.current[cat] = el; }}
                style={{ scrollMarginTop: "130px" }}
              >
                <header className="flex items-center gap-3 mb-4">
                  <h2 className="font-display text-lg font-semibold" style={{ color: "#022C60" }}>
                    {cat}
                  </h2>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#FDD8C3", color: "#FD5002" }}>
                    {groups[cat].length}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "#CFD9E4" }} />
                </header>
                <div className="grid grid-cols-2 gap-3.5">
                  {items.map((m, i) => (
                    <MenuCard key={m.id_menu} menu={m} cafeId={cafeId} slug={slug} index={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
