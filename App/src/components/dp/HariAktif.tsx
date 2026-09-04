"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { EASE } from "@/components/dp/motion-dp";
import { rupiahRingkas } from "@/lib/dashboard-format";

export type BarisHari = { label: string; nilai: number; pesanan: number };

/** Hari paling ramai — tujuh batang, satu per hari-minggu.
 *
 *  Hanya hari puncak yang berwarna: peringkat dibaca dari tinggi, warna cuma
 *  menunjuk pemenangnya. Label nilai pun hanya muncul di puncak, karena tujuh
 *  angka melayang di atas tujuh batang adalah tabel yang menyamar jadi grafik.
 *
 *  Satu pemicu untuk seluruh grafik, di wadahnya. Memasang `whileInView` di
 *  tiap batang tidak bekerja: keadaan awalnya `scaleY(0)`, dan kotak seluas
 *  nol tidak pernah memenuhi ambang IntersectionObserver mana pun.
 */
const varBatang: Variants = {
  diam: { scaleY: 0, opacity: 0.4 },
  masuk: (i: number) => ({
    scaleY: 1,
    opacity: 1,
    transition: { duration: 0.6, ease: EASE, delay: 0.12 + i * 0.05 },
  }),
};

const varTag: Variants = {
  diam: { opacity: 0, y: 4 },
  masuk: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE, delay: 0.75 } },
};

export default function HariAktif({ baris }: { baris: BarisHari[] }) {
  const diam = useReducedMotion();
  const maks = Math.max(...baris.map((b) => b.nilai), 0);

  if (maks === 0) {
    return (
      <p className="dv3-annot" style={{ padding: "var(--dv3-s3) 0" }}>
        Belum ada penjualan lunas untuk dibandingkan antar-hari. Batang ini terisi begitu pesanan pertama dibayar.
      </p>
    );
  }

  const puncak = baris.reduce((b, x, i) => (x.nilai > baris[b].nilai ? i : b), 0);

  return (
    <motion.div
      className="an-days"
      role="img"
      aria-label={`Hari paling ramai: ${baris[puncak].label}, ${rupiahRingkas(baris[puncak].nilai)}`}
      initial={diam ? false : "diam"}
      whileInView="masuk"
      viewport={{ once: true, amount: 0.3 }}
    >
      {baris.map((b, i) => {
        const rasio = b.nilai / maks;
        // Lantai 6% supaya hari nol tetap punya jejak yang bisa disandingkan,
        // tanpa berpura-pura ia punya nilai.
        const tinggi = `${Math.max(rasio * 100, 6)}%`;
        const aktif = i === puncak;
        return (
          <div key={b.label} className={`an-day${aktif ? " is-on" : ""}`}>
            <span className="an-day-tagrow">
              {aktif && (
                <motion.span className="an-day-tag" variants={varTag}>
                  {rupiahRingkas(b.nilai)}
                </motion.span>
              )}
            </span>

            <span className="an-day-slot">
              <motion.span
                className="an-day-bar"
                aria-hidden
                style={{ height: tinggi }}
                custom={i}
                variants={varBatang}
              />
            </span>

            <span className="an-day-lab">{b.label}</span>
          </div>
        );
      })}
    </motion.div>
  );
}
