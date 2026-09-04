import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import AnalyticsHeader, { labelPembanding, type LembarAnalitik } from "@/components/dp/AnalyticsHeader";
import Petunjuk from "@/components/dp/Petunjuk";
import RevenueChart from "@/components/dp/RevenueChart";
import CumulativeChart from "@/components/dp/CumulativeChart";
import MixBar from "@/components/dp/MixBar";
import RankPanel from "@/components/dp/RankPanel";
import TransaksiTable from "@/components/dp/TransaksiTable";
import KpiKartu, { PilDelta } from "@/components/dp/KpiKartu";
import { Kartu, Wadah } from "@/components/dp/motion-dp";
import { Kosong, Nilai } from "@/components/dp/ledger";
import type { PresetKey } from "@/lib/date-range";
import { hitungDelta, type Metrik } from "@/lib/dashboard-metrics";
import { rupiah } from "@/lib/dashboard-format";

/** Lembar PENJUALAN — murni presentasional.
 *
 *  Pertanyaannya: dari mana uang datang, kapan, dan lewat apa. Angka
 *  otoritatifnya sama dengan Ringkasan (pendapatan lunas), tetapi di sini ia
 *  dibedah: deret harian dengan pembanding, laju kumulatif, metode bayar,
 *  menu dan kategori penyumbang, status pesanan, lalu tabel transaksi untuk
 *  presisi. Tidak ada donat; bagian-terhadap-keseluruhan dibaca dari panjang.
 */

/* Status memakai warna semantik, bukan urutan seri: "siap" hijau, "dimasak"
   kuning, "dibatalkan" merah — sama dengan pil status di seluruh konsol. */
const WARNA_STATUS: Record<string, string> = {
  awaiting: "dv3-mix-muted",
  received: "dv3-mix-muted",
  preparing: "dv3-mix-warn",
  ready: "dv3-mix-ok",
  completed: "dv3-series-2",
  cancelled: "dv3-mix-bad",
};

export default function PenjualanView({
  m,
  fromIso,
  toIso,
  preset,
  spanDays,
  hrefBase,
}: {
  m: Metrik;
  fromIso: string;
  toIso: string;
  preset: PresetKey;
  spanDays: number;
  hrefBase?: Record<LembarAnalitik, string>;
}) {
  const banding = labelPembanding(fromIso, spanDays);
  const metodeUtama = m.metodeBayar[0];
  const pangsaUtama = metodeUtama && m.kini.pendapatan ? Math.round((metodeUtama.nilai / m.kini.pendapatan) * 100) : null;
  const deltaLunas = hitungDelta(m.kini.pesananLunas, m.lalu.pesananLunas);
  const deltaBelum = hitungDelta(m.kini.belumLunasNilai, m.lalu.belumLunasNilai);

  const ringkasan =
    m.kini.pesananLunas === 0
      ? "Belum ada pembayaran lunas pada rentang ini, jadi belum ada uang yang bisa dibedah."
      : `${m.kini.pesananLunas} pesanan lunas, rata-rata ${rupiah(m.kini.nilaiRata)} per pesanan${
          metodeUtama && pangsaUtama !== null ? `; ${pangsaUtama}% masuk lewat ${metodeUtama.label.toLowerCase()}` : ""
        }.`;

  return (
    <>
      <AnalyticsHeader
        aktif="penjualan"
        fromIso={fromIso}
        toIso={toIso}
        preset={preset}
        spanDays={spanDays}
        judul="Penjualan"
        ringkasan={ringkasan}
        hrefBase={hrefBase}
        harian={m.harian}
        transaksi={m.transaksi}
      />

      <Wadah className="an-kpis">
        <KpiKartu
          label="Pesanan lunas"
          ikon="pesanan"
          tone="navy"
          nilai={m.kini.pesananLunas}
          delta={deltaLunas}
          satuan="pesanan lunas"
          catatan={`dari ${m.kini.pesanan.toLocaleString("id-ID")} pesanan masuk`}
        />
        <KpiKartu
          label="Nilai rata-rata"
          ikon="rata"
          nilai={m.kini.nilaiRata > 0 ? m.kini.nilaiRata : undefined}
          nilaiTeks={m.kini.nilaiRata > 0 ? undefined : "—"}
          bentuk="rupiah"
          delta={m.kini.nilaiRata > 0 ? m.deltaNilaiRata : undefined}
          satuan="transaksi lunas"
          catatan={m.lalu.nilaiRata > 0 ? `vs ${rupiah(m.lalu.nilaiRata)} pada ${banding}` : "Belum ada pembanding"}
        />
        <KpiKartu
          label="Item terjual"
          ikon="item"
          tone="accent"
          nilai={m.kini.itemTerjual}
          delta={m.deltaItem}
          satuan="item"
          catatan={`vs ${m.lalu.itemTerjual.toLocaleString("id-ID")} pada ${banding}`}
        />
        <KpiKartu
          label="Belum lunas"
          ikon="uang"
          nilai={m.kini.belumLunasNilai}
          bentuk="rupiah"
          delta={m.kini.belumLunasNilai > 0 ? deltaBelum : undefined}
          satuan="tagihan"
          catatan={
            m.kini.belumLunasJumlah ? `${m.kini.belumLunasJumlah} pesanan menunggu bayar` : "Semua sudah dibayar"
          }
        />
      </Wadah>

      {/* ── Kolom lebar: angka otoritatif + deret harian, dengan jalur
          pembayaran bersarang di bawahnya. Kolom sempit: laju kumulatif. ── */}
      <div className="dv3-grid-a">
        <Wadah className="an-cell">
          <Kartu className="dv3-panel an-hero" aria-labelledby="judul-pendapatan">
            <div className="an-hero-grid">
              <div className="dv3-hero-fig">
                <h2 className="dv3-eyebrow" id="judul-pendapatan">
                  Pendapatan lunas · {spanDays} hari
                </h2>
                <Nilai className="dv3-ledger-figure" nilai={m.kini.pendapatan} bentuk="rupiah" />
                <div className="an-hero-meta">
                  <PilDelta delta={m.deltaPendapatan} satuan="pendapatan" />
                  <span>
                    {m.deltaPendapatan.pct !== null
                      ? `dari ${rupiah(m.lalu.pendapatan)} pada ${banding}`
                      : `${banding} tanpa penjualan lunas`}
                  </span>
                </div>
              </div>

              <div className="dv3-hero-chart">
                <div className="dv3-panel-head">
                  <h3 className="dv3-panel-title">Pendapatan harian</h3>
                  <Petunjuk judul="Pendapatan harian" bab="penjualan">
                    Satu batang per hari, dengan garis tipis sebagai penanda periode pembanding. Hari tanpa penjualan
                    sengaja tampil kosong, bukan sebagai penurunan bertahap.
                  </Petunjuk>
                  <span className="dv3-panel-note">Batang = periode ini · garis = {banding}</span>
                </div>
                {m.puncak === -1 ? (
                  <Kosong
                    judul="Belum ada penjualan lunas di rentang ini"
                    isi={
                      m.kafeBaru
                        ? "Kafe ini belum menerima pesanan sama sekali. Terbitkan QR Smart Menu di meja supaya tamu bisa memesan sendiri dari ponsel mereka."
                        : "Ada pesanan masuk, tapi belum satu pun berstatus lunas. Lebarkan rentang tanggalnya, atau tuntaskan pembayaran yang masih tertahan di kasir."
                    }
                    aksi={
                      m.kafeBaru
                        ? { label: "Buka QR Smart Menu", href: "/dashboard-v2/pengaturan" }
                        : { label: "Buka kasir", href: "/kasir" }
                    }
                  />
                ) : (
                  <RevenueChart titik={m.harian} puncak={m.puncak} labelBanding={banding} />
                )}
              </div>
            </div>

            {/* Metode bayar duduk DI DALAM kartu uang, bukan sebagai kartu
                sendiri: pertanyaannya "lewat apa uang tadi masuk", jadi ia
                hanya masuk akal ditempel pada angka yang baru saja dibaca. */}
            <div className="an-nested">
              <div className="dv3-panel-head">
                <h3 className="dv3-panel-title">Metode pembayaran</h3>
                <span className="dv3-panel-note">Pesanan lunas</span>
              </div>
              <MixBar irisan={m.metodeBayar} dasar="nilai" kosong="Belum ada pembayaran lunas untuk dibagi per metode." />
            </div>
          </Kartu>
        </Wadah>

        <Wadah className="an-stack">
          <Kartu aria-labelledby="judul-laju">
            <div className="dv3-panel-head">
              <h2 className="dv3-panel-title" id="judul-laju">
                Laju periode
              </h2>
              <span className="dv3-panel-note">Total berjalan</span>
            </div>
            {m.puncak === -1 && m.lalu.pendapatan === 0 ? (
              <Kosong
                judul="Belum ada laju untuk digambar"
                isi="Garis ini membandingkan total berjalan periode ini dengan periode sebelumnya, hari demi hari."
              />
            ) : (
              <CumulativeChart titik={m.kumulatif} labelBanding={banding} />
            )}
          </Kartu>

          <Kartu aria-labelledby="judul-status">
            <div className="dv3-panel-head">
              <h2 className="dv3-panel-title" id="judul-status">
                Status pesanan
              </h2>
              <Link href="/dashboard-v2/pesanan" className="dv3-panel-link">
                Semua <ChevronRightIcon aria-hidden />
              </Link>
            </div>
            <MixBar irisan={m.statusMix} dasar="jumlah" warna={WARNA_STATUS} kosong="Belum ada pesanan masuk pada rentang ini." />
          </Kartu>
        </Wadah>
      </div>

      <Wadah className="an-grid-2">
        <Kartu aria-labelledby="judul-terlaris">
          <div className="dv3-panel-head">
            <h2 className="dv3-panel-title" id="judul-terlaris">
              Terlaris
            </h2>
            <Link href="/dashboard-v2/items" className="dv3-panel-link">
              Semua item <ChevronRightIcon aria-hidden />
            </Link>
          </div>
          {m.terlaris.length === 0 ? (
            <Kosong
              judul="Belum ada item terjual"
              isi="Peringkat ini menjumlahkan kontribusi pendapatan tiap menu dari pesanan yang sudah lunas."
            />
          ) : (
            <RankPanel baris={m.terlaris} labelQty="terjual" />
          )}
        </Kartu>

        <Kartu aria-labelledby="judul-kategori">
          <div className="dv3-panel-head">
            <h2 className="dv3-panel-title" id="judul-kategori">
              Kategori
            </h2>
            <Link href="/dashboard-v2/kategori" className="dv3-panel-link">
              Kelola <ChevronRightIcon aria-hidden />
            </Link>
          </div>
          {m.kategori.length === 0 ? (
            <Kosong
              judul="Belum ada kategori yang menghasilkan"
              isi="Kategori diambil dari kolom kategori tiap menu, lalu dijumlahkan berdasarkan uang yang benar-benar masuk."
            />
          ) : (
            <RankPanel baris={m.kategori} labelQty="item terjual" />
          )}
        </Kartu>

      </Wadah>

      <Wadah>
        <Kartu aria-labelledby="judul-transaksi">
          <div className="dv3-panel-head">
            <h2 className="dv3-panel-title" id="judul-transaksi">
              Transaksi terbaru
            </h2>
            <Petunjuk judul="Unduh CSV" bab="penjualan">
              Berkasnya dirakit dari rentang tanggal yang sedang dipilih dan berisi dua bagian: deret harian beserta
              angka periode pembandingnya, lalu daftar transaksi lunas satu per satu.
            </Petunjuk>
            <Link href="/dashboard-v2/pesanan" className="dv3-panel-link">
              Semua pesanan <ChevronRightIcon aria-hidden />
            </Link>
          </div>
          <TransaksiTable transaksi={m.transaksi} harian={m.harian} namaBerkas={`penjualan-${fromIso}_${toIso}.csv`} />
        </Kartu>
      </Wadah>
    </>
  );
}
