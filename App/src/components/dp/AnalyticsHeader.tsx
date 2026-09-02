import Link from "next/link";
import DashboardDatePicker from "@/components/dp/DashboardDatePicker";
import Petunjuk from "@/components/dp/Petunjuk";
import { parseDay, addDays, type PresetKey } from "@/lib/date-range";
import { fmtTanggal, fmtTanggalPanjang } from "@/lib/dashboard-format";

/** Kepala bersama dua halaman analitik.
 *
 *  Dua "lembar" dari satu laporan: Ringkasan (bagaimana kafe berjalan dan
 *  apa yang perlu disentuh) dan Penjualan (dari mana uang datang, kapan,
 *  lewat apa). Tab berpindah halaman tetapi membawa rentang tanggal yang
 *  sama, jadi angka di kedua lembar selalu berbicara tentang periode yang
 *  sama — pemilih rentang duduk di sini, bukan di masing-masing halaman.
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
  kicker,
  judul,
  ringkasan,
  hrefBase,
}: {
  aktif: LembarAnalitik;
  fromIso: string;
  toIso: string;
  preset: PresetKey;
  spanDays: number;
  /** Baris kecil di atas judul — kalimat, bukan label. */
  kicker: string;
  judul: string;
  /** Satu kalimat yang merangkum lembar ini. */
  ringkasan: string;
  /** Dipakai harness dev-preview; produksi memakai rute konsol. */
  hrefBase?: Record<LembarAnalitik, string>;
}) {
  const q = `?from=${fromIso}&to=${toIso}`;
  const rentang =
    fromIso === toIso
      ? fmtTanggalPanjang.format(parseDay(fromIso))
      : `${fmtTanggal.format(parseDay(fromIso))} – ${fmtTanggalPanjang.format(parseDay(toIso))}`;

  return (
    <header className="dv3-ah">
      <div className="dv3-ah-text">
        <p className="dv3-kicker">
          {kicker} · <span className="dv3-num">{spanDays}</span> hari · {rentang}
        </p>
        <h1 className="dv3-ah-title">{judul}</h1>
        <p className="dv3-ah-sum">{ringkasan}</p>
      </div>

      <div className="dv3-ah-ctrl">
        <nav className="dv3-tabs" aria-label="Lembar analitik">
          {LEMBAR.map((l) => (
            <Link
              key={l.key}
              href={`${hrefBase?.[l.key] ?? l.href}${hrefBase ? "" : q}` as never}
              className={`dv3-tab${l.key === aktif ? " is-on" : ""}`}
              aria-current={l.key === aktif ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="dv3-ah-range">
          <DashboardDatePicker from={fromIso} to={toIso} activePreset={preset} />
          <span className="dv3-ah-note">
            <span className="dv3-panel-note">Dibanding {labelPembanding(fromIso, spanDays)}</span>
            <Petunjuk judul="Periode pembanding" bab="rentang" align="end">
              Setiap delta di lembar ini diukur terhadap rentang setara panjang tepat sebelum yang dipilih, jadi
              rentang 3 hari dibandingkan dengan 3 hari sebelumnya. Rentangnya ikut tersimpan di URL, jadi tautan
              yang Anda bagikan membuka periode yang sama.
            </Petunjuk>
          </span>
        </div>
      </div>
    </header>
  );
}
