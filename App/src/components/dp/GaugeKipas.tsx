"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AngkaHidup, EASE } from "@/components/dp/motion-dp";

/** Kipas takaran — satu rasio, dibaca dari berapa banyak sirip yang menyala.
 *
 *  Bukan donat dan bukan busur penuh: sirip diskret lebih mudah ditaksir
 *  daripada sapuan kontinu (mata menghitung, tidak mengukur sudut), dan tidak
 *  berpura-pura punya presisi yang tak dimiliki angkanya.
 *
 *  Geometri: 48 sirip menyapu 240°, dari 210° (kiri-bawah) memutar lewat 90°
 *  (atas) ke -30° (kanan-bawah). Sudut memakai konvensi matematika, jadi y
 *  dibalik saat dipetakan ke SVG.
 *
 *  Pemicu gerak duduk di pembungkusnya, bukan di tiap sirip — dan itu bukan
 *  sekadar hemat: sirip mulai dengan `pathLength: 0`, dan elemen tanpa luas
 *  tidak pernah memenuhi ambang IntersectionObserver.
 */
const SIRIP = 48;
const SUDUT_AWAL = 210;
const SAPUAN = 240;
const CX = 100;
const CY = 104;
const R_LUAR = 90;
const R_DALAM = 64;

/** Node dan mesin JS peramban boleh berbeda satu ULP pada `Math.cos`/`sin`,
 *  dan atribut SVG yang meleset di digit ke-17 sudah cukup untuk membuat React
 *  melaporkan ketidakcocokan hidrasi. Koordinat dibulatkan ke 4 desimal —
 *  jauh di bawah satu piksel pada viewBox 200 — supaya server dan peramban
 *  menulis string yang sama persis. */
const bulat = (n: number) => Math.round(n * 1e4) / 1e4;

const varSirip: Variants = {
  diam: { opacity: 0, pathLength: 0 },
  masuk: (i: number) => ({
    opacity: 1,
    pathLength: 1,
    transition: { duration: 0.4, ease: EASE, delay: 0.15 + i * 0.014 },
  }),
};

export default function GaugeKipas({
  rasio,
  label,
  kosong,
}: {
  /** 0–1. Di luar rentang itu dijepit; angka di tengah tetap yang asli. */
  rasio: number | null;
  label: string;
  kosong: string;
}) {
  const diam = useReducedMotion();

  if (rasio === null) {
    return (
      <p className="dv3-annot" style={{ padding: "var(--dv3-s3) 0" }}>
        {kosong}
      </p>
    );
  }

  const jepit = Math.min(Math.max(rasio, 0), 1);
  const nyala = Math.round(jepit * SIRIP);

  return (
    <div className="an-gauge">
      <motion.div
        className="an-gauge-wrap"
        initial={diam ? false : "diam"}
        whileInView="masuk"
        viewport={{ once: true, amount: 0.3 }}
      >
        <svg viewBox="0 0 200 152" role="img" aria-label={`${label}: ${Math.round(rasio * 100)}%`}>
          {Array.from({ length: SIRIP }, (_, i) => {
            const t = i / (SIRIP - 1);
            const rad = ((SUDUT_AWAL - t * SAPUAN) * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const on = i < nyala;
            return (
              <motion.line
                key={i}
                className="an-gauge-tick"
                x1={bulat(CX + R_DALAM * cos)}
                y1={bulat(CY - R_DALAM * sin)}
                x2={bulat(CX + R_LUAR * cos)}
                y2={bulat(CY - R_LUAR * sin)}
                stroke={on ? "var(--dv3-accent)" : "var(--dv3-line)"}
                strokeWidth={on ? 4 : 3}
                custom={i}
                variants={varSirip}
              />
            );
          })}
        </svg>

        <div className="an-gauge-center">
          <AngkaHidup className="an-gauge-val" nilai={rasio} bentuk="persen" tunda={0.3} />
          <span className="an-gauge-lab">{label}</span>
        </div>
      </motion.div>
    </div>
  );
}
