"use client";

import {
  BanknoteIcon,
  MinusIcon,
  MousePointerClickIcon,
  ReceiptTextIcon,
  ScaleIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UtensilsIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AngkaHidup, EASE, varAnak } from "@/components/dp/motion-dp";
import type { Delta } from "@/lib/dashboard-metrics";

/** Kartu KPI — satu angka, satu delta, satu pembanding.
 *
 *  Ikonnya dikirim sebagai kunci, bukan elemen: kartu ini komponen klien dan
 *  lembar yang memakainya komponen server, jadi elemen React tidak bisa
 *  menyeberang batas itu dengan aman. Kunci → komponen dipetakan di sini.
 */
const IKON = {
  pesanan: ReceiptTextIcon,
  rata: ScaleIcon,
  buka: MousePointerClickIcon,
  konversi: TargetIcon,
  uang: BanknoteIcon,
  item: UtensilsIcon,
} as const;

export type KunciIkon = keyof typeof IKON;

/** Pil delta. Nol pembanding tidak pernah dipaksa jadi persentase — "+100%"
 *  dan "∞" sama-sama mengarang basis yang tak ada. */
export function PilDelta({ delta, satuan }: { delta: Delta; satuan: string }) {
  if (delta.pct === null) {
    return (
      <span className="an-pill" data-arah="flat">
        {delta.arah === "up" ? "Tanpa pembanding" : `Belum ada ${satuan}`}
      </span>
    );
  }
  const Ikon = delta.arah === "up" ? TrendingUpIcon : delta.arah === "down" ? TrendingDownIcon : MinusIcon;
  return (
    <span className="an-pill" data-arah={delta.arah}>
      <Ikon aria-hidden />
      {delta.pct > 0 ? "+" : ""}
      {delta.pct.toFixed(1)}%
    </span>
  );
}

export default function KpiKartu({
  label,
  ikon,
  tone = "netral",
  nilai,
  bentuk = "bulat",
  nilaiTeks,
  delta,
  satuan,
  catatan,
}: {
  label: string;
  ikon: KunciIkon;
  tone?: "netral" | "accent" | "ok" | "navy";
  /** Angka yang dihitung naik. Diabaikan bila `nilaiTeks` diisi. */
  nilai?: number;
  bentuk?: "rupiah" | "bulat" | "persen";
  /** Dipakai saat angkanya tidak ada ("—"), supaya tidak menghitung ke nol. */
  nilaiTeks?: string;
  delta?: Delta;
  satuan?: string;
  catatan: string;
}) {
  const diam = useReducedMotion();
  const Ikon = IKON[ikon];

  return (
    <motion.article
      className="an-kpi"
      variants={varAnak}
      whileHover={diam ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <div className="an-kpi-top">
        <span className="an-kpi-label">{label}</span>
        <span className="an-kpi-icon" data-tone={tone === "netral" ? undefined : tone} aria-hidden>
          <Ikon />
        </span>
      </div>

      <div className="an-kpi-fig">
        {nilaiTeks !== undefined ? (
          <span className="an-kpi-val">{nilaiTeks}</span>
        ) : (
          <AngkaHidup className="an-kpi-val" nilai={nilai ?? 0} bentuk={bentuk} tunda={0.12} />
        )}
        {/* Hanya delta yang benar-benar berupa persentase yang jadi pil.
            Saat pembandingnya nol, PilDelta menulis kalimat ("Tanpa
            pembanding") — pil selebar itu memaksa baris figur membungkus,
            dan isinya sudah diulang kata demi kata di baris catatan. */}
        {delta && delta.pct !== null && <PilDelta delta={delta} satuan={satuan ?? "data"} />}
      </div>

      <motion.p
        className="an-kpi-note"
        initial={diam ? false : { opacity: 0 }}
        whileInView={diam ? undefined : { opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.35 }}
      >
        {catatan}
      </motion.p>
    </motion.article>
  );
}
