"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Transition,
  type Variants,
} from "framer-motion";
import { pisahAngka, teksAngka, type BentukAngka } from "@/lib/dashboard-format";

/** Bahasa gerak lembar analitik.
 *
 *  Satu koreografi, bukan gerakan per komponen: kartu naik 14px dan memudar
 *  masuk saat pertama kali terlihat, berurutan dari kiri-atas; angka besar
 *  berhitung naik dari nol; batang tumbuh dari garis dasarnya. Semua memakai
 *  kurva yang sama (`--dv3-ease` diterjemahkan ke `EASE`) supaya seluruh
 *  halaman terasa satu benda, bukan tujuh animasi yang kebetulan bersamaan.
 *
 *  `useReducedMotion` dihormati di setiap primitif: bukan dipercepat, tetapi
 *  dimatikan — elemen langsung tampil pada keadaan akhirnya. Tanpa itu
 *  pengguna yang sensitif gerak dapat versi cepat dari hal yang sama.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

const TRANSISI: Transition = { duration: 0.5, ease: EASE };

/** Wadah stagger. Anaknya memakai `varAnak`. */
export const varWadah: Variants = {
  diam: {},
  masuk: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

export const varAnak: Variants = {
  diam: { opacity: 0, y: 14 },
  masuk: { opacity: 1, y: 0, transition: TRANSISI },
};

/** Grid/baris yang men-stagger anak-anaknya begitu masuk viewport. */
export function Wadah({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const diam = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={diam ? false : "diam"}
      whileInView="masuk"
      viewport={{ once: true, amount: 0.15 }}
      variants={varWadah}
    >
      {children}
    </motion.div>
  );
}

/** Satu kartu. Di dalam `Wadah` ia ikut stagger; berdiri sendiri ia memakai
 *  `tunda` sebagai jeda manual. Hover mengangkat 2px — cukup untuk terbaca
 *  sebagai permukaan, tidak cukup untuk mengganggu saat menyapu halaman. */
export function Kartu({
  children,
  className = "dv3-panel",
  tunda,
  angkat = true,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Jeda manual (detik) untuk kartu di luar `Wadah`. */
  tunda?: number;
  /** Matikan angkat-saat-hover untuk kartu yang bukan ringkasan. */
  angkat?: boolean;
  "aria-labelledby"?: string;
  "aria-live"?: "polite" | "off" | "assertive";
}) {
  const diam = useReducedMotion();
  const mandiri = tunda !== undefined;

  if (diam) {
    return (
      <section className={className} {...rest}>
        {children}
      </section>
    );
  }

  return (
    <motion.section
      className={className}
      variants={varAnak}
      {...(mandiri
        ? {
            initial: "diam" as const,
            whileInView: "masuk" as const,
            viewport: { once: true, amount: 0.15 },
            transition: { ...TRANSISI, delay: tunda },
          }
        : {})}
      whileHover={angkat ? { y: -2 } : undefined}
      transition={mandiri ? { ...TRANSISI, delay: tunda } : { type: "spring", stiffness: 380, damping: 30 }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

/** Pembungkus non-semantik untuk blok yang bukan kartu (kepala, strip). */
export function Naik({
  children,
  className,
  tunda = 0,
}: {
  children: ReactNode;
  className?: string;
  tunda?: number;
}) {
  const diam = useReducedMotion();
  if (diam) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSISI, delay: tunda }}
    >
      {children}
    </motion.div>
  );
}

/** Angka yang berhitung naik dari nol saat pertama terlihat.
 *
 *  Nilainya tetap ada di DOM sejak render pertama (`format(nilai)` sebagai
 *  isi awal `motion.span` tidak mungkin, jadi dipakai `useTransform`) — dan
 *  untuk pembaca layar angka finalnya diumumkan lewat `aria-label`, bukan
 *  angka setengah jalan yang berubah 60 kali per detik.
 *
 *  Hanya BESARAN yang beranimasi. Imbuhan ("Rp", "%") berdiri sebagai span
 *  sendiri di luar nilai gerak — selain supaya bisa diturunkan ukuran dan
 *  tintanya, ini juga menahan satuan tetap diam sementara angkanya berlari;
 *  satuan yang ikut bergetar membuat seluruh figur terbaca goyah. */
export function AngkaHidup({
  nilai,
  bentuk = "bulat",
  className,
  tunda = 0,
}: {
  nilai: number;
  bentuk?: BentukAngka;
  className?: string;
  tunda?: number;
}) {
  const diam = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const lihat = useInView(ref, { once: true, amount: 0.4 });
  // Nilai awal SENGAJA angka akhirnya, bukan nol: render server tidak punya
  // efek, jadi HTML yang terkirim memuat angka yang benar. Kalau JS gagal
  // atau animasi tak pernah jalan, yang terbaca tetap angka sebenarnya —
  // bukan "Rp 0" yang terlihat seperti fakta.
  const mv = useMotionValue(nilai);
  const teks = useTransform(mv, (v) => pisahAngka(v, bentuk).num);
  const { pre, post } = pisahAngka(nilai, bentuk);
  const akhir = teksAngka(nilai, bentuk);

  // Turun ke nol setelah mount, saat kartunya masih opacity 0 karena
  // koreografi masuk — jadi penurunannya tidak pernah terlihat.
  useEffect(() => {
    if (diam) return;
    mv.set(0);
  }, [diam, mv]);

  useEffect(() => {
    if (diam || !lihat) return;
    const kontrol = animate(mv, nilai, {
      duration: Math.min(1.1, 0.45 + Math.abs(nilai) / 250000),
      ease: EASE,
      delay: tunda,
    });
    return () => kontrol.stop();
  }, [diam, lihat, mv, nilai, tunda]);

  if (diam) {
    return (
      <span ref={ref} className={`an-fig ${className ?? ""}`} aria-label={akhir}>
        {pre && (
          <i className="an-fig-pre" aria-hidden>
            {pre}
          </i>
        )}
        <span aria-hidden>{pisahAngka(nilai, bentuk).num}</span>
        {post && (
          <i className="an-fig-post" aria-hidden>
            {post}
          </i>
        )}
      </span>
    );
  }

  return (
    <span ref={ref} className={`an-fig ${className ?? ""}`} aria-label={akhir}>
      {pre && (
        <i className="an-fig-pre" aria-hidden>
          {pre}
        </i>
      )}
      <motion.span aria-hidden>{teks}</motion.span>
      {post && (
        <i className="an-fig-post" aria-hidden>
          {post}
        </i>
      )}
    </span>
  );
}

/** Batang yang tumbuh dari kiri ke lebar akhirnya.
 *
 *  SENGAJA tidak memakai `whileInView` sendiri: keadaan awalnya lebar nol,
 *  dan IntersectionObserver tidak pernah memenuhi ambang apa pun untuk kotak
 *  seluas nol — batangnya akan tertinggal di lebar nol selamanya. Jadi ia
 *  hanya menyediakan varian, dan induk motion terdekat yang memicunya. */
export function varBatang(lebar: number, tunda: number): Variants {
  return {
    diam: { width: 0 },
    masuk: { width: `${lebar}%`, transition: { duration: 0.85, ease: EASE, delay: tunda } },
  };
}

export { motion };
