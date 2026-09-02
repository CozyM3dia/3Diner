"use client";

import { useId, useState } from "react";
import { TableIcon, BarChart3Icon } from "lucide-react";
import type { TitikHari } from "@/lib/dashboard-metrics";

/** Grafik pendapatan/pesanan harian.
 *
 *  Bentuk: batang, bukan garis. Garis menarik ruas antara dua hari yang tak
 *  pernah berhubungan, sehingga jeda kosong terbaca sebagai penurunan
 *  bertahap; panjang di atas garis dasar bersama adalah atribut preattentive
 *  paling akurat untuk membandingkan besaran.
 *
 *  Deret kedua (periode pembanding) digambar sebagai batang bergaris tipis di
 *  belakang, bukan batang berdampingan: ia rujukan, bukan sesama subjek. Angka
 *  delta di kepala halaman lahir dari selisih dua deret ini — di sini bentuk
 *  selisihnya per hari akhirnya bisa dilihat, bukan cuma dibaca sebagai persen.
 *
 *  Tooltip menambah, tidak pernah menjadi satu-satunya jalan ke angka: setiap
 *  nilai juga tersedia di tampilan Tabel dan lewat fokus papan tik.
 */

export type Metrik2 = "uang" | "pesanan";

type Props = {
  titik: TitikHari[];
  puncak: number;
  /** Label periode pembanding, mis. "20 Agu – 26 Agu". */
  labelBanding: string;
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/** Ringkas untuk sumbu, tempat presisi penuh jadi derau dan melebarkan kolom. */
function ringkas(n: number, metrik: Metrik2): string {
  if (metrik === "pesanan") return String(Math.round(n));
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} M`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} jt`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(Math.round(n));
}

const penuh = (n: number, metrik: Metrik2) =>
  metrik === "pesanan" ? `${Math.round(n)} pesanan` : rupiah(n);

/** Selisih bertanda. Tandanya mendahului seluruh nilai — "Rp -132.000"
 *  menaruh minus di antara simbol mata uang dan angkanya, yang terbaca
 *  seperti salah ketik alih-alih seperti penurunan. */
const bertanda = (n: number, metrik: Metrik2) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${penuh(Math.abs(n), metrik)}`;

export default function RevenueChart({ titik, puncak, labelBanding }: Props) {
  const [metrik, setMetrik] = useState<Metrik2>("uang");
  const [tabel, setTabel] = useState(false);
  const [aktif, setAktif] = useState<number | null>(null);
  const idTip = useId();

  const kini = (t: TitikHari) => (metrik === "uang" ? t.value : t.orders);
  const lalu = (t: TitikHari) => (metrik === "uang" ? t.valuePrev : t.ordersPrev);

  // Satu skala untuk kedua deret. Dua sumbu-y akan mengarang korelasi yang
  // tidak ada di data — perbandingan hanya sah bila keduanya diukur sama.
  const max = Math.max(...titik.map((t) => Math.max(kini(t), lalu(t))), 1);

  // Puncak metrik uang sudah dihitung di server; untuk metrik pesanan
  // dihitung di sini supaya penandanya tetap menunjuk hari yang benar.
  const idxPuncak =
    metrik === "uang" ? puncak : titik.reduce((b, t, i) => (t.orders > titik[b].orders ? i : b), 0);

  const setiap = titik.length <= 10 ? 1 : Math.ceil(titik.length / 7);
  const t = aktif === null ? null : titik[aktif];

  return (
    <div>
      <div className="dv3-chart-bar">
        <div className="dv3-seg" role="group" aria-label="Metrik grafik">
          <button
            type="button"
            className={`dv3-seg-btn${metrik === "uang" ? " is-on" : ""}`}
            aria-pressed={metrik === "uang"}
            onClick={() => setMetrik("uang")}
          >
            Pendapatan
          </button>
          <button
            type="button"
            className={`dv3-seg-btn${metrik === "pesanan" ? " is-on" : ""}`}
            aria-pressed={metrik === "pesanan"}
            onClick={() => setMetrik("pesanan")}
          >
            Pesanan
          </button>
        </div>

        <button
          type="button"
          className="dv3-seg-btn dv3-seg-solo"
          aria-pressed={tabel}
          onClick={() => setTabel((v) => !v)}
        >
          {tabel ? <BarChart3Icon aria-hidden /> : <TableIcon aria-hidden />}
          {tabel ? "Grafik" : "Tabel"}
        </button>
      </div>

      {/* Legenda wajib hadir begitu ada dua deret: identitas tak boleh
          bersandar pada warna saja. */}
      <div className="dv3-legend">
        <span className="dv3-legend-item">
          <span className="dv3-key dv3-key-now" aria-hidden />
          Periode ini
        </span>
        <span className="dv3-legend-item">
          <span className="dv3-key dv3-key-prev" aria-hidden />
          {labelBanding}
        </span>
      </div>

      {tabel ? (
        <div className="dv3-tablewrap">
          <table className="dv3-table">
            <caption className="sr-only">
              {metrik === "uang" ? "Pendapatan lunas" : "Jumlah pesanan"} per hari, dibanding periode
              sebelumnya
            </caption>
            <thead>
              <tr>
                <th scope="col">Hari</th>
                <th scope="col">Periode ini</th>
                <th scope="col">Sebelumnya</th>
                <th scope="col">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {titik.map((d) => {
                const a = kini(d);
                const b = lalu(d);
                const s = a - b;
                return (
                  <tr key={d.iso}>
                    <th scope="row">{d.label}</th>
                    <td className="dv3-num">{penuh(a, metrik)}</td>
                    <td className="dv3-num">{penuh(b, metrik)}</td>
                    <td
                      className={`dv3-num ${s > 0 ? "dv3-delta-up" : s < 0 ? "dv3-delta-down" : "dv3-delta-flat"}`}
                    >
                      {bertanda(s, metrik)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dv3-plot" onPointerLeave={() => setAktif(null)}>
          <div className="dv3-plot-axis" aria-hidden>
            <span>{ringkas(max, metrik)}</span>
            <span>{ringkas(max / 2, metrik)}</span>
            <span>0</span>
          </div>

          <div className="dv3-plot-area">
            <div className="dv3-bars">
              {titik.map((d, i) => {
                const a = kini(d);
                const b = lalu(d);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    className="dv3-bar"
                    data-peak={i === idxPuncak && a > 0 ? "true" : undefined}
                    data-zero={a === 0 ? "true" : undefined}
                    data-on={aktif === i ? "true" : undefined}
                    // Tombol supaya nilainya terjangkau papan tik, bukan hanya
                    // tetikus: fokus memunculkan pembacaan yang sama dengan hover.
                    aria-describedby={aktif === i ? idTip : undefined}
                    aria-label={`${d.label}: ${penuh(a, metrik)}, sebelumnya ${penuh(b, metrik)}`}
                    onPointerEnter={() => setAktif(i)}
                    onFocus={() => setAktif(i)}
                    onBlur={() => setAktif(null)}
                  >
                    {/* Penanda rujukan: garis di ketinggian nilai periode
                        pembanding, jadi diposisikan lewat `bottom`, bukan
                        `height` — ia sebuah garis, bukan batang. */}
                    <span className="dv3-bar-prev" style={{ bottom: `${(b / max) * 100}%` }} />
                    <span className="dv3-bar-now" style={{ height: `${(a / max) * 100}%` }} />
                    {/* Label langsung hanya pada satu batang — angka di setiap
                        titik jadi kekacauan dan justru tak terbaca. */}
                    {i === idxPuncak && a > 0 && (
                      <span className="dv3-bar-tag" style={{ bottom: `${(a / max) * 100}%` }}>
                        {ringkas(a, metrik)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {t && (
              <div
                id={idTip}
                role="status"
                className="dv3-tip"
                style={{ left: `${((aktif! + 0.5) / titik.length) * 100}%` }}
              >
                <span className="dv3-tip-day">{t.label}</span>
                <span className="dv3-tip-row">
                  <span className="dv3-key dv3-key-now" aria-hidden />
                  <b className="dv3-num">{penuh(kini(t), metrik)}</b>
                </span>
                <span className="dv3-tip-row">
                  <span className="dv3-key dv3-key-prev" aria-hidden />
                  <b className="dv3-num">{penuh(lalu(t), metrik)}</b>
                </span>
              </div>
            )}
          </div>

          <div className="dv3-bars-axis" aria-hidden>
            {titik.map((d, i) => (
              <span key={d.iso}>{i % setiap === 0 ? d.label : ""}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
