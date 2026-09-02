"use client";

import { useId, useState, type CSSProperties } from "react";
import type { JamRamai } from "@/lib/dashboard-metrics";
import { NAMA_HARI } from "@/lib/dashboard-metrics";
import { jamLabel, rupiah } from "@/lib/dashboard-format";

/** Jam ramai — matriks hari-minggu × jam.
 *
 *  Grafik paling berguna untuk operasional kafe (Lightspeed menyebutnya
 *  "Hourly Performance"): kapan kasir dan dapur harus penuh, kapan boleh
 *  tipis. Intensitas dibaca dari lightness satu hue (navy), bukan pelangi —
 *  satu skala berurut adalah satu-satunya pemetaan warna yang mata baca
 *  sebagai "lebih/kurang". Sel puncak diberi aksen: satu marka, bukan
 *  pewarnaan.
 *
 *  Kolom jam dipangkas ke jam buka efektif (dengan sedikit margin) supaya
 *  matriks tidak dipenuhi 10 kolom malam yang selalu kosong. Bila rentang
 *  lebih pendek dari satu minggu, baris hari-minggu menyesatkan (hanya satu
 *  Sabtu yang diwakili), jadi ia runtuh menjadi profil 24 jam.
 */
export type MetrikJam = "nilai" | "pesanan";

const DAYPART: { label: string; dari: number; sampai: number }[] = [
  { label: "Dini hari", dari: 0, sampai: 5 },
  { label: "Pagi", dari: 5, sampai: 11 },
  { label: "Siang", dari: 11, sampai: 15 },
  { label: "Sore", dari: 15, sampai: 18 },
  { label: "Malam", dari: 18, sampai: 24 },
];

/** Sel matriks (punya `hari`) atau slot profil 24 jam (tanpa `hari`). */
type Sel = { hari?: number; jam: number; nilai: number; pesanan: number };

export default function HeatmapJam({ jam, spanDays }: { jam: JamRamai; spanDays: number }) {
  const [metrik, setMetrik] = useState<MetrikJam>("nilai");
  const [aktif, setAktif] = useState<Sel | null>(null);
  const idTip = useId();

  const nilaiDari = (s: Sel) => (metrik === "nilai" ? s.nilai : s.pesanan);
  const baca = (s: Sel) => (metrik === "nilai" ? rupiah(s.nilai) : `${s.pesanan} pesanan`);

  // Jam buka efektif + margin satu jam di tiap sisi, dibulatkan ke rentang
  // minimal 08–21 supaya kafe yang sepi tidak menghasilkan matriks tiga kolom.
  const [jMin, jMax] = jam.rentangJam ?? [8, 21];
  const dari = Math.max(0, Math.min(jMin - 1, 8));
  const sampai = Math.min(23, Math.max(jMax + 1, 21));
  const kolom = Array.from({ length: sampai - dari + 1 }, (_, i) => dari + i);

  const matriks = spanDays >= 7;
  const sumber: Sel[] = (matriks ? (jam.sel as Sel[]) : (jam.profil as Sel[])).filter(
    (s) => s.jam >= dari && s.jam <= sampai,
  );
  const max = Math.max(...sumber.map(nilaiDari), 1);
  const puncak = sumber.reduce<Sel | null>((b, s) => (nilaiDari(s) > (b ? nilaiDari(b) : 0) ? s : b), null);
  const adaPuncak = (s: Sel) => !!puncak && nilaiDari(puncak) > 0 && puncak.jam === s.jam && puncak.hari === s.hari;

  const dayparts = DAYPART.filter((d) => d.sampai > dari && d.dari <= sampai).map((d) => {
    const a = Math.max(d.dari, dari);
    const b = Math.min(d.sampai - 1, sampai);
    return { ...d, span: b - a + 1 };
  });

  return (
    <div className="dv3-heat" onPointerLeave={() => setAktif(null)}>
      <div className="dv3-chart-bar">
        <div className="dv3-seg" role="group" aria-label="Metrik jam ramai">
          <button type="button" className={`dv3-seg-btn${metrik === "nilai" ? " is-on" : ""}`} aria-pressed={metrik === "nilai"} onClick={() => setMetrik("nilai")}>
            Pendapatan
          </button>
          <button type="button" className={`dv3-seg-btn${metrik === "pesanan" ? " is-on" : ""}`} aria-pressed={metrik === "pesanan"} onClick={() => setMetrik("pesanan")}>
            Pesanan
          </button>
        </div>
        <span className="dv3-heat-scale" aria-hidden>
          <span>Sepi</span>
          <i />
          <span>Ramai</span>
        </span>
      </div>

      <div
        className={`dv3-heat-grid${matriks ? "" : " dv3-heat-flat"}`}
        style={{ "--cols": kolom.length } as CSSProperties}
        role="group"
        aria-label={matriks ? "Pendapatan per hari-minggu dan jam" : "Pendapatan per jam"}
      >
        {/* Penggaris bagian hari — Pagi/Siang/Sore/Malam — memberi kata
            untuk kolom angka; owner berpikir dalam "jam makan siang", bukan
            "12.00–14.00". */}
        <span className="dv3-heat-corner" aria-hidden />
        <div className="dv3-heat-dayparts" aria-hidden>
          {dayparts.map((d) => (
            <span key={d.label} style={{ gridColumn: `span ${d.span}` }}>
              {d.span >= 2 ? d.label : ""}
            </span>
          ))}
        </div>

        {(matriks ? NAMA_HARI.map((_, h) => h) : [0]).map((hari) => (
          <div key={hari} className="contents">
            <span className="dv3-heat-row-label" aria-hidden>
              {matriks ? NAMA_HARI[hari] : "Semua"}
            </span>
            {kolom.map((h) => {
              const s: Sel = matriks ? jam.sel[hari * 24 + h] : jam.profil[h];
              const v = nilaiDari(s);
              const t = v / max;
              const isOn = aktif === s;
              return (
                <button
                  key={h}
                  type="button"
                  className="dv3-heat-cell"
                  style={{ "--t": t.toFixed(3), "--col": h - dari } as CSSProperties}
                  data-zero={v === 0 ? "true" : undefined}
                  data-peak={adaPuncak(s) ? "true" : undefined}
                  data-on={isOn ? "true" : undefined}
                  aria-describedby={isOn ? idTip : undefined}
                  aria-label={`${matriks ? `${NAMA_HARI[hari]} ` : ""}${jamLabel(h)}: ${baca(s)}${metrik === "nilai" && s.pesanan ? `, ${s.pesanan} pesanan` : ""}`}
                  onPointerEnter={() => setAktif(s)}
                  onFocus={() => setAktif(s)}
                  onBlur={() => setAktif(null)}
                />
              );
            })}
          </div>
        ))}

        <span className="dv3-heat-corner" aria-hidden />
        <div className="dv3-heat-hours" aria-hidden>
          {kolom.map((h) => (
            <span key={h}>{(h - dari) % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>
          ))}
        </div>
      </div>

      {aktif && (
        <p id={idTip} role="status" className="dv3-heat-read">
          <b>
            {aktif.hari !== undefined ? `${NAMA_HARI[aktif.hari]} · ` : ""}
            {jamLabel(aktif.jam)}–{jamLabel((aktif.jam + 1) % 24)}
          </b>
          <span className="dv3-num">{baca(aktif)}</span>
          {metrik === "nilai" && aktif.pesanan > 0 && <span>{aktif.pesanan} pesanan</span>}
        </p>
      )}
      {!aktif && puncak && nilaiDari(puncak) > 0 && (
        <p className="dv3-heat-read dv3-annot">
          Puncak {puncak.hari !== undefined ? `${NAMA_HARI[puncak.hari]} ` : ""}
          {jamLabel(puncak.jam)} — {baca(puncak)}
        </p>
      )}
      {!aktif && (!puncak || nilaiDari(puncak) === 0) && (
        <p className="dv3-heat-read dv3-annot">Belum ada penjualan lunas untuk dipetakan.</p>
      )}
    </div>
  );
}
