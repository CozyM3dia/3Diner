"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Box,
  Pencil,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Check,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { reorderMenus } from "@/lib/dashboard-actions";
import MenuActiveToggle from "@/components/dashboard/MenuActiveToggle";
import type { Menu } from "@/types";

export type MenuInventoryState = "none" | "ready" | "low";
export type SortKey = "nama" | "kategori" | "harga" | "3d" | "status" | "inventory";
export type SortDir = "asc" | "desc";

const idsOf = (m: Menu[]) => m.map((x) => x.id_menu).join(",");

function compare(a: Menu, b: Menu, key: SortKey, inventoryRank: (id: string) => number): number {
  switch (key) {
    case "nama":
      return a.nama_menu.localeCompare(b.nama_menu, "id", { sensitivity: "base" });
    case "kategori":
      return (a.category ?? "").localeCompare(b.category ?? "", "id", { sensitivity: "base" });
    case "harga":
      return a.harga_menu - b.harga_menu;
    case "3d":
      return Number(!!a.model_3d_url) - Number(!!b.model_3d_url);
    case "status":
      return Number(a.is_active !== false) - Number(b.is_active !== false);
    case "inventory":
      return inventoryRank(a.id_menu) - inventoryRank(b.id_menu);
  }
}

function inventoryRankFor(inventoryByMenu: Record<string, MenuInventoryState>, id: string) {
  const state = inventoryByMenu[id] ?? "none";
  return state === "low" ? 0 : state === "ready" ? 1 : 2;
}

export function sortMenusForDisplay(
  rows: Menu[],
  sortKey: SortKey | null,
  sortDir: SortDir,
  inventoryByMenu: Record<string, MenuInventoryState>
) {
  if (sortKey === null) return rows;
  return [...rows].sort((a, b) =>
    sortDir === "asc"
      ? compare(a, b, sortKey, (id) => inventoryRankFor(inventoryByMenu, id))
      : -compare(a, b, sortKey, (id) => inventoryRankFor(inventoryByMenu, id))
  );
}

export default function MenuTable({
  menus,
  inventoryByMenu = {},
}: {
  menus: Menu[];
  inventoryByMenu?: Record<string, MenuInventoryState>;
}) {
  const [rows, setRows] = useState<Menu[]>(menus);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dragId, setDragId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState(0);
  const dragId_ = useRef<string | null>(null);

  // Keep local order in sync when the server sends a new set/order.
  useEffect(() => {
    // Preserve the existing local drag order synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(menus);
  }, [idsOf(menus)]); // eslint-disable-line react-hooks/exhaustive-deps

  const manual = sortKey === null;
  const q = query.trim().toLowerCase();
  // Dragging while the list is filtered would reorder against hidden rows.
  const canDrag = manual && q === "";
  const sorted = sortMenusForDisplay(rows, sortKey, sortDir, inventoryByMenu);
  const display = q === ""
    ? sorted
    : sorted.filter(
        (m) =>
          m.nama_menu.toLowerCase().includes(q) ||
          (m.category ?? "").toLowerCase().includes(q)
      );

  function clickHeader(key: SortKey) {
    if (sortKey === key) {
      // asc -> desc -> manual
      if (sortDir === "asc") setSortDir("desc");
      else setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function persist(next: Menu[]) {
    startTransition(async () => {
      const res = await reorderMenus(next.map((m) => m.id_menu));
      if (!res.error) setSavedAt(Date.now());
    });
  }

  function onDrop(targetId: string) {
    const from = rows.findIndex((m) => m.id_menu === dragId_.current);
    const to = rows.findIndex((m) => m.id_menu === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRows(next);
    persist(next);
  }

  const dragHandlers = (menu: Menu) => ({
    draggable: canDrag,
    onDragStart: (e: React.DragEvent) => {
      if (!canDrag) return;
      dragId_.current = menu.id_menu;
      setDragId(menu.id_menu);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      if (!canDrag || !dragId_.current) return;
      e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      if (!canDrag) return;
      e.preventDefault();
      onDrop(menu.id_menu);
      setDragId(null);
      dragId_.current = null;
    },
    onDragEnd: () => {
      setDragId(null);
      dragId_.current = null;
    },
  });

  // eslint-disable-next-line react-hooks/purity
  const showSaved = savedAt > 0 && Date.now() - savedAt < 2200;

  return (
    <div className="dash-panel dash-reveal dash-d1">
      {/* Toolbar: search + sort state + save indicator */}
      <div
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2.5"
        style={{ borderBottom: "1px solid var(--dash-border)" }}
      >
        <div
          className="flex items-center gap-2 rounded-[10px] px-2.5 w-full sm:w-[240px]"
          style={{ background: "var(--dash-raised)", border: "1px solid var(--dash-border)", height: "34px" }}
        >
          <Search size={13} style={{ color: "var(--dash-muted)" }} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari menu / kategori…"
            aria-label="Cari menu"
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none"
            style={{ color: "var(--dash-text)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Hapus pencarian" className="dash-press" style={{ color: "var(--dash-muted)" }}>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          <span className="text-[11px] font-medium" style={{ color: "var(--dash-muted)" }}>
            {q !== ""
              ? `${display.length} hasil`
              : manual
              ? "Seret baris untuk atur urutan"
              : "Urutan tampilan (klik judul lagi untuk reset)"}
          </span>
          <span className="text-[11px] font-medium inline-flex items-center gap-1.5" style={{ color: pending ? "var(--dash-muted)" : showSaved ? "#22D3A6" : "#41557A" }}>
            {pending ? (
              <><Loader2 size={11} className="animate-spin" /> Menyimpan</>
            ) : showSaved ? (
              <><Check size={11} /> Tersimpan</>
            ) : !manual ? (
              <button onClick={() => setSortKey(null)} className="dash-press px-2 py-1 rounded-md" style={{ background: "var(--dash-raised)", color: "#B8C7DC" }}>
                Urutan manual
              </button>
            ) : null}
          </span>
        </div>
      </div>

      {/* ── Desktop table (lg+) ── */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[720px]" aria-label="Daftar menu">
          <thead>
          <tr style={{ borderBottom: "1px solid var(--dash-border)" }}>
            <th className="w-8 px-1.5 py-2.5" />
            <th className="w-11 px-1.5 py-2.5" />
            <SortableTH label="Nama" col="nama" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <SortableTH label="Kategori" col="kategori" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <SortableTH label="Harga" col="harga" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} align="right" />
            <SortableTH label="3D" col="3d" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <SortableTH label="Resep" col="inventory" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <SortableTH label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--dash-muted)" }}>
              Aksi
            </th>
          </tr>
          </thead>
          <tbody>
          {display.map((menu, i) => {
            const active = menu.is_active !== false;
            const isDragging = dragId === menu.id_menu;
            return (
              <tr
                key={menu.id_menu}
                {...dragHandlers(menu)}
                className="dash-row group"
                style={{
                  borderBottom: i < display.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  opacity: isDragging ? 0.4 : active ? 1 : 0.55,
                  background: isDragging ? "var(--dash-raised)" : "transparent",
                  transition: "opacity 150ms ease-out, background 150ms ease-out",
                }}
              >
                {/* Drag handle */}
                <td className="px-1.5 py-2.5">
                  <span
                    className="flex items-center justify-center transition-opacity"
                    style={{
                      color: "#41557A",
                      cursor: canDrag ? "grab" : "not-allowed",
                      opacity: canDrag ? 1 : 0.25,
                    }}
                    title={canDrag ? "Seret untuk pindah" : "Reset urutan & kosongkan pencarian untuk menyeret"}
                  >
                    <GripVertical size={15} />
                  </span>
                </td>
                {/* Thumb */}
                <td className="px-1.5 py-2.5">
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: "var(--dash-raised)" }}>
                    {menu.image_url ? (
                      <Image src={menu.image_url} alt="" width={36} height={36} className="object-cover w-full h-full" />
                    ) : (
                      <Box size={15} style={{ color: "var(--dash-muted)" }} />
                    )}
                  </div>
                </td>
                {/* Nama */}
                <td className="px-3 py-2.5">
                  <p className="text-[13px] font-medium truncate max-w-[220px]" style={{ color: "var(--dash-text)" }} title={menu.nama_menu}>
                    {menu.nama_menu}
                  </p>
                </td>
                {/* Kategori */}
                <td className="px-3 py-2.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "var(--dash-raised)", color: "var(--dash-muted)" }}>
                    {menu.category ?? "-"}
                  </span>
                </td>
                {/* Harga */}
                <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums text-right whitespace-nowrap" style={{ color: "var(--dash-text)" }}>
                  {formatRupiah(menu.harga_menu)}
                </td>
                {/* 3D */}
                <td className="px-3 py-2.5">
                  <Badge3D has={!!menu.model_3d_url} />
                </td>
                {/* Resep */}
                <td className="px-3 py-2.5">
                  <InventoryBadge state={inventoryByMenu[menu.id_menu] ?? "none"} />
                </td>
                {/* Status */}
                <td className="px-3 py-2.5">
                  <MenuActiveToggle menuId={menu.id_menu} initialActive={active} />
                </td>
                {/* Edit */}
                <td className="px-3 py-2.5 text-right">
                  <Link
                    href={`/dashboard/menu/${menu.id_menu}/edit`}
                    className="dash-press dash-icon-btn inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap"
                    style={{ background: "var(--dash-raised)", color: "var(--dash-text)" }}
                  >
                    <Pencil size={12} aria-hidden="true" /> Edit
                  </Link>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
        {display.length === 0 && (
          <p className="text-sm py-10 text-center" style={{ color: "var(--dash-muted)" }}>
            Tidak ada menu yang cocok dengan pencarian.
          </p>
        )}
      </div>

      {/* ── Compact cards (<lg) ── */}
      <ul className="lg:hidden" aria-label="Daftar menu (tampilan ringkas)">
        {display.map((menu, i) => {
          const active = menu.is_active !== false;
          const isDragging = dragId === menu.id_menu;
          return (
            <li
              key={menu.id_menu}
              {...dragHandlers(menu)}
              className="flex gap-3 px-3 py-3"
              style={{
                borderBottom: i < display.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                opacity: isDragging ? 0.4 : active ? 1 : 0.55,
                background: isDragging ? "var(--dash-raised)" : "transparent",
              }}
            >
              {canDrag && (
                <span className="flex items-center shrink-0" style={{ color: "#41557A", cursor: "grab" }} title="Seret untuk pindah">
                  <GripVertical size={15} />
                </span>
              )}
              <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ background: "var(--dash-raised)" }}>
                {menu.image_url ? (
                  <Image src={menu.image_url} alt="" width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                  <Box size={17} style={{ color: "var(--dash-muted)" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "var(--dash-text)" }} title={menu.nama_menu}>
                    {menu.nama_menu}
                  </p>
                  <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: "var(--dash-text)" }}>
                    {formatRupiah(menu.harga_menu)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--dash-raised)", color: "var(--dash-muted)" }}>
                    {menu.category ?? "Tanpa kategori"}
                  </span>
                  <Badge3D has={!!menu.model_3d_url} />
                  <InventoryBadge state={inventoryByMenu[menu.id_menu] ?? "none"} />
                </div>
                <div className="flex items-center justify-between gap-2 mt-2.5">
                  <MenuActiveToggle menuId={menu.id_menu} initialActive={active} />
                  <Link
                    href={`/dashboard/menu/${menu.id_menu}/edit`}
                    className="dash-press inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
                    style={{ background: "var(--dash-raised)", color: "var(--dash-text)", height: "34px" }}
                  >
                    <Pencil size={12} aria-hidden="true" /> Edit
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
        {display.length === 0 && (
          <li className="text-sm py-10 text-center list-none" style={{ color: "var(--dash-muted)" }}>
            Tidak ada menu yang cocok dengan pencarian.
          </li>
        )}
      </ul>
    </div>
  );
}

function Badge3D({ has }: { has: boolean }) {
  if (!has) {
    return <span className="text-[11px]" style={{ color: "#41557A" }}>—</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full"
      style={{ background: "rgba(0,194,168,0.12)", color: "#00C2A8" }}
    >
      3D
    </span>
  );
}

function InventoryBadge({ state }: { state: MenuInventoryState }) {
  if (state === "none") {
    return (
      <span
        className="inline-flex whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full"
        style={{ color: "#41557A", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        Tanpa resep
      </span>
    );
  }
  const meta = {
    ready: { label: "Resep aktif", color: "#22D3A6", bg: "rgba(34,211,166,0.12)" },
    low: { label: "Stok kurang", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  }[state];

  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: meta.bg, color: meta.color }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function SortableTH({
  label,
  col,
  sortKey,
  sortDir,
  onClick,
  align = "left",
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const on = sortKey === col;
  return (
    <th className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onClick(col)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
        style={{ color: on ? "var(--dash-text)" : "var(--dash-muted)", flexDirection: align === "right" ? "row-reverse" : "row" }}
      >
        {label}
        {on ? (
          sortDir === "asc" ? <ChevronUp size={13} style={{ color: "#FD5002" }} /> : <ChevronDown size={13} style={{ color: "#FD5002" }} />
        ) : (
          <ChevronsUpDown size={12} style={{ color: "#2C3E5C" }} />
        )}
      </button>
    </th>
  );
}
