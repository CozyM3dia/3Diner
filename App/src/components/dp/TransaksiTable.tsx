"use client";

import { DownloadIcon } from "lucide-react";
import type { OrderRow, TitikHari } from "@/lib/dashboard-metrics";
import { LABEL_METODE } from "@/lib/dashboard-metrics";
import { fmtHariTanggal, fmtJam, rupiah } from "@/lib/dashboard-format";

/** Transaksi lunas terbaru sebagai tabel — untuk presisi, bukan bentuk.
 *  Tombol Unduh CSV melakukan pekerjaan sungguhan: deret harian dan
 *  transaksi rentang ini dirakit di klien dan diunduh — bukan tombol pajangan
 *  seperti "Export" pada template lama. */

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buatCsv(harian: TitikHari[], transaksi: OrderRow[]): string {
  const baris: string[] = [];
  baris.push("Bagian;Hari;Pendapatan lunas;Pesanan;Pendapatan periode lalu;Pesanan periode lalu");
  for (const h of harian) {
    baris.push(["Harian", h.iso, h.value, h.orders, h.valuePrev, h.ordersPrev].map(csvEscape).join(";"));
  }
  baris.push("");
  baris.push("Bagian;Waktu;Meja;Item;Metode;Total;Status");
  for (const o of transaksi) {
    const item = (o.items ?? []).map((it) => `${it.qty ?? 1}× ${it.nama_menu ?? "Menu"}`).join(", ");
    baris.push(
      ["Transaksi", o.created_at, o.table_number ?? "Tamu", item, LABEL_METODE[o.payment_method ?? ""] ?? o.payment_method ?? "", o.total ?? 0, o.status ?? ""]
        .map(csvEscape)
        .join(";"),
    );
  }
  return baris.join("\n");
}

export default function TransaksiTable({
  transaksi,
  harian,
  namaBerkas,
}: {
  transaksi: OrderRow[];
  harian: TitikHari[];
  namaBerkas: string;
}) {
  function unduh() {
    // BOM supaya Excel Indonesia membaca UTF-8 dan pemisah titik koma.
    const blob = new Blob(["\ufeff" + buatCsv(harian, transaksi)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = namaBerkas;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="dv3-chart-bar">
        <span className="dv3-panel-note">Pesanan lunas terbaru dalam rentang</span>
        <button type="button" className="dv3-seg-btn dv3-seg-solo" onClick={unduh}>
          <DownloadIcon aria-hidden />
          Unduh CSV
        </button>
      </div>
      {transaksi.length === 0 ? (
        <p className="dv3-annot dv3-mix-empty">Belum ada transaksi lunas pada rentang ini.</p>
      ) : (
        <div className="dv3-tablewrap">
          <table className="dv3-table dv3-table-tx">
            <caption className="sr-only">Transaksi lunas terbaru</caption>
            <thead>
              <tr>
                <th scope="col">Waktu</th>
                <th scope="col" className="dv3-tx-left">Meja</th>
                <th scope="col" className="dv3-tx-left dv3-tx-items">Item</th>
                <th scope="col" className="dv3-tx-left">Metode</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {transaksi.map((o) => {
                const d = new Date(o.created_at);
                const items = o.items ?? [];
                const qty = items.reduce((s, it) => s + (it.qty ?? 1), 0);
                const nama = items.slice(0, 2).map((it) => it.nama_menu ?? "Menu").join(", ");
                return (
                  <tr key={o.id_order}>
                    <th scope="row">
                      <span className="dv3-tx-day">{fmtHariTanggal.format(d)}</span>
                      <span className="dv3-tx-time dv3-num">{fmtJam.format(d)}</span>
                    </th>
                    <td className="dv3-tx-left">{o.table_number ? `Meja ${o.table_number}` : "Tamu"}</td>
                    <td className="dv3-tx-left dv3-tx-items">
                      <span className="dv3-tx-qty dv3-num">{qty} item</span>
                      <span className="dv3-tx-names">{nama}{items.length > 2 ? `, +${items.length - 2}` : ""}</span>
                    </td>
                    <td className="dv3-tx-left">
                      <span className="dv3-pill dv3-pill-wait">{LABEL_METODE[o.payment_method ?? ""] ?? "Lainnya"}</span>
                    </td>
                    <td className="dv3-num dv3-tx-total">{rupiah(o.total ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
