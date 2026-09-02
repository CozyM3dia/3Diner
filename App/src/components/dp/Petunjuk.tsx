"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircleIcon } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Petunjuk sebaris: titik kecil di samping judul bagian yang membuka satu
 *  kalimat penjelas.
 *
 *  Kenapa popover klik dan bukan tooltip hover: tooltip tidak punya keadaan
 *  hover di layar sentuh, dan separuh pemakai konsol memegang tablet di
 *  kasir. Klik bekerja di dua-duanya, dan Radix sudah memberi fokus keyboard
 *  serta Escape secara gratis.
 *
 *  Isinya sengaja pendek. Yang butuh paragraf ada di lembar panduan, dan
 *  tiap petunjuk menautkannya lewat `bab` supaya pembaca mendarat di bab
 *  yang tepat, bukan di puncak halaman.
 */

const KUNCI = "dv3-petunjuk-dibuka";

/** Denyut sekali seumur perangkat.
 *
 *  Pemakai baru tidak akan menemukan titik sekecil ini kalau ia diam, tapi
 *  titik yang berdenyut selamanya berubah jadi gangguan. Jadi: berdenyut
 *  sampai petunjuk mana pun dibuka sekali, lalu tenang untuk seterusnya.
 *  Satu bendera dibagi seluruh instans, jadi membuka satu titik menenangkan
 *  semua titik di halaman yang sama.
 *
 *  Nilai awalnya `true` (tenang) supaya server dan hidrasi pertama sepakat;
 *  efek klienlah yang menyalakan denyut kalau perangkat ini memang belum
 *  pernah membukanya. */
const gudang = {
  tenang: true,
  pelanggan: new Set<() => void>(),
  langgan(f: () => void) {
    gudang.pelanggan.add(f);
    return () => {
      gudang.pelanggan.delete(f);
    };
  },
  baca: () => gudang.tenang,
  bacaServer: () => true,
  setel(v: boolean) {
    if (gudang.tenang === v) return;
    gudang.tenang = v;
    for (const f of gudang.pelanggan) f();
  },
};

/** Radix memortalkan konten ke <body>, sementara token --dv3-* hidup di
 *  .dv3-root. Tanpa container ini popovernya kehilangan palet konsol. */
function wadahKonsol(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.querySelector<HTMLElement>(".dv3-root") ?? undefined;
}

export default function Petunjuk({
  judul,
  children,
  bab,
  align = "start",
}: {
  /** Nama bagian yang dijelaskan. Dipakai juga sebagai nama aksesibel. */
  judul: string;
  /** Satu sampai dua kalimat. Lebih dari itu tempatnya di lembar panduan. */
  children: React.ReactNode;
  /** Id bab panduan, mis. "pesanan". Tanpa ini tautan tidak ditampilkan. */
  bab?: string;
  align?: "start" | "center" | "end";
}) {
  const [buka, setBuka] = React.useState(false);
  const tenang = React.useSyncExternalStore(gudang.langgan, gudang.baca, gudang.bacaServer);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem(KUNCI)) gudang.setel(false);
    } catch {
      // Mode privat atau penyimpanan diblokir: petunjuknya tetap jalan,
      // hanya denyut pemakai barunya yang hilang.
    }
  }, []);

  return (
    <Popover
      open={buka}
      onOpenChange={next => {
        setBuka(next);
        if (!next) return;
        gudang.setel(true);
        try {
          localStorage.setItem(KUNCI, "1");
        } catch {
          /* lihat catatan di atas */
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`dv3-hint-btn${tenang ? "" : " dv3-hint-baru"}`}
          aria-label={`Petunjuk: ${judul}`}
        >
          <HelpCircleIcon aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent
        container={buka ? wadahKonsol() : undefined}
        align={align}
        sideOffset={6}
        className="dv3-hint-pop"
      >
        <p className="dv3-hint-judul">{judul}</p>
        <p className="dv3-hint-isi">{children}</p>
        {bab ? (
          <Link href={`/dashboard-v2/panduan#${bab}`} className="dv3-hint-tautan" onClick={() => setBuka(false)}>
            Baca selengkapnya di panduan
          </Link>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
