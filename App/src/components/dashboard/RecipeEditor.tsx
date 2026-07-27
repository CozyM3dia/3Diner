"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Plus, Trash2 } from "lucide-react";
import type { RecipeDraftInput } from "@/lib/dashboard-actions";
import type { InventoryItem } from "@/types";
import { dashInputStyle as inputStyle } from "@/components/dashboard/system";
import { formatQty, inventoryStatus } from "@/lib/inventory";

export function nextRecipeRow(
  inventoryItems: Pick<InventoryItem, "id_inventory_item">[],
  rows: RecipeDraftInput[]
): RecipeDraftInput | undefined {
  const usedItemIds = new Set(rows.map((row) => row.inventory_item_id));
  const item = inventoryItems.find((candidate) => !usedItemIds.has(candidate.id_inventory_item));
  return item ? { inventory_item_id: item.id_inventory_item, qty_per_menu: 1 } : undefined;
}

export function recipeRowsValidationError(rows: RecipeDraftInput[]): string | undefined {
  return rows.some((row) => !Number.isFinite(row.qty_per_menu) || row.qty_per_menu <= 0)
    ? "Jumlah setiap bahan harus lebih dari 0."
    : undefined;
}

export default function RecipeEditor({
  inventoryItems,
  rows,
  onRowsChange,
  disabled = false,
}: {
  inventoryItems: InventoryItem[];
  rows: RecipeDraftInput[];
  onRowsChange: (rows: RecipeDraftInput[]) => void;
  disabled?: boolean;
}) {
  const itemById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id_inventory_item, item])),
    [inventoryItems]
  );

  const validationError = recipeRowsValidationError(rows);

  function addRow() {
    const row = nextRecipeRow(inventoryItems, rows);
    if (row) onRowsChange([...rows, row]);
  }

  function updateRow(index: number, patch: Partial<RecipeDraftInput>) {
    onRowsChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  return (
    <section
      className="dash-card rounded-2xl p-5 space-y-4"
      style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}
      aria-labelledby="recipe-editor-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p id="recipe-editor-title" className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--dash-muted)" }}>
            Resep Inventory
          </p>
          <p className="mt-1 text-sm" style={{ color: "#9FB6D1" }}>
            Bahan di sini otomatis berkurang saat menu dipesan.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled || !nextRecipeRow(inventoryItems, rows)}
          className="dash-press inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "#132136", color: "#E9EEF6" }}
        >
          <Plus size={15} aria-hidden="true" /> Tambah Bahan
        </button>
      </div>

      {validationError && (
        <div className="rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }} role="alert">
          {validationError}
        </div>
      )}

      {inventoryItems.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3" style={{ background: "#132136" }}>
          <p className="text-sm" style={{ color: "#9FB6D1" }}>
            Belum ada bahan inventory. Tambahkan bahan sebelum membuat resep.
          </p>
          <InventoryLink />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--dash-muted)" }}>
          Menu ini belum memakai stok inventory.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const item = itemById.get(row.inventory_item_id);
            return (
              <div key={`${row.inventory_item_id}-${index}`} className="rounded-xl p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="grid grid-cols-[minmax(0,1fr)_106px_40px] gap-2">
                  <select
                    value={row.inventory_item_id}
                    onChange={(event) => updateRow(index, { inventory_item_id: event.target.value })}
                    disabled={disabled}
                    className="dash-input h-11 min-w-0 rounded-xl px-3 text-sm outline-none"
                    style={inputStyle}
                    aria-label={`Bahan resep ${index + 1}`}
                  >
                    {inventoryItems.map((candidate) => (
                      <option
                        key={candidate.id_inventory_item}
                        value={candidate.id_inventory_item}
                        disabled={
                          candidate.id_inventory_item !== row.inventory_item_id &&
                          rows.some((otherRow) => otherRow.inventory_item_id === candidate.id_inventory_item)
                        }
                      >
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  <label className="relative block min-w-0">
                    <span className="sr-only">Jumlah bahan {index + 1}</span>
                    <input
                      value={row.qty_per_menu || ""}
                      onChange={(event) => updateRow(index, { qty_per_menu: Number(event.target.value) || 0 })}
                      disabled={disabled}
                      type="number"
                      min="0.001"
                      step="0.001"
                      inputMode="decimal"
                      className="dash-input h-11 w-full rounded-xl px-3 pr-9 text-sm outline-none"
                      style={inputStyle}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "var(--dash-muted)" }}>
                      {item?.unit}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onRowsChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                    disabled={disabled}
                    className="dash-press inline-flex h-11 w-10 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
                    aria-label={`Hapus bahan ${item?.name ?? index + 1}`}
                    title="Hapus bahan"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
                {item && <RecipeStockContext item={item} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecipeStockContext({ item }: { item: InventoryItem }) {
  const status = inventoryStatus(item);
  const meta = {
    safe: { label: "Aman", color: "#22D3A6" },
    low: { label: "Menipis", color: "#F59E0B" },
    empty: { label: "Habis", color: "#FCA5A5" },
  }[status];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: "var(--dash-muted)" }}>
      <span>Stok {formatQty(item.current_qty, item.unit)}</span>
      <span aria-hidden="true">|</span>
      <span>Minimum {formatQty(item.minimum_qty, item.unit)}</span>
      <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
      {status === "empty" && <InventoryLink compact />}
    </div>
  );
}

function InventoryLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard/inventory"
      className={`dash-press inline-flex items-center gap-1 font-semibold ${compact ? "ml-auto" : "rounded-lg px-2.5 py-1.5 text-xs"}`}
      style={{ color: "#FF7A3D", background: compact ? "transparent" : "rgba(253,80,2,0.12)" }}
    >
      {compact ? "Perbarui stok" : "Buka Inventory"}
      <ArrowUpRight size={compact ? 12 : 14} aria-hidden="true" />
    </Link>
  );
}
