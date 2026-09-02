"use client";

import { useState } from "react";
import type { BarisPeringkat } from "@/lib/dashboard-metrics";

/** Daftar berperingkat dengan batang berbagi garis dasar.
 *
 *  Menggantikan donat Category Statistics milik template. Sudut dan luas
 *  adalah atribut preattentive terlemah; panjang yang berbagi garis dasar
 *  paling akurat. Label pangsa (%) tetap menjawab pertanyaan bagian-terhadap-
 *  keseluruhan yang dulu jadi alasan donat itu ada — tanpa memaksa mata
 *  membandingkan juring.
 *
 *  Saklar dasar peringkat bukan hiasan: mengurutkan dengan uang dan dengan
 *  jumlah unit menghasilkan urutan yang berbeda, dan perbedaan itu sendiri
 *  adalah temuan (menu murah yang laris keras vs menu mahal yang sepi tapi
 *  menopang pendapatan).
 */

export type Dasar = "nilai" | "qty";

export default function RankPanel({
  baris,
  labelQty,
  fotoBulat = false,
}: {
  baris: BarisPeringkat[];
  /** Kata untuk satuan qty, mis. "terjual" atau "item terjual". */
  labelQty: string;
  fotoBulat?: boolean;
}) {
  const [dasar, setDasar] = useState<Dasar>("nilai");

  const nilaiDari = (b: BarisPeringkat) => (dasar === "nilai" ? b.nilai : b.qty);
  const urut = [...baris].sort((a, b) => nilaiDari(b) - nilaiDari(a));
  const max = Math.max(...urut.map(nilaiDari), 1);
  const total = urut.reduce((s, b) => s + nilaiDari(b), 0) || 1;

  const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

  return (
    <div>
      <div className="dv3-seg dv3-seg-tight" role="group" aria-label="Dasar peringkat">
        <button
          type="button"
          className={`dv3-seg-btn${dasar === "nilai" ? " is-on" : ""}`}
          aria-pressed={dasar === "nilai"}
          onClick={() => setDasar("nilai")}
        >
          Pendapatan
        </button>
        <button
          type="button"
          className={`dv3-seg-btn${dasar === "qty" ? " is-on" : ""}`}
          aria-pressed={dasar === "qty"}
          onClick={() => setDasar("qty")}
        >
          Jumlah
        </button>
      </div>

      <ol className="dv3-rank">
        {urut.map((b) => {
          const v = nilaiDari(b);
          const pangsa = Math.round((v / total) * 100);
          return (
            <li key={b.id} className="dv3-rank-row">
              {b.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- thumbnail dari storage publik kafe; next/image menyisipkan proxy tanpa manfaat pada ukuran ini
                <img
                  src={b.thumb}
                  alt=""
                  className={`dv3-thumb${fotoBulat ? " dv3-thumb-round" : ""}`}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className={`dv3-thumb${fotoBulat ? " dv3-thumb-round" : ""}`} aria-hidden>
                  {b.nama.slice(0, 1).toUpperCase()}
                </span>
              )}

              <span className="min-w-0">
                <span className="dv3-rank-name">{b.nama}</span>
                <span className="dv3-rank-track">
                  <i style={{ width: `${Math.max((v / max) * 100, 2)}%` }} />
                </span>
              </span>

              <span className="dv3-rank-val">
                <span className="dv3-num">
                  {dasar === "nilai" ? rupiah(b.nilai) : `${b.qty}×`}
                </span>
                <span className="dv3-rank-sub">
                  {pangsa}% ·{" "}
                  {dasar === "nilai" ? `${b.qty} ${labelQty}` : rupiah(b.nilai)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
