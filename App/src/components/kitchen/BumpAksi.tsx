"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, LoaderIcon, PlayIcon, Undo2Icon, UtensilsIcon } from "lucide-react";
import type { Tahap } from "@/lib/kitchen-model";

/** Jeda sebelum perintah terminal benar-benar dikirim. */
const JEDA_MS = 4000;

const IKON: Record<Tahap, typeof PlayIcon> = {
  tahan: PlayIcon,
  antre: PlayIcon,
  masak: UtensilsIcon,
  siap: CheckIcon,
};

interface Props {
  tahap: Tahap;
  label: string;
  /** Aksi ini mengeluarkan tiket dari papan. */
  terminal: boolean;
  sibuk: boolean;
  onJalan: () => void;
}

/** Tombol tunggal di kaki tiket.
 *
 *  Aksi tak-terminal dikirim seketika: tiketnya tetap di papan, jadi salah
 *  tekan langsung terlihat dan tinggal dilanjutkan.
 *
 *  Aksi terminal ditahan dulu. Riset KDS menyebut salah-bump sebagai kesalahan
 *  yang paling sering dan paling mahal, dan solusi lazimnya adalah "urungkan"
 *  setelah perintah terkirim. Di sini itu tidak bisa: `advance_order_status`
 *  tidak punya transisi pulang dari `completed`, jadi tidak ada yang tersisa
 *  untuk diurungkan. Jeda ini memindahkan kesempatan batal ke SEBELUM
 *  penulisan — satu-satunya tempat di mana ia masih nyata. */
export default function BumpAksi({ tahap, label, terminal, sibuk, onJalan }: Props) {
  const [bersiap, setBersiap] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const batalkan = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setBersiap(false);
  };

  const tekan = () => {
    if (sibuk) return;
    if (!terminal) {
      onJalan();
      return;
    }
    if (bersiap) {
      batalkan();
      return;
    }
    setBersiap(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setBersiap(false);
      onJalan();
    }, JEDA_MS);
  };

  const Ikon = IKON[tahap];

  return (
    <button
      type="button"
      className="kds-bump"
      data-bersiap={bersiap || undefined}
      disabled={sibuk}
      onClick={tekan}
      aria-label={bersiap ? `Batalkan ${label.toLowerCase()}` : label}
    >
      {bersiap && <span className="kds-bump-mundur" style={{ "--jeda": `${JEDA_MS}ms` } as React.CSSProperties} />}
      <span className="kds-bump-label">
        {sibuk ? (
          <>
            <LoaderIcon className="h-[18px] w-[18px] animate-spin" aria-hidden />
            Menyimpan
          </>
        ) : bersiap ? (
          <>
            <Undo2Icon className="h-[18px] w-[18px]" aria-hidden />
            Ketuk lagi untuk batal
          </>
        ) : (
          <>
            <Ikon className="h-[18px] w-[18px]" aria-hidden />
            {label}
          </>
        )}
      </span>
    </button>
  );
}
