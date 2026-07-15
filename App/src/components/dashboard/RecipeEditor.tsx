"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { saveMenuRecipes, type RecipeDraftInput } from "@/lib/dashboard-actions";
import type { InventoryItem, MenuRecipe } from "@/types";

const inputStyle: React.CSSProperties = {
  background: "#132136",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E9EEF6",
};

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
  menuId,
  inventoryItems,
  recipes,
}: {
  menuId?: string;
  inventoryItems: InventoryItem[];
  recipes: MenuRecipe[];
}) {
  const [rows, setRows] = useState<RecipeDraftInput[]>(() =>
    recipes.map((recipe) => ({
      inventory_item_id: recipe.inventory_item_id,
      qty_per_menu: recipe.qty_per_menu,
    }))
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const itemById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id_inventory_item, item])),
    [inventoryItems]
  );

  if (!menuId) {
    return (
      <section
        className="dash-card rounded-2xl p-5"
        style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}
        aria-labelledby="recipe-editor-title"
      >
        <p id="recipe-editor-title" className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>
          Resep Inventory
        </p>
        <p className="mt-2 text-sm" style={{ color: "#9FB6D1" }}>
          Simpan menu terlebih dahulu, lalu buka halaman edit untuk menghubungkan bahan inventory.
        </p>
      </section>
    );
  }

  const currentMenuId = menuId;
  const validationError = recipeRowsValidationError(rows);
  const visibleError = validationError ?? error;

  function addRow() {
    const row = nextRecipeRow(inventoryItems, rows);
    if (row) setRows((current) => [...current, row]);
  }

  function updateRow(index: number, patch: Partial<RecipeDraftInput>) {
    setError("");
    setSaved(false);
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function save() {
    setError("");
    setSaved(false);
    if (validationError) {
      setError(validationError);
      return;
    }
    startTransition(async () => {
      const result = await saveMenuRecipes(currentMenuId, rows);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    });
  }

  return (
    <section
      className="dash-card rounded-2xl p-5 space-y-4"
      style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}
      aria-labelledby="recipe-editor-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p id="recipe-editor-title" className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>
            Resep Inventory
          </p>
          <p className="mt-1 text-sm" style={{ color: "#9FB6D1" }}>
            Bahan di sini otomatis berkurang saat menu dipesan.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={pending || !nextRecipeRow(inventoryItems, rows)}
          className="dash-press inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "#132136", color: "#E9EEF6" }}
        >
          <Plus size={15} aria-hidden="true" /> Tambah Bahan
        </button>
      </div>

      {visibleError && (
        <div className="rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }} role="alert">
          {visibleError}
        </div>
      )}

      {inventoryItems.length === 0 ? (
        <p className="text-sm" style={{ color: "#5A7898" }}>
          Belum ada bahan inventory. Tambahkan bahan di halaman Inventory dulu.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "#5A7898" }}>
          Menu ini belum memakai stok inventory.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const item = itemById.get(row.inventory_item_id);
            return (
              <div key={`${row.inventory_item_id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_106px_40px] gap-2">
                <select
                  value={row.inventory_item_id}
                  onChange={(event) => updateRow(index, { inventory_item_id: event.target.value })}
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
                    type="number"
                    min="0.001"
                    step="0.001"
                    inputMode="decimal"
                    className="dash-input h-11 w-full rounded-xl px-3 pr-9 text-sm outline-none"
                    style={inputStyle}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "#5A7898" }}>
                    {item?.unit}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  disabled={pending}
                  className="dash-press inline-flex h-11 w-10 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
                  aria-label={`Hapus bahan ${item?.name ?? index + 1}`}
                  title="Hapus bahan"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending || Boolean(validationError)}
        className="dash-btn inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed"
        style={{ background: saved ? "#22D3A6" : "#FD5002", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : saved ? <CheckCircle2 size={15} aria-hidden="true" /> : null}
        {pending ? "Menyimpan Resep" : saved ? "Resep Tersimpan" : "Simpan Resep"}
      </button>
    </section>
  );
}
