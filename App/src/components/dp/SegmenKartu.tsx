"use client";

import type { CSSProperties } from "react";
import { BanknoteIcon, CreditCardIcon, QrCodeIcon, WalletIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AngkaHidup, varAnak, varBatang, varWadah } from "@/components/dp/motion-dp";
import type { IrisanMix } from "@/lib/dashboard-metrics";
import { rupiah } from "@/lib/dashboard-format";

/** Tiga segmen berdampingan — berapa banyak uang masuk lewat tiap jalur.
 *
 *  Bukan donat: pangsa dibaca dari panjang batang di bawah tiap kolom, dan
 *  angkanya berdiri sendiri sebagai jumlah, bukan sebagai potongan lingkaran
 *  yang harus ditaksir sudutnya.
 *
 *  Pemicu gerak duduk di wadahnya, bukan di tiap batang: batang mulai dari
 *  lebar nol, dan elemen seluas nol tidak pernah memicu IntersectionObserver.
 */
const IKON: Record<string, typeof WalletIcon> = {
  cash: BanknoteIcon,
  qris: QrCodeIcon,
  gopay: WalletIcon,
  shopeepay: WalletIcon,
  bank_transfer: CreditCardIcon,
};

/* Warna seri, bukan pelangi: aksen untuk yang terbesar, navy lalu abu untuk
   sisanya — urutan yang sama dengan panel peringkat di lembar Penjualan. */
const WARNA = ["var(--dv3-series-1)", "var(--dv3-series-2)", "var(--dv3-series-3)"];

export default function SegmenKartu({ irisan, kosong }: { irisan: IrisanMix[]; kosong: string }) {
  const diam = useReducedMotion();
  const tampil = irisan.slice(0, 3);
  const total = irisan.reduce((s, x) => s + x.nilai, 0);

  if (tampil.length === 0) {
    return <p className="dv3-annot">{kosong}</p>;
  }

  return (
    <motion.div
      className="an-seg"
      variants={varWadah}
      initial={diam ? false : "diam"}
      whileInView="masuk"
      viewport={{ once: true, amount: 0.25 }}
    >
      {tampil.map((x, i) => {
        const Ikon = IKON[x.key] ?? WalletIcon;
        const pangsa = total ? (x.nilai / total) * 100 : 0;
        return (
          <motion.div key={x.key} className="an-seg-col" style={{ "--an-c": WARNA[i] } as CSSProperties} variants={varAnak}>
            <span className="an-seg-top">
              <span className="an-seg-dot" aria-hidden>
                <Ikon />
              </span>
              <AngkaHidup className="an-seg-val" nilai={x.jumlah} tunda={0.2 + i * 0.08} />
            </span>
            <span className="an-seg-label">
              {x.label} · {rupiah(x.nilai)} ({Math.round(pangsa)}%)
            </span>
            <span className="an-seg-track" aria-hidden>
              <motion.i variants={varBatang(Math.max(pangsa, 2), 0.25 + i * 0.08)} />
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
