"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MinusIcon, PlusIcon, ShoppingCartIcon, XIcon } from "lucide-react";
import type { PosMenu, PosMenuOption } from "@/components/pos/PosBoard";
import type { SelectedOption } from "@/types";

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

type AddonPick = { id_option_value: string; group_name: string; name: string; price_delta: number };

type Props = {
  menu: PosMenu;
  optionGroups: PosMenuOption[];
  /** Jumlah awal — diwarisi dari stepper kartu menu di papan POS. */
  initialQty?: number;
  /** Panggilan balik: serahkan baris lengkap ke keranjang POS. */
  onAdd: (line: { menu: PosMenu; qty: number; options: SelectedOption[]; note: string }) => void;
  onClose: () => void;
};

/** Modal "Item Details" POS — recreation 1:1 modal Chicken Taco Dream POS:
 *  kartu putih 2 kolom (foto kiri dalam bingkai lembut, konfigurasi kanan),
 *  chip Sizes, kartu Add-ons & Upgrades ber-thumbnail bulat, footer
 *  Total + qty stepper + tombol primer dengan ikon keranjang.
 *  Tanpa tombol X di header — tutup lewat overlay/Escape (sesuai referensi). */

export default function PosItemDetails({ menu, optionGroups, initialQty = 1, onAdd, onClose }: Props) {
  const groups = useMemo(() => optionGroups.filter(g => g.menuId === menu.id), [optionGroups, menu.id]);
  const sizesGroup = groups[0] ?? null;
  const addonGroups = groups.slice(1);

  const [sizeId, setSizeId] = useState<string | null>(
    // Referensi: tidak ada chip terpreselect — kasir memilih sendiri.
    // (min_select >= 1 divalidasi saat submit, bukan diakali diam-diam.)
    (sizesGroup?.minSelect ?? 0) >= 1 ? null : sizesGroup?.values[0]?.id ?? null,
  );
  const [addons, setAddons] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(Math.min(99, Math.max(1, Math.round(initialQty))));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Escape menutup; fokus masuk modal agar pengguna keyboard tidak hilang.
  useEffect(() => {
    shellRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const deltaSize = sizeId ? sizesGroup?.values.find(v => v.id === sizeId)?.priceDelta ?? 0 : 0;
  const deltaAddons = [...addons].reduce((s, id) => {
    for (const g of addonGroups) {
      const v = g.values.find(x => x.id === id);
      if (v) return s + v.priceDelta;
    }
    return s;
  }, 0);
  const sale = menu.discountPct != null && menu.discountPct > 0
    ? Math.round(menu.price * (1 - Math.min(menu.discountPct, 100) / 100))
    : menu.price;
  const unit = sale + deltaSize + deltaAddons;
  const total = unit * qty;

  function toggleAddon(id: string) {
    setAddons(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErr(null);
  }

  function submit() {
    // Wajib pilih: semua grup dengan minSelect >= 1 harus terpenuhi.
    for (const g of groups) {
      const pickedCount =
        g === sizesGroup
          ? (sizeId ? 1 : 0)
          : addonGroups.reduce((s, ag) => s + ([...addons].some(id => ag.values.some(v => v.id === id)) ? 1 : 0), 0);
      if (pickedCount < g.minSelect) {
        setErr(`Pilih minimal ${g.minSelect} pada “${g.name}”.`);
        return;
      }
      if (pickedCount > g.maxSelect && g.maxSelect > 0) {
        setErr(`Maksimal ${g.maxSelect} pada “${g.name}”.`);
        return;
      }
    }
    const options: AddonPick[] = [];
    if (sizeId && sizesGroup) {
      const v = sizesGroup.values.find(x => x.id === sizeId);
      if (v) options.push({ id_option_value: v.id, group_name: sizesGroup.name, name: v.name, price_delta: v.priceDelta });
    }
    for (const id of addons) {
      for (const g of addonGroups) {
        const v = g.values.find(x => x.id === id);
        if (v) options.push({ id_option_value: v.id, group_name: g.name, name: v.name, price_delta: v.priceDelta });
      }
    }
    onAdd({ menu, qty, options, note: note.trim() });
  }

  return (
    <div className="pos-id-backdrop" onClick={onClose} role="presentation">
      <div
        ref={shellRef}
        className="pos-id"
        role="dialog"
        aria-modal="true"
        aria-label={`Item Details ${menu.name}`}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Kiri: foto dalam bingkai lembut ── */}
        <div className="pos-id-photo">
          {menu.imageUrl ? (
            <Image
              src={menu.imageUrl}
              alt={menu.name}
              width={640}
              height={480}
              sizes="(max-width: 768px) 90vw, 340px"
              className="pos-id-img"
              priority
            />
          ) : (
            <span className="pos-id-img pos-id-img-empty" aria-hidden />
          )}
        </div>

        {/* ── Kanan: nama, deskripsi, Sizes, Add-ons ── */}
        <div className="pos-id-info">
          <div className="pos-id-titlebar">
            <h3 className="pos-id-title">{menu.name}</h3>
            {/* Referensi tak menampilkan X; kami tetap sediakan via Esc + klik
                luar — plus satu close kecil samar demi aksesibilitas. */}
            <button type="button" className="pos-id-x" aria-label="Tutup" onClick={onClose}>
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="pos-id-desc">
            {menu.description?.trim() || `Menu ${menu.category ?? "andalan"} — disajikan fresh setiap hari.`}
          </p>

          {sizesGroup && (
            <section className="pos-id-section">
              <h4 className="pos-id-sectitle">{sizesGroup.name}</h4>
              <div className="pos-id-sizes">
                {sizesGroup.values.map(v => {
                  const on = sizeId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`pos-id-size${on ? " pos-id-size-on" : ""}`}
                      aria-pressed={on}
                      onClick={() => { setSizeId(v.id); setErr(null); }}
                    >
                      {v.name}
                      <b>{v.priceDelta > 0 ? `+${rupiah(v.priceDelta)}` : rupiah(menu.price)}</b>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {addonGroups.length > 0 && (
            <section className="pos-id-section">
              <h4 className="pos-id-sectitle">Add-ons &amp; Upgrades</h4>
              <div className="pos-id-addons">
                {addonGroups.flatMap(g =>
                  g.values.map(v => {
                    const on = addons.has(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={`pos-id-addon${on ? " pos-id-addon-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggleAddon(v.id)}
                      >
                        <span className="pos-id-addon-thumb">
                          {menu.imageUrl ? (
                            <Image src={menu.imageUrl} alt="" width={40} height={40} sizes="40px" />
                          ) : (
                            <span className="pos-id-addon-thumb-empty" aria-hidden>
                              <PlusIcon className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                        <span className="pos-id-addon-txt">
                          <b>{v.name}</b>
                          <small>{v.priceDelta > 0 ? `+ ${rupiah(v.priceDelta)}` : "Gratis"}</small>
                        </span>
                        <span className={`pos-id-addon-check${on ? " pos-id-addon-check-on" : ""}`} aria-hidden>
                          {on ? "✓" : ""}
                        </span>
                      </button>
                    );
                  }),
                )}
              </div>
            </section>
          )}

          {groups.length === 0 && (
            <p className="pos-id-hint">
              Menu ini tidak punya varian maupun add-on — langsung atur jumlah dan tambahkan.
            </p>
          )}

          {menu.discountPct != null && menu.discountPct > 0 && (
            <p className="pos-id-disc">
              Diskon {menu.discountPct}% diterapkan ({rupiah(menu.price)} → {rupiah(sale)})
            </p>
          )}

          <label className="pos-id-note">
            Catatan
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="mis. tanpa bawang, saus terpisah"
              maxLength={140}
            />
          </label>

          {err && <p className="pos-id-err" role="alert">{err}</p>}
        </div>

        {/* ── Footer: Total + qty + CTA ── */}
        <div className="pos-id-foot">
          <div className="pos-id-totalrow">
            <span className="pos-id-totalLbl">Total</span>
            <b className="pos-id-total">{rupiah(total)}</b>
          </div>
          <div className="pos-id-actions">
            <span className="pos-id-qty" aria-label="Jumlah">
              <button type="button" aria-label="Kurangi" onClick={() => setQty(q => Math.max(1, q - 1))}>
                <MinusIcon className="h-3.5 w-3.5" />
              </button>
              <b>{qty}</b>
              <button type="button" aria-label="Tambah" onClick={() => setQty(q => Math.min(99, q + 1))}>
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </span>
            <button type="button" className="pos-id-add" onClick={submit}>
              <ShoppingCartIcon className="h-4 w-4" aria-hidden /> Tambah ke Keranjang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
