"use client";

import { useEffect, useRef, useState } from "react";
import { formatRupiah } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { buildReceiptHtml, printReceipt } from "@/lib/receipt-html";
import { formatAge, minutesSince, needsCash } from "@/lib/kasir-queue-rules";
import type { KasirOrder } from "@/components/kasir/KasirQueue";

interface Props {
  order: KasirOrder;
  cafeName: string;
  cafeAddress?: string | null;
  /** Preferensi Pengaturan Struk — diteruskan apa adanya ke builder. */
  receiptSettings?: Record<string, unknown> | null;
  /** Nama staf — baris "Kasir" di struk (bila toggle menyala). */
  staffName?: string;
  taxConfigured?: boolean;
  onClose: () => void;
  onAccept: () => void;
  onComplete: () => void;
  onCash: () => void;
  onCancel: () => void;
  busy?: boolean;
}

/** Lapis 2 — tempat pesanan DIKERJAKAN.
 *
 *  Lapis 1 hanya untuk memilih baris mana yang disentuh; semua yang dipotong di
 *  sana ada di sini utuh: rincian per item, varian, catatan penuh, dan rincian
 *  pembayaran. Tidak ada fitur yang hilang — hanya pindah lapis. */
export default function KasirOrderSheet({
  order,
  cafeName,
  cafeAddress,
  receiptSettings,
  staffName,
  taxConfigured,
  onClose,
  onAccept,
  onComplete,
  onCash,
  onCancel,
  busy,
}: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnTo = useRef<Element | null>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    returnTo.current = document.activeElement;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const el = returnTo.current;
      if (el instanceof HTMLElement) requestAnimationFrame(() => el.focus());
    };
  }, [onClose]);

  // Lembar ini hanya muncul setelah diketuk, jadi ia selalu dirender di klien —
  // tidak ada jam server yang bisa berbeda satu menit dan memicu hydration
  // mismatch seperti di baris antrean.
  // eslint-disable-next-line react-hooks/purity -- client-only (lihat atas): umur dipotret sekali saat render, bukan timer berjalan
  const waited = formatAge(minutesSince(order.created_at, Date.now()));
  const cash = needsCash(order);
  const subtotal = order.subtotal ?? order.total;

  function print() {
    printReceipt(
      buildReceiptHtml(order, {
        name: cafeName,
        address: cafeAddress,
        taxConfigured,
        cashierName: staffName,
        receipt: receiptSettings ?? null,
      })
    );
    setPrinted(true);
  }

  return (
    <div className="kasir-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="kasir-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kasir-sheet-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="kasir-sheet-bar">
          <h2 id="kasir-sheet-title" className="kasir-sheet-title">
            {order.table_number || "Tanpa meja"}
          </h2>
          <span className="kasir-sub">
            masuk{" "}
            {new Date(order.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · QR meja · menunggu {waited}
          </span>
          <button ref={closeRef} className="kasir-btn kasir-push" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="kasir-sheet-body">
          <div className="kasir-ghd">
            <span>
              Item <b>{order.items.length}</b>
            </span>
          </div>
          {order.items.map((it, i) => (
            <div className="kasir-line" key={`${it.id_menu}-${i}`}>
              <span className="kasir-line-qty">{it.qty}×</span>
              <span className="kasir-line-name">
                {it.nama_menu}
                {it.options?.length ? (
                  <span className="kasir-sub"> · {it.options.map((o) => o.name).join(", ")}</span>
                ) : null}
                {it.notes ? <span className="kasir-line-note"> · “{it.notes}”</span> : null}
              </span>
              <span className="kasir-line-price">{formatRupiah(it.harga_menu * it.qty)}</span>
            </div>
          ))}

          {order.notes && (
            <>
              <div className="kasir-ghd">
                <span>Catatan pelanggan</span>
              </div>
              <p className="kasir-note-block">{order.notes}</p>
            </>
          )}

          <div className="kasir-ghd">
            <span>Pembayaran</span>
          </div>
          <div className="kasir-line">
            <span className="kasir-line-name">Subtotal</span>
            <span className="kasir-line-price">{formatRupiah(subtotal)}</span>
          </div>
          {(order.service_amount ?? 0) > 0 && (
            <div className="kasir-line">
              <span className="kasir-line-name">Layanan {order.service_pct ?? 0}%</span>
              <span className="kasir-line-price">{formatRupiah(order.service_amount ?? 0)}</span>
            </div>
          )}
          {/* Baris pajak selalu ada, termasuk saat nol. Struk yang diam soal
              pajak membuat nol yang belum diputuskan tidak bisa dibedakan dari
              nol yang dipilih. */}
          <div className="kasir-line">
            <span className="kasir-line-name">
              Pajak {order.tax_pct ?? 0}%
              {taxConfigured === false ? <span className="kasir-sub"> · belum diatur pemilik</span> : null}
            </span>
            <span className="kasir-line-price">{formatRupiah(order.tax_amount ?? 0)}</span>
          </div>
          <div className="kasir-line kasir-line-total">
            <span className="kasir-line-name">Total</span>
            <span className="kasir-line-price">{formatRupiah(order.total)}</span>
          </div>
          <div className="kasir-line">
            <span className="kasir-line-name">Status</span>
            <span className="kasir-line-price kasir-sub">
              {order.payment_status === "paid"
                ? `Sudah bayar · ${paymentMethodLabel(order.payment_method)}`
                : order.payment_method && order.payment_method !== "cash"
                  ? `Menunggu ${paymentMethodLabel(order.payment_method)}`
                  : "Belum bayar"}
            </span>
          </div>
        </div>

        <div className="kasir-sheet-foot">
          <button className="kasir-btn" onClick={onCancel} disabled={busy}>
            Batalkan pesanan
          </button>
          <span className="kasir-sheet-foot-right">
            <button className="kasir-btn" onClick={print}>
              {printed ? "Cetak ulang" : "Cetak struk"}
            </button>
            {order.status === "received" ? (
              <button className="kasir-btn kasir-btn-solid" onClick={onAccept} disabled={busy}>
                Terima pesanan
              </button>
            ) : cash ? (
              <button className="kasir-btn kasir-btn-solid" onClick={onCash} disabled={busy}>
                Terima tunai
              </button>
            ) : (
              <button className="kasir-btn kasir-btn-solid" onClick={onComplete} disabled={busy}>
                Selesai
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
