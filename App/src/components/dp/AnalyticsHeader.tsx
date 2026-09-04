import DashboardDatePicker from "@/components/dp/DashboardDatePicker";
import Petunjuk from "@/components/dp/Petunjuk";
import AnalyticsTabs from "@/components/dp/AnalyticsTabs";
import EksporBtn from "@/components/dp/EksporBtn";
import { Naik } from "@/components/dp/motion-dp";
import { parseDay, addDays, type PresetKey } from "@/lib/date-range";
import type { OrderRow, TitikHari } from "@/lib/dashboard-metrics";
import { fmtTanggal } from "@/lib/dashboard-format";

/** Kepala bersama dua halaman analitik.
 *
 *  Dua "lembar" dari satu laporan: Ringkasan (bagaimana kafe berjalan dan
 *  apa yang perlu disentuh) dan Penjualan (dari mana uang datang, kapan,
 *  lewat apa). Tab berpindah halaman tetapi membawa rentang tanggal yang
 *  sama, jadi angka di kedua lembar selalu berbicara tentang periode yang
 *  sama — pemilih rentang duduk di sini, bukan di masing-masing halaman.
 *
 *  Susunannya bilah dasbor: judul di kiri, seluruh kontrol dalam satu baris
 *  di kanan. Rentangnya sudah tercetak di tombol pemilih, jadi ia tidak
 *  diulang lagi sebagai teks di bawah judul.
 */
export type LembarAnalitik = "ringkasan" | "penjualan";

const LEMBAR: { key: LembarAnalitik; label: string; href: string }[] = [
  { key: "ringkasan", label: "Ringkasan", href: "/dashboard-v2" },
  { key: "penjualan", label: "Penjualan", href: "/dashboard-v2/penjualan" },
];

export function labelPembanding(fromIso: string, spanDays: number): string {
  const dari = addDays(parseDay(fromIso), -spanDays);
  const sampai = addDays(parseDay(fromIso), -1);
  return `${fmtTanggal.format(dari)} – ${fmtTanggal.format(sampai)}`;
}

export default function AnalyticsHeader({
  aktif,
  fromIso,
  toIso,
  preset,
  spanDays,
  judul,
  ringkasan,
  hrefBase,
  harian,
  transaksi,
}: {
  aktif: LembarAnalitik;
  fromIso: string;
  toIso: string;
  preset: PresetKey;
  spanDays: number;
  judul: string;
  /** Satu kalimat yang merangkum lembar ini. */
  ringkasan: string;
  /** Dipakai harness dev-preview; produksi memakai rute konsol. */
  hrefBase?: Record<LembarAnalitik, string>;
  /** Isi berkas Ekspor — deret harian + transaksi lunas rentang ini. */
  harian: TitikHari[];
  transaksi: OrderRow[];
}) {
  const q = `?from=${fromIso}&to=${toIso}`;
  const lembar = LEMBAR.map((l) => ({
    ...l,
    href: `${hrefBase?.[l.key] ?? l.href}${hrefBase ? "" : q}`,
  }));

  return (
    <Naik className="an-head">
      <div className="an-head-text">
        <h1 className="an-head-title">{judul}</h1>
        <p className="an-head-sum">{ringkasan}</p>
      </div>

      <div className="an-head-ctrl">
        <AnalyticsTabs lembar={lembar} aktif={aktif} />

        <span className="an-range">
          <DashboardDatePicker from={fromIso} to={toIso} activePreset={preset} />
          <span className="an-range-note">
            vs {labelPembanding(fromIso, spanDays)}
            <Petunjuk judul="Periode pembanding" bab="rentang" align="end">
              Setiap delta di lembar ini diukur terhadap rentang setara panjang tepat sebelum yang dipilih, jadi
              rentang 3 hari dibandingkan dengan 3 hari sebelumnya. Rentangnya ikut tersimpan di URL, jadi tautan
              yang Anda bagikan membuka periode yang sama.
            </Petunjuk>
          </span>
        </span>

        <EksporBtn harian={harian} transaksi={transaksi} namaBerkas={`${aktif}-${fromIso}_${toIso}.csv`} />
      </div>
    </Naik>
  );
}
