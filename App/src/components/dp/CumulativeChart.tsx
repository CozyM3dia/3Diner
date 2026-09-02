"use client";

import { useId, useState } from "react";
import type { TitikKumulatif } from "@/lib/dashboard-metrics";
import { rupiah, rupiahBertanda, rupiahRingkas } from "@/lib/dashboard-format";
import { pathMonoton, type Pt } from "@/lib/path-monotone";

/** Laju periode: total berjalan periode ini vs periode pembanding.
 *
 *  Inilah satu-satunya garis di konsol, dan ia sah: kumulatif memang
 *  kontinu — nilai hari ke-5 memuat hari ke-4. Garis harian dilarang
 *  (DESIGN.md), garis kumulatif justru menjawab pertanyaan yang tak bisa
 *  dijawab batang: "sampai hari ini, kami di depan atau di belakang?"
 *
 *  Pembanding digambar putus-putus dan diperpanjang sampai akhir rentang —
 *  ia sudah selesai. Garis periode ini berhenti di hari terakhir yang sudah
 *  lewat; celah di kanannya adalah hari yang belum tiba, ditandai dengan
 *  arsir supaya tak terbaca sebagai penjualan yang mendatar.
 *
 *  Estetika sama dengan sparkline hero: area gradien + kurva monoton +
 *  titik aksen di ujung (tanpa clip-reveal — plot interaktif butuh hit area).
 */
export default function CumulativeChart({ titik, labelBanding }: { titik: TitikKumulatif[]; labelBanding: string }) {
  const [aktif, setAktif] = useState<number | null>(null);
  const idTip = useId();
  const uid = useId().replace(/:/g, "");

  const n = titik.length;
  const max = Math.max(...titik.map((t) => Math.max(t.kini, t.lalu)), 1);
  const nyata = titik.filter((t) => !t.masaDepan);
  const iAkhir = nyata.length - 1;

  const W = 100;
  const H = 100;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const y = (v: number) => H - (v / max) * H;

  const ptsKini: Pt[] = nyata.map((_, i) => ({ x: x(i), y: y(nyata[i].kini) }));
  const ptsLalu: Pt[] = titik.map((t, i) => ({ x: x(i), y: y(t.lalu) }));

  const pathKini = ptsKini.length > 1 ? pathMonoton(ptsKini) : "";
  const pathLalu = ptsLalu.length > 1 ? pathMonoton(ptsLalu) : "";
  const area =
    pathKini && iAkhir >= 0
      ? `${pathKini} L${ptsKini[iAkhir].x.toFixed(2)} ${H} L${ptsKini[0].x.toFixed(2)} ${H} Z`
      : "";

  const akhir = nyata[iAkhir];
  const selisih = akhir ? akhir.kini - akhir.lalu : 0;
  const t = aktif === null ? null : titik[aktif];
  const setiap = n <= 8 ? 1 : Math.ceil(n / 6);

  return (
    <div className="dv3-cum">
      <div className="dv3-chart-meta">
        <div className="dv3-legend">
          <span className="dv3-legend-item">
            <span className="dv3-key dv3-key-now" aria-hidden />
            Periode ini
          </span>
          <span className="dv3-legend-item">
            <span className="dv3-key dv3-key-dash" aria-hidden />
            {labelBanding}
          </span>
        </div>
        {akhir && (
          <p className={`dv3-annot ${selisih > 0 ? "dv3-delta-up" : selisih < 0 ? "dv3-delta-down" : "dv3-delta-flat"}`}>
            {selisih === 0
              ? "Sejajar dengan laju periode lalu"
              : `${rupiahBertanda(selisih)} ${selisih > 0 ? "di depan" : "di belakang"} laju periode lalu, per ${akhir.label}`}
          </p>
        )}
      </div>

      <div className="dv3-plot dv3-plot-cum" onPointerLeave={() => setAktif(null)}>
        <div className="dv3-plot-axis" aria-hidden>
          <span>{rupiahRingkas(max)}</span>
          <span>{rupiahRingkas(max / 2)}</span>
          <span>0</span>
        </div>

        <div className="dv3-plot-area dv3-cum-area">
          {/* Hari yang belum tiba: arsir tipis, bukan kosong. */}
          {nyata.length < n && (
            <span
              className="dv3-cum-future"
              aria-hidden
              style={{ left: `${x(Math.max(iAkhir, 0))}%` }}
            />
          )}

          <svg className="dv3-cum-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable="false">
            <defs>
              <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="dv3-spark-stop-top" />
                <stop offset="100%" className="dv3-spark-stop-bot" />
              </linearGradient>
            </defs>
            {area && <path className="dv3-cum-fill" d={area} fill={`url(#${uid}-fill)`} />}
            {pathLalu && <path className="dv3-cum-prev" d={pathLalu} />}
            {pathKini && <path className="dv3-cum-now" d={pathKini} />}
            {akhir && iAkhir >= 0 && (
              <g className="dv3-cum-end">
                <path
                  className="dv3-spark-dot-ring"
                  d={`M${ptsKini[iAkhir].x.toFixed(2)} ${ptsKini[iAkhir].y.toFixed(2)} l0.001 0`}
                />
                <path
                  className="dv3-spark-dot"
                  d={`M${ptsKini[iAkhir].x.toFixed(2)} ${ptsKini[iAkhir].y.toFixed(2)} l0.001 0`}
                />
              </g>
            )}
          </svg>

          {t && (
            <span className="dv3-cum-cursor" aria-hidden style={{ left: `${x(aktif!)}%` }}>
              {!t.masaDepan && <i className="dv3-cum-pt-now" style={{ top: `${y(t.kini)}%` }} />}
              <i className="dv3-cum-pt-prev" style={{ top: `${y(t.lalu)}%` }} />
            </span>
          )}

          {/* Kolom tak terlihat, satu per hari, supaya nilainya terjangkau
              papan tik dan jari — bukan hanya penunjuk yang presisi. */}
          <div className="dv3-cum-hit">
            {titik.map((d, i) => (
              <button
                key={d.iso}
                type="button"
                className="dv3-cum-col"
                aria-describedby={aktif === i ? idTip : undefined}
                aria-label={
                  d.masaDepan
                    ? `${d.label}: belum tiba, pembanding ${rupiah(d.lalu)}`
                    : `${d.label}: kumulatif ${rupiah(d.kini)}, pembanding ${rupiah(d.lalu)}`
                }
                onPointerEnter={() => setAktif(i)}
                onFocus={() => setAktif(i)}
                onBlur={() => setAktif(null)}
              />
            ))}
          </div>

          {t && (
            <div
              id={idTip}
              role="status"
              className={`dv3-tip${aktif! > n / 2 ? " dv3-tip-left" : ""}`}
              style={{ left: `${x(aktif!)}%`, bottom: "auto", top: 0 }}
            >
              <span className="dv3-tip-day">{t.label}{t.masaDepan ? " · belum tiba" : ""}</span>
              {!t.masaDepan && (
                <span className="dv3-tip-row">
                  <span className="dv3-key dv3-key-now" aria-hidden />
                  <b className="dv3-num">{rupiah(t.kini)}</b>
                </span>
              )}
              <span className="dv3-tip-row">
                <span className="dv3-key dv3-key-prev" aria-hidden />
                <b className="dv3-num">{rupiah(t.lalu)}</b>
              </span>
              {!t.masaDepan && (
                <span className={`dv3-tip-delta ${t.kini - t.lalu >= 0 ? "is-up" : "is-down"}`}>
                  {rupiahBertanda(t.kini - t.lalu)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="dv3-bars-axis dv3-cum-axis" aria-hidden>
          {titik.map((d, i) => (
            <span key={d.iso}>{i % setiap === 0 || i === n - 1 ? d.label : ""}</span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Pendapatan kumulatif per hari, dibanding periode sebelumnya</caption>
        <thead>
          <tr>
            <th scope="col">Hari</th>
            <th scope="col">Periode ini</th>
            <th scope="col">Sebelumnya</th>
          </tr>
        </thead>
        <tbody>
          {titik.map((d) => (
            <tr key={d.iso}>
              <th scope="row">{d.label}</th>
              <td>{d.masaDepan ? "belum tiba" : rupiah(d.kini)}</td>
              <td>{rupiah(d.lalu)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
