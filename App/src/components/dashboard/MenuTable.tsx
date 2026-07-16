"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Box, Pencil, GripVertical, ChevronUp, ChevronDown, ChevronsUpDown, Check, Loader2 } from "lucide-react";
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
  const display = sortMenusForDisplay(rows, sortKey, sortDir, inventoryByMenu);

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

  // eslint-disable-next-line react-hooks/purity
  const showSaved = savedAt > 0 && Date.now() - savedAt < 2200;

  return (
    <div className="rounded-2xl overflow-hidden dash-reveal dash-d1" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Toolbar: sort state + return to manual */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="text-[11px] font-medium" style={{ color: "#5A7898" }}>
          {manual ? "Seret baris untuk atur urutan" : "Urutan tampilan (klik judul lagi untuk reset)"}
        </span>
        <span className="text-[11px] font-medium inline-flex items-center gap-1.5" style={{ color: pending ? "#5A7898" : showSaved ? "#22D3A6" : "#41557A" }}>
          {pending ? (
            <><Loader2 size={11} className="animate-spin" /> Menyimpan</>
          ) : showSaved ? (
            <><Check size={11} /> Tersimpan</>
          ) : !manual ? (
            <button onClick={() => setSortKey(null)} className="dash-press px-2 py-1 rounded-md" style={{ background: "#132136", color: "#B8C7DC" }}>
              Urutan manual
            </button>
          ) : null}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px]" aria-label="Daftar menu">
          <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <th className="w-10 px-2 py-3" />
            <th className="w-12 px-2 py-3" />
            <SortableTH label="Nama" col="nama" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <SortableTH label="Kategori" col="kategori" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <SortableTH label="Harga" col="harga" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} align="right" />
            <SortableTH label="3D" col="3d" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <SortableTH label="Inventory" col="inventory" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <SortableTH label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
            <th className="px-4 py-3" />
          </tr>
          </thead>
          <tbody>
          {display.map((menu, i) => {
            const active = menu.is_active !== false;
            const isDragging = dragId === menu.id_menu;
            return (
              <tr
                key={menu.id_menu}
                draggable={manual}
                onDragStart={(e) => {
                  if (!manual) return;
                  dragId_.current = menu.id_menu;
                  setDragId(menu.id_menu);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!manual || !dragId_.current) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!manual) return;
                  e.preventDefault();
                  onDrop(menu.id_menu);
                  setDragId(null);
                  dragId_.current = null;
                }}
                onDragEnd={() => {
                  setDragId(null);
                  dragId_.current = null;
                }}
                className="dash-row group"
                style={{
                  borderBottom: i < display.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  opacity: isDragging ? 0.4 : active ? 1 : 0.55,
                  background: isDragging ? "#132136" : "transparent",
                  transition: "opacity 150ms ease-out, background 150ms ease-out",
                }}
              >
                {/* Drag handle */}
                <td className="px-2 py-3">
                  <span
                    className="flex items-center justify-center transition-opacity"
                    style={{
                      color: "#41557A",
                      cursor: manual ? "grab" : "not-allowed",
                      opacity: manual ? 1 : 0.25,
                    }}
                    title={manual ? "Seret untuk pindah" : "Reset ke urutan manual untuk menyeret"}
                  >
                    <GripVertical size={16} />
                  </span>
                </td>
                {/* Thumb */}
                <td className="px-2 py-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: "#132136" }}>
                    {menu.image_url ? (
                      <Image src={menu.image_url} alt="" width={40} height={40} className="object-cover w-full h-full" />
                    ) : (
                      <Box size={16} style={{ color: "#5A7898" }} />
                    )}
                  </div>
                </td>
                {/* Nama */}
                <td className="px-4 py-3">
                  <p className="text-sm font-medium truncate max-w-[200px]" style={{ color: "#E9EEF6" }} title={menu.nama_menu}>
                    {menu.nama_menu}
                  </p>
                </td>
                {/* Kategori */}
                <td className="px-4 py-3">
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#132136", color: "#5A7898" }}>
                    {menu.category ?? "-"}
                  </span>
                </td>
                {/* Harga */}
                <td className="px-4 py-3 text-sm font-semibold tabular-nums text-right" style={{ color: "#E9EEF6" }}>
                  {formatRupiah(menu.harga_menu)}
                </td>
                {/* 3D */}
                <td className="px-4 py-3">
                  {menu.model_3d_url ? (
                    <span className="text-xs font-bold" style={{ color: "#00C2A8" }}>3D</span>
                  ) : (
                    <span style={{ color: "#5A7898" }}>-</span>
                  )}
                </td>
                {/* Inventory */}
                <td className="px-4 py-3">
                  <InventoryBadge state={inventoryByMenu[menu.id_menu] ?? "none"} />
                </td>
                {/* Status */}
                <td className="px-4 py-3">
                  <MenuActiveToggle menuId={menu.id_menu} initialActive={active} />
                </td>
                {/* Edit */}
                <td className="px-4 py-3 text-right">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <Link
                      href={`/dashboard/menu/${menu.id_menu}/edit`}
                      className="dash-press dash-icon-btn inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                      style={{ background: "#132136", color: "#E9EEF6" }}
                    >
                      <Pencil size={12} /> Edit
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryBadge({ state }: { state: MenuInventoryState }) {
  const meta = {
    none: { label: "Tanpa resep", color: "#5A7898", bg: "#132136" },
    ready: { label: "Resep aktif", color: "#22D3A6", bg: "rgba(34,211,166,0.12)" },
    low: { label: "Stok kurang", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  }[state];

  return (
    <span
      className="inline-flex whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: meta.bg, color: meta.color }}
    >
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
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onClick(col)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
        style={{ color: on ? "#E9EEF6" : "#5A7898", flexDirection: align === "right" ? "row-reverse" : "row" }}
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
