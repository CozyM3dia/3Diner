"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/format";
import {
  describePayment,
  STATUS_TEXT,
  summarizeItems,
  type OrderRowV2,
} from "@/lib/dashboard-v2-orders";
import OrderDetailSheet from "@/components/dashboard-v2/OrderDetailSheet";

interface Props {
  rows: OrderRowV2[];
  /** Ringkasan dirender di dalam wadah gulir, sama seperti tabel stok:
   *  di luar, lebar minimumnya membuat badan halaman menggulir ke samping. */
  footer?: React.ReactNode;
  cafeName: string;
  cafeAddress?: string | null;
  taxConfigured: boolean;
}

/** Tabel riwayat pesanan.
 *
 *  Baris adalah objek yang bisa dibuka; kolomnya hanya memuat yang dibutuhkan
 *  untuk MEMILIH baris, bukan untuk mengerjakannya. Semua yang lebih rinci ada
 *  di lapis 2. */
export default function OrdersTable({ rows, footer, cafeName, cafeAddress, taxConfigured }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? rows.find((r) => r.id_order === openId) ?? null : null;

  return (
    <>
      <div className="dv2-table" role="table" aria-label="Riwayat pesanan">
        <div className="dv2-row dv2-row-head" role="row">
          <span className="dv2-col-id">Pesanan</span>
          <span className="dv2-col-items">Item</span>
          <span className="dv2-col-time">Waktu</span>
          <span className="dv2-col-status">Status</span>
          <span className="dv2-col-pay">Pembayaran</span>
          <span className="dv2-col-total">Rp</span>
          <span className="dv2-col-act" />
        </div>

        {rows.map((o) => (
          <div className="dv2-row" role="row" key={o.id_order}>
            <span className="dv2-col-id">{o.table_number || "Tanpa meja"}</span>
            <span className="dv2-col-items" title={summarizeItems(o.items)}>
              {summarizeItems(o.items)}
            </span>
            <span className="dv2-col-time">
              {new Date(o.created_at).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="dv2-col-status">{STATUS_TEXT[o.status]}</span>
            <span className="dv2-col-pay">{describePayment(o.payment_method, o.payment_status)}</span>
            <span className="dv2-col-total">{formatRupiah(o.total)}</span>
            <span className="dv2-col-act">
              <button className="dv2-btn" onClick={() => setOpenId(o.id_order)}>
                Buka
              </button>
            </span>
          </div>
        ))}
        {footer}
      </div>

      {open && (
        <OrderDetailSheet
          order={open}
          cafeName={cafeName}
          cafeAddress={cafeAddress}
          taxConfigured={taxConfigured}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
