"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { XIcon } from "lucide-react";
import { addLineToExistingOrder, type ExistingOrderLine, type PosOrderActionResult } from "@/lib/pos-order-actions";
import type { PosMenu, PosMenuOption } from "@/components/pos/PosBoard";

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

type Props = {
  menu: PosMenu;
  optionGroups: PosMenuOption[];
  order: { id: string; table: string };
  cafeId: string;
  onClose: () => void;
  /** Dipanggil setelah item sukses ditambahkan (di luar tombol close). */
  onDone?: (result: PosOrderActionResult) => void;
};

/** Modal "Item Details" ala template: foto besar + deskripsi + varian + add-ons.
 *  Dipakai POS saat mengetuk item di strip Pesanan Aktif: pilihan langsung
 *  ditambahkan ke pesanan yang sudah dikirim (commit ulang, stok & harga
 *  tetap divalidasi server). */
export default function PosItemModal({ menu, optionGroups, order, cafeId, onClose, onDone }: Props) {
  const groups = optionGroups.filter(g => g.menuId === menu.id);
  const salePrice = Math.round(menu.price * (1 - Math.min(100, Math.max(0, menu.discountPct ?? 0)) / 100));
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [itemNote, setItemNote] = useState("");
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitting = useRef(false);
  function toggle(groupId: string, v: { id: string }) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    setPick(prev => {
      const next = new Set(prev);
      if (next.has(v.id)) next.delete(v.id);
      else {
        const selected = group.values.filter(option => next.has(option.id));
        if (group.maxSelect === 1) selected.forEach(option => next.delete(option.id));
        else if (selected.length >= group.maxSelect) return prev;
        next.add(v.id);
      }
      return next;
    });
    setErr(null);
  }

  function add() {
    const options: ExistingOrderLine["options"] = [];
    for (const g of groups) {
      const pickedIds = g.values.filter(v => pick.has(v.id)).map(v => v.id);
      if (pickedIds.length < g.minSelect) {
        setErr(`Pilih minimal ${g.minSelect} pada “${g.name}”.`);
        return;
      }
      for (const vid of pickedIds) {
        const v = g.values.find(x => x.id === vid);
        if (v) options.push({ id_option_value: v.id, group_name: g.name, name: v.name, price_delta: v.priceDelta });
      }
    }
    const line: ExistingOrderLine = {
      id_menu: menu.id,
      nama_menu: menu.name,
      harga_menu: menu.price,
      qty,
      options,
      note: itemNote.trim() || undefined,
    };
    if (submitting.current) return;
    submitting.current = true;
    startTransition(async () => {
      try {
      const res = await addLineToExistingOrder(cafeId, order.id, [line]);
      if (res.error) {
        setErr(res.error);
        return;
      }
      onDone?.(res);
      onClose();
      } catch { setErr("Koneksi terputus. Coba lagi."); }
      finally { submitting.current = false; }
    });
  }

  return (
    <div className="dp-modal-backdrop" onClick={onClose}>
      <div className="dp-modal dp-item-modal" role="dialog" aria-modal="true" aria-label={`Item Details ${menu.name}`} onClick={e => e.stopPropagation()}>
        <div className="dp-modal-head">
          <h2>Item Details</h2>
          <button type="button" className="pos-line-x" aria-label="Tutup" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="dp-modal-body dp-item-modal-body">
          <div className="dp-item-photo">
            {menu.imageUrl ? (
              <Image src={menu.imageUrl} alt={menu.name} width={640} height={480} sizes="(max-width: 768px) 90vw, 420px" />
            ) : (
              <span className="dp-item-photo-empty" aria-hidden />
            )}
          </div>

          <div className="dp-item-info">
            <h3>{menu.name}</h3>
            <p className="dp-item-desc">{menu.category ?? "Menu andalan kafe."}</p>

            {groups.map(g => (
              <fieldset key={g.id} className="dp-item-section">
                <legend>{g.name}</legend>
                <div className="dp-item-sizes">
                  {g.values.map(v => {
                    const on = pick.has(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={`dp-size-btn${on ? " dp-size-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggle(g.id, v)}
                      >
                        {v.name}
                        {v.priceDelta > 0 && <small>+{rupiah(v.priceDelta)}</small>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {groups.length === 0 && (
              <p className="dp-hint" style={{ marginTop: 12 }}>
                Menu ini tidak punya varian. Langsung tambahkan ke pesanan.
              </p>
            )}

            <div className="dp-item-qty">
              <span>Qty</span>
              <span className="pos-stepper">
                <button type="button" aria-label="Kurangi" onClick={() => setQty(q => Math.max(1, q - 1))}>
                  −
                </button>
                <b>{qty}</b>
                <button type="button" aria-label="Tambah" onClick={() => setQty(q => Math.min(50, q + 1))}>
                  +
                </button>
              </span>
            </div>

            <label className="pos-cart-note" style={{ marginTop: 10 }}>
              Catatan item
              <textarea
                value={itemNote}
                onChange={e => setItemNote(e.target.value)}
                rows={2}
                maxLength={140}
                placeholder="mis. tanpa bawang, saus terpisah"
              />
            </label>

            {err && <p className="pos-msg pos-msg-err">{err}</p>}
          </div>
        </div>

        <div className="dp-modal-foot">
          <span className="dp-item-total">{rupiah((salePrice + [...pick.values()].reduce((s, vid) => {
            const g = groups.find(x => x.values.some(v => v.id === vid));
            return s + (g?.values.find(v => v.id === vid)?.priceDelta ?? 0);
          }, 0)) * qty)}</span>
          <button type="button" className="pos-btn pos-btn-primary" disabled={pending} onClick={add}>
            {pending ? "Menambah…" : "Tambah ke Pesanan"}
          </button>
        </div>
      </div>
    </div>
  );
}
