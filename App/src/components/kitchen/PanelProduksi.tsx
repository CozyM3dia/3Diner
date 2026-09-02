"use client";

import { TAHAP, URUTAN_TAHAP, type BarisProduksi } from "@/lib/kitchen-model";

/** Pandangan "Semua Item": papan yang sama dibaca sebagai daftar produksi.
 *
 *  Grid tiket menjawab "meja mana yang menunggu". Ini menjawab pertanyaan lain
 *  yang sama seringnya ditanyakan di jam sibuk dan tidak bisa dijawab grid:
 *  "berapa banyak Nasi Goreng yang harus saya buat sekarang". Sembilan tiket
 *  yang masing-masing memesan satu adalah satu wajan berisi sembilan — dan
 *  membacanya dari grid berarti menghitung manual sambil memegang spatula. */
export default function PanelProduksi({ baris }: { baris: BarisProduksi[] }) {
  return (
    <div className="kds-produksi">
      {baris.map(b => (
        <div key={b.kunci} className="kds-produksi-baris">
          <div className="kds-produksi-total">{b.total}</div>

          <div>
            <div className="kds-produksi-nama">{b.nama}</div>
            {b.varian && <div className="kds-produksi-varian">{b.varian}</div>}
            {b.catatan && <div className="kds-produksi-catatan">{b.catatan}</div>}
          </div>

          <div className="kds-pecahan">
            {URUTAN_TAHAP.filter(t => b.perTahap[t] > 0).map(t => (
              <span key={t} data-tahap={t} title={TAHAP[t].arti}>
                <i aria-hidden />
                {TAHAP[t].label} <b>{b.perTahap[t]}</b>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
