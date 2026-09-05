"use client";

import { CheckIcon, LockIcon, StickyNoteIcon, UtensilsIcon, ShoppingBagIcon } from "lucide-react";
import BumpAksi from "@/components/kitchen/BumpAksi";
import {
  TAHAP,
  bakiTarget,
  durasi,
  jamMasuk,
  kodeTiket,
  kunciProduksi,
  labelMeja,
  lajuPanas,
  panasDari,
  ringkasVarian,
  tahapDari,
  umurMs,
  type TiketDapur,
} from "@/lib/kitchen-model";
import type { OrderStatus } from "@/types";

interface Props {
  tiket: TiketDapur;
  sekarang: number | null;
  /** Baris yang sudah ditandai selesai juru masak di perangkat ini. */
  selesai: Set<string>;
  sibuk: boolean;
  pergi: boolean;
  onToggleBaris: (kunci: string) => void;
  onAksi: (id: string, lanjut: OrderStatus) => void;
}

/** Satu tiket dapur.
 *
 *  Susunannya mengikuti urutan baca seorang juru masak yang sedang buru-buru:
 *  siapa (meja) → berapa lama (timer) → apa (item) → apa yang aneh (varian dan
 *  catatan) → apa yang harus saya tekan (satu tombol). Tidak ada yang lain. */
export default function Tiket({
  tiket,
  sekarang,
  selesai,
  sibuk,
  pergi,
  onToggleBaris,
  onAksi,
}: Props) {
  const tahap = tahapDari(tiket.status);
  const umur = umurMs(tiket, sekarang);
  const panas = panasDari(tahap, umur);
  const info = TAHAP[tahap];
  const baki = bakiTarget(umur);
  const belumLunas = tiket.payment_status !== "paid";
  const takeaway = labelMeja(tiket) === "Bawa Pulang";
  const old = umur !== null && umur >= 86400000;

  return (
    <article
      className="kds-tiket"
      data-tahap={tahap}
      data-panas={panas}
      data-pergi={pergi || undefined}
      data-old={old || undefined}
      aria-label={`${labelMeja(tiket)}, ${info.label}, ${durasi(umur)}`}
    >
      <div className="kds-rel" aria-hidden>
        <i style={{ "--isi": lajuPanas(umur) } as React.CSSProperties} />
      </div>

      <div className="kds-tiket-isi">
        <header className="kds-kepala">
          <div>
            <span className="kds-ticket-number">TIKET #{kodeTiket(tiket.id_order)}</span>
            <h3 className="kds-meja">{takeaway ? <ShoppingBagIcon size={18} aria-hidden /> : <UtensilsIcon size={18} aria-hidden />}{labelMeja(tiket)}</h3>
            <p className="kds-jalur">
              <span>{takeaway ? "Bawa pulang" : "Makan di tempat"}</span>
              <span>Masuk {jamMasuk(tiket.created_at, sekarang)}</span>
            </p>
          </div>
          <div className="kds-waktu">
            <span className="kds-timer">{durasi(umur)}</span>
            <span className="kds-baki">
              {old ? "Periksa pesanan lama" : tahap === "tahan" ? "Menunggu kasir" : tahap === "siap"
                ? "Menunggu diantar"
                : baki
                  ? baki.mode === "sisa"
                    ? `Sisa ${baki.menit} mnt`
                    : `Lewat ${baki.menit} mnt`
                  : "\u00a0"}
            </span>
          </div>
        </header>

        <div className="kds-tag-baris">
          <span className="kds-tag kds-tag-tahap">{info.label}</span>
          {belumLunas ? (
            <span className="kds-tag kds-tag-utang">Belum lunas</span>
          ) : (
            <span className="kds-tag kds-tag-netral">Lunas</span>
          )}
        </div>

        <ul className="kds-item-list">
          {tiket.items.map((item, i) => {
            // Indeks ikut ke dalam kunci karena alur POS "tambah item" bisa
            // menambah baris ke pesanan berjalan; tanpa indeks, dua baris menu
            // identik akan saling mencoret.
            const kunci = `${i}|${kunciProduksi(item)}`;
            const varian = ringkasVarian(item.options);
            const qty = Math.max(1, item.qty ?? 1);
            const catatan = item.notes?.trim();
            return (
              <li key={kunci} className="kds-item" data-selesai={selesai.has(kunci) || undefined}>
                <button
                  type="button"
                  className="kds-item-tekan"
                  onClick={() => onToggleBaris(kunci)}
                  aria-pressed={selesai.has(kunci)}
                  aria-label={`${qty} ${item.nama_menu}${varian ? `, ${varian}` : ""}${catatan ? `, catatan ${catatan}` : ""}`}
                >
                  <span className="kds-qty" data-banyak={qty > 1 || undefined}>
                    {qty}
                  </span>
                  <span className="kds-nama">{item.nama_menu || "Item tanpa nama"}</span>
                  <span className="kds-line-check" aria-hidden>{selesai.has(kunci) && <CheckIcon size={12} />}</span>
                  {varian && <span className="kds-varian">{varian}</span>}
                  {catatan && <span className="kds-item-catatan">{catatan}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {tiket.notes?.trim() && (
          <p className="kds-catatan">
            <StickyNoteIcon className="h-4 w-4" aria-hidden />
            {tiket.notes.trim()}
          </p>
        )}

        <div className="kds-kaki">
          {info.aksi && info.lanjut ? (
            <BumpAksi
              tahap={tahap}
              label={info.aksi}
              terminal={info.terminal}
              sibuk={sibuk}
              onJalan={() => onAksi(tiket.id_order, info.lanjut as OrderStatus)}
            />
          ) : (
            <p className="kds-buntu">
              <LockIcon className="h-4 w-4" aria-hidden />
              {info.arti}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
