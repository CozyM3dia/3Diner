"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Tur pemandu konsol, berbentuk dialog berlangkah ala onboarding.
 *
 *  Kerangkanya Dialog shadcn milik proyek, tetapi tombolnya memakai .pd-btn,
 *  bukan komponen Button: token Tailwind (--popover, --primary, --muted)
 *  tidak mengikuti `html[data-theme="dark"]` yang dipakai konsol, sehingga
 *  Button bawaan akan tetap berpalet terang di kanvas gelap. Panel dan
 *  footernya juga diwarnai ulang lewat .pd-tour-panel di panduan.css.
 *
 *  Kenapa dialog dan bukan langsung halaman panduan: owner yang baru masuk
 *  belum punya pertanyaan, jadi manual sembilan belas bab terbaca sebagai
 *  pekerjaan. Lima layar memberi peta, lalu menyerahkan ke panduan lengkap
 *  begitu pertanyaannya muncul.
 *
 *  Ilustrasinya skematik SVG, bukan foto stok. Yang perlu dikenali pembaca
 *  adalah susunan layar yang akan ia buka semenit lagi, dan foto kafe tidak
 *  mengajarkan letak apa pun.
 */

type Langkah = {
  kicker: string;
  judul: string;
  desc: string;
  art: React.ReactNode;
};

/* Palet skema mengikuti token konsol; tak ada hex baru di file ini. */
const LINE = "var(--dv3-line-strong)";
const INK = "var(--dv3-ink-4)";
const AKSEN = "var(--dv3-accent)";

const LANGKAH: Langkah[] = [
  {
    kicker: "Satu layar, empat grup",
    judul: "Peta konsol",
    desc: "Analitik menjawab bagaimana kafe berjalan. Operasional menjalankan layanan hari ini, Menu mengurus apa yang dijual, dan Pengaturan menyimpan aturannya. Keempatnya tampil sekaligus di sisi kiri.",
    art: (
      <svg viewBox="0 0 320 132" role="img" aria-label="Skema konsol: navigasi kiri, bilah atas, isi halaman">
        <rect x="0.5" y="0.5" width="319" height="131" rx="7" fill="none" stroke={LINE} />
        <line x1="76" y1="1" x2="76" y2="131" stroke={LINE} />
        <line x1="76" y1="26" x2="319" y2="26" stroke={LINE} />
        {[14, 40, 66, 92].map((y, i) => (
          <g key={y}>
            <rect x="12" y={y} width="52" height="6" rx="3" fill={i === 0 ? AKSEN : INK} opacity={i === 0 ? 1 : 0.35} />
            <rect x="12" y={y + 11} width="38" height="4" rx="2" fill={INK} opacity="0.2" />
          </g>
        ))}
        <rect x="90" y="11" width="64" height="6" rx="3" fill={INK} opacity="0.35" />
        <circle cx="296" cy="14" r="6" fill={INK} opacity="0.2" />
        <rect x="90" y="42" width="120" height="10" rx="4" fill={INK} opacity="0.3" />
        <rect x="90" y="62" width="212" height="52" rx="5" fill={INK} opacity="0.08" />
      </svg>
    ),
  },
  {
    kicker: "Dua lembar dari satu laporan",
    judul: "Ringkasan & Penjualan",
    desc: "Ringkasan memberi tahu apa yang perlu disentuh sekarang. Penjualan membedah dari mana uang datang. Keduanya berbagi satu rentang tanggal, jadi menukar tab membawa periodenya ikut.",
    art: (
      <svg viewBox="0 0 320 132" role="img" aria-label="Skema lembar analitik: angka besar dan deret batang harian">
        <rect x="0.5" y="0.5" width="319" height="131" rx="7" fill="none" stroke={LINE} />
        <rect x="18" y="18" width="96" height="14" rx="4" fill={INK} opacity="0.45" />
        <rect x="18" y="40" width="62" height="7" rx="3" fill={INK} opacity="0.2" />
        <line x1="18" y1="112" x2="302" y2="112" stroke={LINE} />
        {[36, 58, 30, 74, 52, 88, 66, 96, 44, 80].map((h, i) => (
          <g key={i}>
            <rect x={140 + i * 17} y={112 - h} width="10" height={h} rx="2" fill={i === 7 ? AKSEN : INK} opacity={i === 7 ? 1 : 0.28} />
            <line x1={139 + i * 17} y1={112 - h * 0.72} x2={152 + i * 17} y2={112 - h * 0.72} stroke={INK} strokeWidth="1.5" opacity="0.55" />
          </g>
        ))}
        <rect x="18" y="62" width="88" height="5" rx="2.5" fill={INK} opacity="0.16" />
        <rect x="18" y="76" width="72" height="5" rx="2.5" fill={INK} opacity="0.16" />
        <rect x="18" y="90" width="80" height="5" rx="2.5" fill={INK} opacity="0.16" />
      </svg>
    ),
  },
  {
    kicker: "Kasir, dapur, lalu papan",
    judul: "Alur layan",
    desc: "POS menerima pesanan dan menutup pembayaran. Dapur menayangkan apa yang sedang dimasak dan menandai yang lewat 30 menit. Pesanan menyimpan keduanya dalam jendela 30 hari, tempat pesanan lama masih bisa dicari dan ditindak.",
    art: (
      <svg viewBox="0 0 320 132" role="img" aria-label="Skema alur: POS ke Dapur ke Pesanan">
        {[
          { x: 8, label: "POS" },
          { x: 116, label: "DAPUR" },
          { x: 224, label: "PESANAN" },
        ].map((k, i) => (
          <g key={k.label}>
            <rect x={k.x + 0.5} y="26.5" width="88" height="80" rx="6" fill="none" stroke={i === 0 ? AKSEN : LINE} />
            <text
              x={k.x + 44}
              y="48"
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              letterSpacing="1"
              fill={i === 0 ? AKSEN : INK}
            >
              {k.label}
            </text>
            <rect x={k.x + 14} y="58" width="60" height="6" rx="3" fill={INK} opacity="0.22" />
            <rect x={k.x + 14} y="70" width="44" height="6" rx="3" fill={INK} opacity="0.22" />
            <rect x={k.x + 14} y="82" width="52" height="6" rx="3" fill={INK} opacity="0.22" />
          </g>
        ))}
        <path d="M100 66 h12 m-4 -4 l4 4 l-4 4" fill="none" stroke={INK} strokeWidth="1.4" />
        <path d="M208 66 h12 m-4 -4 l4 4 l-4 4" fill="none" stroke={INK} strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    kicker: "Dari QR ke model 3D",
    judul: "Menu 3D di atas meja",
    desc: "Unggah model .glb pada sebuah item, cetak QR dari Pengaturan, lalu tamu melihat hidangan dalam 3D sebelum memesan. Setiap langkahnya terhitung di Corong tamu: dipindai, dilihat, dipesan, dibayar.",
    art: (
      <svg viewBox="0 0 320 132" role="img" aria-label="Skema QR di meja menuju model tiga dimensi">
        <rect x="26.5" y="26.5" width="72" height="72" rx="6" fill="none" stroke={LINE} />
        {[
          [36, 36],
          [78, 36],
          [36, 78],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="14" height="14" rx="2" fill="none" stroke={INK} strokeWidth="2" />
          </g>
        ))}
        {[
          [60, 60],
          [72, 60],
          [60, 72],
          [78, 78],
          [66, 84],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" fill={INK} opacity="0.5" />
        ))}
        <path d="M112 62 h28 m-6 -5 l6 5 l-6 5" fill="none" stroke={INK} strokeWidth="1.4" />
        <g transform="translate(196 24)">
          <path d="M44 6 L80 26 L80 66 L44 86 L8 66 L8 26 Z" fill="none" stroke={AKSEN} strokeWidth="1.6" />
          <path d="M44 6 L44 46 L8 26 M44 46 L80 26 M44 46 L44 86" fill="none" stroke={AKSEN} strokeWidth="1.2" opacity="0.55" />
        </g>
      </svg>
    ),
  },
  {
    kicker: "Kalau pertanyaannya muncul nanti",
    judul: "Panduan lengkap",
    desc: "Sembilan belas bab: langkah tiap layar, cara membaca angkanya, dan batas yang sudah diketahui. Bisa dibuka kapan saja dari ikon buku di bilah atas, dan halamannya sudah disiapkan untuk dicetak.",
    art: (
      <svg viewBox="0 0 320 132" role="img" aria-label="Skema halaman panduan: indeks di kiri, bab bernomor di kanan">
        <rect x="0.5" y="0.5" width="319" height="131" rx="7" fill="none" stroke={LINE} />
        <line x1="96" y1="1" x2="96" y2="131" stroke={LINE} />
        {[18, 34, 50, 66, 82, 98].map((y, i) => (
          <rect key={y} x="14" y={y} width={i === 2 ? 56 : 66} height="6" rx="3" fill={i === 2 ? AKSEN : INK} opacity={i === 2 ? 1 : 0.22} />
        ))}
        <text x="112" y="42" fontSize="26" fontWeight="600" fill={INK} opacity="0.35">
          03
        </text>
        <rect x="152" y="20" width="120" height="11" rx="4" fill={INK} opacity="0.42" />
        <rect x="152" y="38" width="150" height="5" rx="2.5" fill={AKSEN} opacity="0.5" />
        <line x1="152" y1="54" x2="302" y2="54" stroke={LINE} />
        {[64, 78, 92, 106].map(y => (
          <rect key={y} x="152" y={y} width={y === 106 ? 96 : 138} height="5" rx="2.5" fill={INK} opacity="0.16" />
        ))}
      </svg>
    ),
  },
];

/** Radix memortalkan konten ke <body>, sementara token --dv3-* hidup di
 *  .dv3-root. Tanpa container ini dialognya kehilangan seluruh paletnya
 *  (dan mode gelapnya) begitu dibuka.
 *
 *  Dibaca saat render, bukan lewat useEffect+setState: portal baru ada
 *  ketika `open` true, dan `open` hanya bisa true setelah klik, jadi
 *  pembacaan DOM ini tak pernah terjadi di server maupun saat hidrasi. */
function wadahKonsol(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.querySelector<HTMLElement>(".dv3-root") ?? undefined;
}

export default function TourDialog({
  hrefPanduan = "/dashboard-v2/panduan",
  trigger,
}: {
  hrefPanduan?: string;
  /** Pemicu pengganti. Bilah atas memakai ikon buku; lembar panduan memakai
   *  tombol berlabel, karena di sana tur adalah tawaran, bukan perkakas. */
  trigger?: React.ReactNode;
}) {
  const [step, setStep] = React.useState(1);
  const [open, setOpen] = React.useState(false);
  const total = LANGKAH.length;
  const isi = LANGKAH[step - 1];

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        // Tur selalu dimulai dari awal: dibuka lagi berarti pertanyaannya
        // berubah, bukan lanjutan sesi yang ditinggal.
        if (next) setStep(1);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <button type="button" className="dv3-iconbtn" aria-label="Tur konsol dan panduan" title="Panduan konsol">
            <BookOpenIcon className="h-[17px] w-[17px]" />
          </button>
        )}
      </DialogTrigger>

      <DialogContent container={open ? wadahKonsol() : undefined} className="pd-tour-panel sm:max-w-[440px]">
        <div className="pd-tour">
          <div className="pd-tour-art" aria-hidden={false}>
            {isi.art}
          </div>

          <DialogHeader>
            <span className="pd-tour-kicker">{isi.kicker}</span>
            <DialogTitle className="pd-tour-title">{isi.judul}</DialogTitle>
            <DialogDescription className="pd-tour-desc">{isi.desc}</DialogDescription>
          </DialogHeader>

          <DialogFooter className="pd-tour-foot max-sm:items-center sm:justify-between">
            <div className="pd-tour-dots" role="status" aria-label={`Langkah ${step} dari ${total}`}>
              {LANGKAH.map((l, i) => (
                <span key={l.judul} className={`pd-tour-dot${i + 1 === step ? " pd-tour-dot-on" : ""}`} aria-hidden />
              ))}
            </div>

            <div className="pd-tour-act">
              {step < total ? (
                <>
                  <DialogClose asChild>
                    <button type="button" className="pd-btn pd-btn-quiet">
                      Lewati
                    </button>
                  </DialogClose>
                  <button type="button" className="pd-btn" onClick={() => setStep(s => Math.min(s + 1, total))}>
                    Lanjut
                    <ArrowRightIcon aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <DialogClose asChild>
                    <button type="button" className="pd-btn pd-btn-quiet">
                      Tutup
                    </button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Link href={hrefPanduan} className="pd-btn">
                      Buka panduan
                      <ArrowRightIcon aria-hidden />
                    </Link>
                  </DialogClose>
                </>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
