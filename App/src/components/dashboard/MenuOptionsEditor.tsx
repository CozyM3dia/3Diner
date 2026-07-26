"use client";

import { useState } from "react";
import { ChevronDown, Layers, Plus, Trash2 } from "lucide-react";
import type { OptionGroupDraft, OptionValueDraft, RecipeDraftInput } from "@/lib/dashboard-actions";
import { optionGroupsValidationError } from "@/lib/dashboard-actions";
import type { InventoryItem } from "@/types";
import { dashInputStyle as inputStyle } from "@/components/dashboard/system";
import { formatRupiah } from "@/lib/format";

export function emptyOptionGroup(): OptionGroupDraft {
  return {
    name: "",
    min_select: 1,
    max_select: 1,
    values: [emptyOptionValue()],
  };
}

export function emptyOptionValue(): OptionValueDraft {
  return { name: "", price_delta: 0, is_active: true, recipes: [] };
}

/** Grup dengan max_select 1 adalah pilihan tunggal; lebih dari 1 adalah pilihan
 *  ganda. Dua konsep itu dibungkus jadi satu sakelar supaya pemilik tidak perlu
 *  memikirkan angka min/max kecuali memang mau. */
type SelectMode = "single" | "multiple";

function modeOf(group: OptionGroupDraft): SelectMode {
  return group.max_select > 1 ? "multiple" : "single";
}

export default function MenuOptionsEditor({
  groups,
  onGroupsChange,
  inventoryItems,
  disabled = false,
}: {
  groups: OptionGroupDraft[];
  onGroupsChange: (groups: OptionGroupDraft[]) => void;
  inventoryItems: InventoryItem[];
  disabled?: boolean;
}) {
  const validationError = optionGroupsValidationError(groups);

  function updateGroup(index: number, patch: Partial<OptionGroupDraft>) {
    onGroupsChange(groups.map((group, i) => (i === index ? { ...group, ...patch } : group)));
  }

  function updateValue(groupIndex: number, valueIndex: number, patch: Partial<OptionValueDraft>) {
    onGroupsChange(
      groups.map((group, i) =>
        i !== groupIndex
          ? group
          : {
              ...group,
              values: group.values.map((value, j) =>
                j === valueIndex ? { ...value, ...patch } : value
              ),
            }
      )
    );
  }

  function setMode(index: number, mode: SelectMode) {
    const group = groups[index];
    updateGroup(
      index,
      mode === "single"
        ? { min_select: Math.min(group.min_select, 1), max_select: 1 }
        : { max_select: Math.max(2, Math.min(group.values.length, 20)) }
    );
  }

  return (
    <section
      className="dash-card rounded-2xl p-5 space-y-4"
      style={{ background: "var(--dash-panel)", border: "1px solid var(--dash-border)" }}
      aria-labelledby="menu-options-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            id="menu-options-title"
            className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5"
            style={{ color: "var(--dash-muted)" }}
          >
            <Layers size={12} aria-hidden="true" /> Varian &amp; Add-on
          </p>
          <p className="mt-1 text-sm max-w-[52ch]" style={{ color: "var(--dash-secondary)" }}>
            Ukuran, level gula, extra shot. Selisih harga dan potongan stok mengikuti pilihan tamu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onGroupsChange([...groups, emptyOptionGroup()])}
          disabled={disabled || groups.length >= 10}
          className="dash-press inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--dash-raised)", color: "var(--dash-text)" }}
        >
          <Plus size={15} aria-hidden="true" /> Tambah Grup
        </button>
      </div>

      {validationError && (
        <div
          className="rounded-xl px-3 py-2 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
          role="alert"
        >
          {validationError}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--dash-muted)" }}>
          Menu ini dijual apa adanya, tanpa pilihan tambahan.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="rounded-xl p-3 space-y-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--dash-border)" }}
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_40px]">
                <label className="block min-w-0">
                  <span className="sr-only">Nama grup varian {groupIndex + 1}</span>
                  <input
                    value={group.name}
                    onChange={(e) => updateGroup(groupIndex, { name: e.target.value })}
                    disabled={disabled}
                    maxLength={60}
                    placeholder="Nama grup, mis. Ukuran"
                    className="dash-input h-11 w-full rounded-xl px-3 text-sm outline-none"
                    style={inputStyle}
                  />
                </label>

                <label className="block min-w-0">
                  <span className="sr-only">Tipe pilihan grup {groupIndex + 1}</span>
                  <select
                    value={modeOf(group)}
                    onChange={(e) => setMode(groupIndex, e.target.value as SelectMode)}
                    disabled={disabled}
                    className="dash-input h-11 w-full rounded-xl px-3 text-sm outline-none"
                    style={inputStyle}
                  >
                    <option value="single">Pilih satu</option>
                    <option value="multiple">Pilih beberapa</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => onGroupsChange(groups.filter((_, i) => i !== groupIndex))}
                  disabled={disabled}
                  className="dash-press inline-flex h-11 w-10 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
                  aria-label={`Hapus grup ${group.name || groupIndex + 1}`}
                  title="Hapus grup"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>

              <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--dash-secondary)" }}>
                <input
                  type="checkbox"
                  checked={group.min_select === 0}
                  onChange={(e) => updateGroup(groupIndex, { min_select: e.target.checked ? 0 : 1 })}
                  disabled={disabled}
                  className="w-4 h-4 accent-[color:var(--orange)]"
                />
                Boleh dilewati tamu
              </label>

              <div className="space-y-2">
                {group.values.map((value, valueIndex) => (
                  <OptionValueRow
                    key={valueIndex}
                    value={value}
                    inventoryItems={inventoryItems}
                    disabled={disabled}
                    label={`${group.name || `Grup ${groupIndex + 1}`} · pilihan ${valueIndex + 1}`}
                    onChange={(patch) => updateValue(groupIndex, valueIndex, patch)}
                    onRemove={
                      group.values.length > 1
                        ? () =>
                            updateGroup(groupIndex, {
                              values: group.values.filter((_, j) => j !== valueIndex),
                              max_select: Math.min(group.max_select, group.values.length - 1),
                            })
                        : undefined
                    }
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  updateGroup(groupIndex, { values: [...group.values, emptyOptionValue()] })
                }
                disabled={disabled || group.values.length >= 20}
                className="dash-press inline-flex items-center gap-1.5 text-[13px] font-semibold disabled:opacity-50"
                style={{ color: "#FF7A3D" }}
              >
                <Plus size={14} aria-hidden="true" /> Tambah pilihan
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OptionValueRow({
  value,
  inventoryItems,
  disabled,
  label,
  onChange,
  onRemove,
}: {
  value: OptionValueDraft;
  inventoryItems: InventoryItem[];
  disabled: boolean;
  label: string;
  onChange: (patch: Partial<OptionValueDraft>) => void;
  onRemove?: () => void;
}) {
  const [recipesOpen, setRecipesOpen] = useState(value.recipes.length > 0);

  function updateRecipe(index: number, patch: Partial<RecipeDraftInput>) {
    onChange({
      recipes: value.recipes.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  }

  function addRecipe() {
    const used = new Set(value.recipes.map((r) => r.inventory_item_id));
    const next = inventoryItems.find((item) => !used.has(item.id_inventory_item));
    if (!next) return;
    onChange({
      recipes: [...value.recipes, { inventory_item_id: next.id_inventory_item, qty_per_menu: 1 }],
    });
  }

  return (
    <div className="rounded-xl p-2" style={{ background: "var(--dash-raised)" }}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_128px_44px_40px]">
        <label className="block min-w-0">
          <span className="sr-only">Nama {label}</span>
          <input
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={disabled}
            maxLength={60}
            placeholder="Pilihan, mis. Large"
            className="dash-input h-11 w-full rounded-xl px-3 text-sm outline-none"
            style={inputStyle}
          />
        </label>

        <label className="relative block min-w-0">
          <span className="sr-only">Selisih harga {label}</span>
          <input
            value={value.price_delta === 0 ? "" : String(value.price_delta)}
            onChange={(e) => onChange({ price_delta: Math.trunc(Number(e.target.value) || 0) })}
            disabled={disabled}
            type="number"
            step="500"
            inputMode="numeric"
            placeholder="0"
            className="dash-input h-11 w-full rounded-xl pl-8 pr-3 text-sm outline-none tabular-nums"
            style={inputStyle}
          />
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px]"
            style={{ color: "var(--dash-muted)" }}
          >
            Rp
          </span>
        </label>

        <label
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-semibold cursor-pointer"
          style={{
            background: value.is_active ? "rgba(34,211,166,0.12)" : "rgba(255,255,255,0.04)",
            color: value.is_active ? "#22D3A6" : "var(--dash-muted)",
          }}
          title={value.is_active ? "Pilihan aktif" : "Pilihan disembunyikan"}
        >
          <input
            type="checkbox"
            checked={value.is_active}
            onChange={(e) => onChange({ is_active: e.target.checked })}
            disabled={disabled}
            className="sr-only"
          />
          <span className="sr-only">Aktifkan {label}</span>
          {value.is_active ? "Aktif" : "Off"}
        </label>

        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="dash-press inline-flex h-11 w-10 items-center justify-center rounded-xl disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
            aria-label={`Hapus ${label}`}
            title="Hapus pilihan"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>

      {value.price_delta !== 0 && (
        <p className="mt-1.5 px-1 text-[11px]" style={{ color: "var(--dash-muted)" }}>
          Harga menu {value.price_delta > 0 ? "naik" : "turun"} {formatRupiah(Math.abs(value.price_delta))}
        </p>
      )}

      {/* Resep per varian disembunyikan sampai diminta: sebagian besar pilihan
          seperti "level gula" tidak memotong stok terpisah. */}
      {inventoryItems.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setRecipesOpen((open) => !open)}
            className="dash-press inline-flex items-center gap-1 px-1 text-[11px] font-medium"
            style={{ color: "var(--dash-muted)" }}
            aria-expanded={recipesOpen}
          >
            <ChevronDown
              size={12}
              aria-hidden="true"
              style={{
                transform: recipesOpen ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 160ms var(--ease-out)",
              }}
            />
            Bahan tambahan
            {value.recipes.length > 0 && ` (${value.recipes.length})`}
          </button>

          {recipesOpen && (
            <div className="mt-2 space-y-2">
              {value.recipes.map((row, index) => {
                const item = inventoryItems.find((i) => i.id_inventory_item === row.inventory_item_id);
                return (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_100px_40px] gap-2">
                    <select
                      value={row.inventory_item_id}
                      onChange={(e) => updateRecipe(index, { inventory_item_id: e.target.value })}
                      disabled={disabled}
                      className="dash-input h-10 min-w-0 rounded-xl px-3 text-[13px] outline-none"
                      style={inputStyle}
                      aria-label={`Bahan ${index + 1} untuk ${label}`}
                    >
                      {inventoryItems.map((candidate) => (
                        <option
                          key={candidate.id_inventory_item}
                          value={candidate.id_inventory_item}
                          disabled={
                            candidate.id_inventory_item !== row.inventory_item_id &&
                            value.recipes.some(
                              (other) => other.inventory_item_id === candidate.id_inventory_item
                            )
                          }
                        >
                          {candidate.name}
                        </option>
                      ))}
                    </select>
                    <label className="relative block min-w-0">
                      <span className="sr-only">Jumlah bahan {index + 1} untuk {label}</span>
                      <input
                        value={row.qty_per_menu || ""}
                        onChange={(e) =>
                          updateRecipe(index, { qty_per_menu: Number(e.target.value) || 0 })
                        }
                        disabled={disabled}
                        type="number"
                        min="0.001"
                        step="0.001"
                        inputMode="decimal"
                        className="dash-input h-10 w-full rounded-xl px-3 pr-8 text-[13px] outline-none"
                        style={inputStyle}
                      />
                      <span
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
                        style={{ color: "var(--dash-muted)" }}
                      >
                        {item?.unit}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onChange({ recipes: value.recipes.filter((_, i) => i !== index) })}
                      disabled={disabled}
                      className="dash-press inline-flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-50"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
                      aria-label={`Hapus bahan ${item?.name ?? index + 1}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRecipe}
                disabled={disabled || value.recipes.length >= inventoryItems.length}
                className="dash-press inline-flex items-center gap-1 px-1 text-[11px] font-semibold disabled:opacity-50"
                style={{ color: "#FF7A3D" }}
              >
                <Plus size={12} aria-hidden="true" /> Tambah bahan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
