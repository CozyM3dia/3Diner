"use client";

import { DownloadIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { unduhCsv } from "@/components/dp/TransaksiTable";
import type { OrderRow, TitikHari } from "@/lib/dashboard-metrics";

/** Tombol Ekspor di kepala lembar.
 *
 *  Melakukan pekerjaan sungguhan — berkasnya dirakit dari rentang yang sedang
 *  dipilih, bukan tombol pajangan. Jalur unduhnya satu (`unduhCsv`), dipakai
 *  bersama tabel transaksi di lembar Penjualan, jadi kedua unduhan tidak
 *  pernah berbeda isi maupun perilaku.
 *
 *  BATAS YANG DISENGAJA: bagian harian memuat seluruh rentang, tetapi bagian
 *  transaksi memuat 8 pesanan lunas terbaru — `Metrik.transaksi` memang
 *  dipotong di server untuk tabel, dan mengirim seluruh pesanan rentang ke
 *  peramban hanya demi tombol ini akan menggandakan muatan setiap lembar.
 *  Judul tombol menyebut batas itu supaya berkasnya tidak dikira lengkap. */
export default function EksporBtn({
  harian,
  transaksi,
  namaBerkas,
}: {
  harian: TitikHari[];
  transaksi: OrderRow[];
  namaBerkas: string;
}) {
  const diam = useReducedMotion();

  return (
    <motion.button
      type="button"
      className="an-btn"
      title={`Unduh CSV: deret harian rentang ini + ${transaksi.length} transaksi lunas terbaru`}
      onClick={() => unduhCsv(harian, transaksi, namaBerkas)}
      whileHover={diam ? undefined : { y: -1 }}
      whileTap={diam ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <DownloadIcon aria-hidden />
      Ekspor
    </motion.button>
  );
}
