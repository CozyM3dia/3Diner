"use client";

import { useId, useState } from "react";
import type { TitikKumulatif } from "@/lib/dashboard-metrics";
import { rupiah, rupiahBertanda } from "@/lib/dashboard-format";
import { pathMonoton, type Pt } from "@/lib/path-monotone";

/** Sparkline kumulatif di sisi angka otoritatif — clipped area chart.
 *
 *  Bentuk: area terisi lembut + garis navy + titik oranye di ujung. Reveal
 *  dari kiri (clip) supaya laju terbaca sebagai gerakan, bukan gambar mati.
 *  Deret kumulatif (bukan harian): membandingkan LAJU periode ini vs pembanding
 *  pada posisi hari yang sama. Garis pembanding putus-putus; garis kini
 *  berhenti di hari terakhir yang sudah lewat.
 *
 *  Tanpa sumbu dan tanpa tooltip: ilustrasi bagi angka di sebelahnya. Angka
 *  persis ada di "Laju periode" di halaman Penjualan.
 */

export default function Sparkline({
  titik,
  labelBanding = "Periode sebelumnya",
  className = "",
}: {
  titik: TitikKumulatif[];
  labelBanding?: string;
  className?: string;
}) {
  const [aktif, setAktif] = useState<number | null>(null);
  const idTip = useId();
  const uid = useId().replace(/:/g, "");
  const n = titik.length;
  const max = Math.max(...titik.map((t) => Math.max(t.kini, t.lalu)), 0);
  if (n < 2 || max === 0) return null;

  const W = 240;
  const H = 88;
  const padY = 6;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2);

  const nyata = titik.filter((t) => !t.masaDepan);
  const ptsKini: Pt[] = nyata.map((_, i) => ({ x: x(i), y: y(nyata[i].kini) }));
  const ptsLalu: Pt[] = titik.map((t, i) => ({ x: x(i), y: y(t.lalu) }));

  const pathKini = pathMonoton(ptsKini);
  const pathLalu = pathMonoton(ptsLalu);
  const iAkhir = ptsKini.length - 1;
  const area =
    ptsKini.length > 0
      ? `${pathKini} L${ptsKini[iAkhir].x.toFixed(2)} ${H} L${ptsKini[0].x.toFixed(2)} ${H} Z`
      : "";

  const pctX = (i: number) => (i / (n - 1)) * 100;
  const t = aktif === null ? null : titik[aktif];

  return (
    <div className={`dv3-spark-interactive ${className}`} onPointerLeave={() => setAktif(null)}>
      <svg className="dv3-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="dv3-spark-stop-top" />
          <stop offset="100%" className="dv3-spark-stop-bot" />
        </linearGradient>
      </defs>

      {/* Garis dasar: jangkar visual, bukan sumbu berlabel. */}
      <line className="dv3-spark-base" x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} />

      {pathLalu && <path className="dv3-spark-prev" d={pathLalu} />}

      {area && <path className="dv3-spark-fill" d={area} fill={`url(#${uid}-fill)`} />}
      {pathKini && <path className="dv3-spark-now" d={pathKini} />}

      {/* Titik akhir: goresan nol-panjang + cincin kertas — tetap bundar
          meski SVG di-stretch (non-scaling-stroke). */}
      {ptsKini.length > 0 && (
        <g className="dv3-spark-end">
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
        <span className="dv3-spark-cursor" aria-hidden style={{ left: `${pctX(aktif!)}%` }}>
          {!t.masaDepan && <i className="dv3-spark-cursor-now" style={{ top: `${(y(t.kini) / H) * 100}%` }} />}
          <i className="dv3-spark-cursor-prev" style={{ top: `${(y(t.lalu) / H) * 100}%` }} />
        </span>
      )}

      <div className="dv3-spark-hit">
        {titik.map((d, i) => (
          <button
            key={d.iso}
            type="button"
            className="dv3-spark-col"
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
          className={`dv3-spark-tip${aktif! > n / 2 ? " dv3-spark-tip-left" : ""}`}
          style={{ left: `${pctX(aktif!)}%` }}
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
          <span className="sr-only">{labelBanding}</span>
        </div>
      )}
    </div>
  );
}
