"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { logEvent } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import { effectivePrice } from "@/lib/menu-availability";
import { menuOrderBarSpacerStyle } from "@/lib/menu-order-bar";
import { cartLineKey, type Menu, type MenuOptionGroup, type SelectedOption } from "@/types";

/** Pemilih varian dirender inline di halaman detail, bukan di modal atau sheet.
 *
 *  Tamu sedang membaca satu hidangan di satu layar; membuka lapisan baru untuk
 *  memilih ukuran memutus alur dan menyembunyikan harga yang sedang berubah.
 *  Harga di bilangnya ikut bergerak seiring pilihan, jadi pilihan dan akibatnya
 *  terlihat bersamaan. */
export default function MenuOrderPanel({
  menu,
  slug,
  optionGroups,
}: {
  menu: Menu;
  slug: string;
  optionGroups: MenuOptionGroup[];
}) {
  const { items, count, total, add, setQty } = useCart();
  const isActive = menu.is_active !== false;
  const basePrice = effectivePrice(menu);

  // Grup wajib memulai dengan pilihan pertama supaya tamu yang tidak peduli
  // varian tetap bisa menekan "Tambah" sekali dan selesai.
  const [selection, setSelection] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const group of optionGroups) {
      const first = group.values?.[0];
      initial[group.id_option_group] = group.min_select > 0 && first ? [first.id_option_value] : [];
    }
    return initial;
  });

  const selectedOptions = useMemo<SelectedOption[]>(() => {
    const picked: SelectedOption[] = [];
    for (const group of optionGroups) {
      for (const id of selection[group.id_option_group] ?? []) {
        const value = group.values?.find((v) => v.id_option_value === id);
        if (value) {
          picked.push({
            id_option_value: value.id_option_value,
            group_name: group.name,
            name: value.name,
            price_delta: value.price_delta,
          });
        }
      }
    }
    return picked;
  }, [optionGroups, selection]);

  const unitPrice = basePrice + selectedOptions.reduce((sum, o) => sum + o.price_delta, 0);
  const lineKey = cartLineKey(menu.id_menu, selectedOptions.map((o) => o.id_option_value));
  const qty = items.find((i) => i.line_key === lineKey)?.qty ?? 0;

  const unmetGroup = optionGroups.find(
    (group) => (selection[group.id_option_group] ?? []).length < group.min_select
  );

  function toggle(group: MenuOptionGroup, valueId: string) {
    setSelection((prev) => {
      const current = prev[group.id_option_group] ?? [];

      if (group.max_select === 1) {
        // Pilihan tunggal: menekan yang sudah aktif hanya melepasnya kalau grup
        // ini memang boleh dilewati.
        const next = current.includes(valueId)
          ? group.min_select === 0
            ? []
            : current
          : [valueId];
        return { ...prev, [group.id_option_group]: next };
      }

      if (current.includes(valueId)) {
        return { ...prev, [group.id_option_group]: current.filter((id) => id !== valueId) };
      }
      if (current.length >= group.max_select) return prev;
      return { ...prev, [group.id_option_group]: [...current, valueId] };
    });
  }

  function inc() {
    if (!isActive || unmetGroup) return;
    if (qty === 0) {
      add({ ...menu, harga_menu: basePrice }, 1, selectedOptions);
      logEvent({
        cafe_id: menu.cafe_id,
        menu_id: menu.id_menu,
        event_type: "click_order",
        duration: 0,
      });
    } else {
      setQty(lineKey, qty + 1);
    }
  }

  const barStyle = {
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
    background: "var(--white)",
    borderTop: "1px solid var(--border)",
  };

  return (
    <>
      {optionGroups.length > 0 && isActive && (
        <div className="mx-auto max-w-2xl px-4 pb-2 space-y-5">
          {optionGroups.map((group) => (
            <OptionGroupPicker
              key={group.id_option_group}
              group={group}
              selected={selection[group.id_option_group] ?? []}
              onToggle={(valueId) => toggle(group, valueId)}
            />
          ))}
        </div>
      )}

      {/* Cadangan di alur dokumen: bilah `position:fixed` di bawah tidak boleh
          menutupi CTA 3D atau copy terakhir. Height pixel + padding safe-area —
          spacer yang hanya `var(--menu-order-bar-space)` runtuh ke 0 kalau
          token itu tidak ada di cascade. */}
      <div
        aria-hidden="true"
        data-menu-order-bar-spacer=""
        className="menu-order-bar-spacer"
        style={menuOrderBarSpacerStyle()}
      />

      {!isActive ? (
        <div data-menu-order-bar="" className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3" style={barStyle}>
          <div className="max-w-xl mx-auto">
            <div
              className="w-full h-[52px] rounded-2xl flex items-center justify-center gap-2"
              style={{
                background: "var(--surface)",
                border: "1.5px dashed var(--border)",
                color: "var(--navy-muted)",
              }}
            >
              <ShoppingBag size={16} strokeWidth={1.5} />
              <span className="font-semibold text-sm">Tidak Tersedia</span>
            </div>
          </div>
        </div>
      ) : (
        <div data-menu-order-bar="" className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3" style={barStyle}>
          <div className="flex items-center gap-2 max-w-xl mx-auto">
            {qty === 0 ? (
              <button
                onClick={inc}
                disabled={Boolean(unmetGroup)}
                className="btn-primary press flex-1 inline-flex items-center justify-between gap-2 h-[52px] px-5 rounded-2xl text-white disabled:opacity-60"
              >
                <span className="font-semibold text-sm whitespace-nowrap">
                  {unmetGroup ? `Pilih ${unmetGroup.name}` : "Tambah ke Pesanan"}
                </span>
                <span className="font-bold text-sm whitespace-nowrap tabular-nums">
                  {formatRupiah(unitPrice)}
                </span>
              </button>
            ) : (
              <>
                <div
                  className="menu-order-quantity shrink-0 inline-flex items-center h-[52px] px-1 rounded-2xl"
                  aria-label={`Jumlah ${menu.nama_menu}`}
                  style={{ background: "var(--surface)" }}
                >
                  <button
                    onClick={() => setQty(lineKey, qty - 1)}
                    aria-label={qty === 1 ? `Hapus ${menu.nama_menu} dari pesanan` : "Kurangi jumlah"}
                    className="press w-11 h-11 rounded-xl inline-flex items-center justify-center"
                    style={{ color: "var(--navy)" }}
                  >
                    <Minus size={15} strokeWidth={2.5} />
                  </button>
                  <span
                    key={qty}
                    className="qty-pop w-7 text-center font-bold text-base tabular-nums"
                    style={{ color: "var(--navy)" }}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={inc}
                    aria-label="Tambah jumlah"
                    className="press w-11 h-11 rounded-xl inline-flex items-center justify-center text-white"
                    style={{ background: "var(--orange)" }}
                  >
                    <Plus size={15} strokeWidth={2.5} />
                  </button>
                </div>

                <Link
                  href={`/${slug}/keranjang`}
                  className="btn-primary press flex-1 min-w-0 inline-flex items-center justify-between gap-2 h-[52px] px-4 rounded-2xl text-white"
                  aria-label={`Lihat pesanan, ${count} item, total ${formatRupiah(total)}`}
                >
                  <span className="min-w-0 flex items-center gap-2">
                    <span className="font-semibold text-sm whitespace-nowrap">
                      Lihat pesanan
                    </span>
                    <span className="text-[11px] font-semibold whitespace-nowrap opacity-80">
                      {count} item
                    </span>
                  </span>
                  <span className="font-bold text-sm whitespace-nowrap tabular-nums">
                    {formatRupiah(total)}
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function OptionGroupPicker({
  group,
  selected,
  onToggle,
}: {
  group: MenuOptionGroup;
  selected: string[];
  onToggle: (valueId: string) => void;
}) {
  const multiple = group.max_select > 1;
  const hint = multiple
    ? `Pilih sampai ${group.max_select}`
    : group.min_select === 0
    ? "Opsional"
    : "Wajib pilih satu";

  return (
    <fieldset>
      <legend className="flex items-baseline gap-2 mb-2.5 w-full">
        <span className="font-display text-[15px] font-bold" style={{ color: "var(--navy)" }}>
          {group.name}
        </span>
        <span className="text-[11px]" style={{ color: "var(--navy-muted)" }}>
          {hint}
        </span>
      </legend>

      <div className="flex flex-col gap-2">
        {(group.values ?? []).map((value) => {
          const on = selected.includes(value.id_option_value);
          const atLimit = multiple && !on && selected.length >= group.max_select;

          return (
            <label
              key={value.id_option_value}
              className={`press flex items-center gap-3 px-3.5 h-[52px] rounded-2xl ${
                atLimit ? "opacity-45" : "cursor-pointer"
              }`}
              style={{
                background: on ? "var(--orange-blush)" : "var(--white)",
                border: `1.5px solid ${on ? "var(--orange)" : "var(--border)"}`,
              }}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={group.id_option_group}
                checked={on}
                disabled={atLimit}
                onChange={() => onToggle(value.id_option_value)}
                className="sr-only"
              />
              <span
                className={`w-5 h-5 shrink-0 inline-flex items-center justify-center ${
                  multiple ? "rounded-md" : "rounded-full"
                }`}
                style={{
                  background: on ? "var(--orange)" : "transparent",
                  border: on ? "none" : "1.5px solid var(--border)",
                }}
                aria-hidden="true"
              >
                {on && <Check size={13} strokeWidth={3} color="#fff" />}
              </span>

              <span className="flex-1 min-w-0 text-sm font-medium" style={{ color: "var(--navy)" }}>
                {value.name}
              </span>

              {value.price_delta !== 0 && (
                <span
                  className="text-[13px] font-semibold tabular-nums shrink-0"
                  style={{ color: on ? "var(--orange-ink)" : "var(--navy-muted)" }}
                >
                  {value.price_delta > 0 ? "+" : "−"}
                  {formatRupiah(Math.abs(value.price_delta))}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
