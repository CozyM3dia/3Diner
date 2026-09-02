import type { TitikKumulatif } from "@/lib/dashboard-metrics";
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

export default function Sparkline({ titik, className = "" }: { titik: TitikKumulatif[]; className?: string }) {
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

  // uid stabil per isi deret — cukup unik dalam satu halaman tanpa "use client".
  const uid = `sp-${titik[0]?.iso ?? "x"}-${n}-${Math.round(max)}`;

  return (
    <svg
      className={`dv3-spark ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
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
  );
}
