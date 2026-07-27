"use client";

import { useEffect, useRef, useState } from "react";
import { formatRupiah } from "@/lib/format";
import { buildReceiptHtml, printReceipt } from "@/lib/receipt-html";
import { describePayment, STATUS_TEXT, type OrderRowV2 } from "@/lib/dashboard-v2-orders";

interface Props {
  order: OrderRowV2;
  cafeName: string;
  cafeAddress?: string | null;
  taxConfigured: boolean;
  onClose: () => void;
}

/** Rincian pesanan di Konsol Owner — dibaca, bukan dikerjakan.
 *
 *  Berbeda dari lembar kasir: pesanan di sini sudah lewat. Yang dibutuhkan
 *  pemilik adalah membacanya kembali dan mencetak ulang struknya, bukan
 *  memajukan statusnya. Aksi kasir sengaja tidak ada supaya layar riwayat tidak
 *  jadi tempat kedua untuk mengerjakan pesanan. */
export default function OrderDetailSheet({
  order,
  cafeName,
  cafeAddress,
  taxConfigured,
  onClose,
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

  const subtotal = order.subtotal ?? order.total;

  return (
    <div className="kasir-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="kasir-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dv2-order-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="kasir-sheet-bar">
          <h2 id="dv2-order-title" className="kasir-sheet-title">
            {order.table_number || "Tanpa meja"}
          </h2>
          <span className="dv2-sub">
            {new Date(order.created_at).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {STATUS_TEXT[order.status]}
          </span>
          <button ref={closeRef} className="dv2-btn kasir-push" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="kasir-sheet-body">
          <div className="dv2-ghd">
            <span>
              Item <b>{order.items?.length ?? 0}</b>
            </span>
          </div>
          {(order.items ?? []).map((it, i) => (
            <div className="kasir-line" key={`${it.id_menu}-${i}`}>
              <span className="kasir-line-qty">{it.qty}×</span>
              <span className="kasir-line-name">
                {it.nama_menu}
                {it.options?.length ? (
                  <span className="dv2-sub"> · {it.options.map((o) => o.name).join(", ")}</span>
                ) : null}
                {it.notes ? <span className="kasir-line-note"> · “{it.notes}”</span> : null}
              </span>
              <span className="kasir-line-price">{formatRupiah(it.harga_menu * it.qty)}</span>
            </div>
          ))}

          {order.notes && (
            <>
              <div className="dv2-ghd">
                <span>Catatan pelanggan</span>
              </div>
              <p className="kasir-note-block">{order.notes}</p>
            </>
          )}

          {order.status === "cancelled" && (
            <>
              <div className="dv2-ghd">
                <span>Alasan pembatalan</span>
              </div>
              {/* Alasan wajib diisi saat membatalkan, jadi ia selalu ada di sini.
                  Pembatalan tanpa jejak yang bisa dibaca sama saja tidak dicatat. */}
              <p className="kasir-note-block">{order.cancelled_reason ?? "—"}</p>
            </>
          )}

          <div className="dv2-ghd">
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
          <div className="kasir-line">
            <span className="kasir-line-name">
              Pajak {order.tax_pct ?? 0}%
              {taxConfigured ? null : <span className="dv2-sub"> · belum diatur saat itu</span>}
            </span>
            <span className="kasir-line-price">{formatRupiah(order.tax_amount ?? 0)}</span>
          </div>
          <div className="kasir-line kasir-line-total">
            <span className="kasir-line-name">Total</span>
            <span className="kasir-line-price">{formatRupiah(order.total)}</span>
          </div>
          <div className="kasir-line">
            <span className="kasir-line-name">Pembayaran</span>
            <span className="kasir-line-price dv2-sub">
              {describePayment(order.payment_method, order.payment_status)}
            </span>
          </div>
        </div>

        <div className="kasir-sheet-foot">
          <span className="dv2-sub">Pesanan yang sudah lewat tidak bisa diubah dari sini.</span>
          <button
            className="dv2-btn dv2-btn-solid"
            onClick={() => {
              printReceipt(
                buildReceiptHtml(order, {
                  name: cafeName,
                  address: cafeAddress,
                  taxConfigured,
                })
              );
              setPrinted(true);
            }}
          >
            {printed ? "Cetak ulang" : "Cetak struk"}
          </button>
        </div>
      </div>
    </div>
  );
}
