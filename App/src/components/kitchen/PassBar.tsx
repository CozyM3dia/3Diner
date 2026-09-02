"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  ArrowLeftIcon,
  BellIcon,
  BellOffIcon,
  LayoutGridIcon,
  ListChecksIcon,
  LogOutIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TAHAP, URUTAN_TAHAP, durasi, type Tahap } from "@/lib/kitchen-model";
import { pasangTemaDapur, type TemaDapur } from "@/lib/kitchen-theme";

const clerkTerpasang = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export type Pandangan = "tiket" | "produksi";
export type Rapat = "normal" | "besar";

interface Props {
  namaKafe: string;
  bingkai: "mandiri" | "konsol";
  jumlah: Record<Tahap, number>;
  saring: Set<Tahap>;
  onSaring: (tahap: Tahap) => void;
  kueri: string;
  onKueri: (nilai: string) => void;
  pandangan: Pandangan;
  onPandangan: (nilai: Pandangan) => void;
  rapat: Rapat;
  onRapat: (nilai: Rapat) => void;
  tema: TemaDapur;
  onTema: (nilai: TemaDapur) => void;
  lonceng: boolean;
  onLonceng: (nilai: boolean) => void;
  tersambung: boolean;
  /** Jarak sejak sinkron terakhir, dalam ms. Ditampilkan hanya saat putus. */
  sejakSinkron: number | null;
  sekarang: number | null;
}

/** Bar perintah papan dapur.
 *
 *  Dua tingkat, dan pembagiannya bukan estetika: baris atas berisi hal yang
 *  hampir tidak pernah berubah (nama kafe, jam, sambungan, alat), baris bawah
 *  berisi keadaan pekerjaan yang berubah tiap menit. Menumpuk keduanya jadi
 *  satu baris memaksa mata memindai ulang nama kafe setiap kali sebuah tiket
 *  berpindah tahap. */
export default function PassBar({
  namaKafe,
  bingkai,
  jumlah,
  saring,
  onSaring,
  kueri,
  onKueri,
  pandangan,
  onPandangan,
  rapat,
  onRapat,
  tema,
  onTema,
  lonceng,
  onLonceng,
  tersambung,
  sejakSinkron,
  sekarang,
}: Props) {
  const router = useRouter();
  const clerk = useClerk();

  const jamDinding =
    sekarang === null
      ? "--:--"
      : new Date(sekarang).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  async function keluar() {
    if (clerkTerpasang) {
      await clerk.signOut({ redirectUrl: "/login" });
    } else {
      await createClient().auth.signOut();
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="kds-pass">
      <div className="kds-pass-atas">
        <div className="kds-merek">
          <h1 className="kds-merek-judul">{namaKafe || "Papan Dapur"}</h1>
          <span className="kds-merek-sub">Dapur</span>
        </div>

        <time className="kds-jam" suppressHydrationWarning>
          {jamDinding}
        </time>

        <span
          className="kds-sambungan"
          data-hidup={tersambung}
          title={
            tersambung
              ? "Pesanan baru muncul sendiri"
              : "Papan mungkin tertinggal. Muat ulang halaman kalau berlanjut."
          }
        >
          <i aria-hidden />
          {tersambung ? "Langsung" : `Terputus ${durasi(sejakSinkron)}`}
        </span>

        <label className="kds-cari">
          <SearchIcon className="h-4 w-4" aria-hidden />
          <input
            value={kueri}
            onChange={e => onKueri(e.target.value)}
            placeholder="Cari meja, menu, catatan"
            aria-label="Cari pesanan"
          />
          {kueri && (
            <button type="button" className="kds-cari-hapus" onClick={() => onKueri("")} aria-label="Bersihkan pencarian">
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </label>

        <span className="kds-pemisah" aria-hidden />

        <button
          type="button"
          className="kds-alat"
          aria-pressed={rapat === "besar"}
          onClick={() => onRapat(rapat === "besar" ? "normal" : "besar")}
          aria-label={rapat === "besar" ? "Kembalikan ukuran normal" : "Perbesar untuk monitor dinding"}
          title={rapat === "besar" ? "Ukuran normal" : "Perbesar untuk monitor dinding"}
        >
          {rapat === "besar" ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          className="kds-alat"
          aria-pressed={lonceng}
          onClick={() => onLonceng(!lonceng)}
          aria-label={lonceng ? "Matikan bunyi pesanan baru" : "Bunyikan saat pesanan baru masuk"}
          title={lonceng ? "Bunyi menyala" : "Bunyi mati"}
        >
          {lonceng ? <BellIcon className="h-4 w-4" /> : <BellOffIcon className="h-4 w-4" />}
        </button>

        {bingkai === "mandiri" && (
          <>
            <span className="kds-pemisah" aria-hidden />
            <button
              type="button"
              className="kds-alat"
              onClick={() => {
                const berikut: TemaDapur = tema === "gelap" ? "terang" : "gelap";
                pasangTemaDapur(berikut);
                onTema(berikut);
              }}
              aria-label={tema === "gelap" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            >
              {tema === "gelap" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              className="kds-alat"
              onClick={() => {
                if (window.history.length > 1) router.back();
                else router.push("/dashboard-v2/dapur");
              }}
              aria-label="Kembali"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>

            <button type="button" className="kds-alat" data-bahaya="true" onClick={keluar} aria-label="Keluar">
              <LogOutIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div className="kds-pass-bawah">
        <div className="kds-saring" role="group" aria-label="Saring menurut tahap">
          {URUTAN_TAHAP.map(t => {
            const n = jumlah[t];
            return (
              <button
                key={t}
                type="button"
                className="kds-chip"
                data-tahap={t}
                data-nol={n === 0 || undefined}
                aria-pressed={saring.has(t)}
                onClick={() => onSaring(t)}
                title={TAHAP[t].arti}
              >
                <i className="kds-chip-titik" aria-hidden />
                {TAHAP[t].label}
                <b>{String(n).padStart(2, "0")}</b>
              </button>
            );
          })}
        </div>

        <div className="kds-sakelar" role="group" aria-label="Bentuk tampilan">
          <button type="button" aria-pressed={pandangan === "tiket"} onClick={() => onPandangan("tiket")}>
            <LayoutGridIcon className="mr-1.5 inline h-[15px] w-[15px] align-[-2px]" aria-hidden />
            Tiket
          </button>
          <button type="button" aria-pressed={pandangan === "produksi"} onClick={() => onPandangan("produksi")}>
            <ListChecksIcon className="mr-1.5 inline h-[15px] w-[15px] align-[-2px]" aria-hidden />
            Semua Item
          </button>
        </div>
      </div>
    </div>
  );
}
