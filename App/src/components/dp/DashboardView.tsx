import Link from "next/link";
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";
import AnalyticsHeader, { labelPembanding, type LembarAnalitik } from "@/components/dp/AnalyticsHeader";
import AnomalyPulseStrip from "@/components/dp/AnomalyPulseStrip";
import HeatmapJam from "@/components/dp/HeatmapJam";
import Petunjuk from "@/components/dp/Petunjuk";
import Funnel from "@/components/dp/Funnel";
import CumulativeChart from "@/components/dp/CumulativeChart";
import KpiKartu, { PilDelta } from "@/components/dp/KpiKartu";
import HariAktif, { type BarisHari } from "@/components/dp/HariAktif";
import GaugeKipas from "@/components/dp/GaugeKipas";
import SegmenKartu from "@/components/dp/SegmenKartu";
import AsistenAI from "@/components/dp/AsistenAI";
import { Kartu, Wadah } from "@/components/dp/motion-dp";
import { Kosong, Nilai } from "@/components/dp/ledger";
import type { PresetKey } from "@/lib/date-range";
import { hitungCorong, hitungDelta, hitungRasioTerbatas, NAMA_HARI, type Metrik } from "@/lib/dashboard-metrics";
import type { PeristiwaTamu } from "@/lib/dashboard-query";
import { fmtJam, rupiah } from "@/lib/dashboard-format";

/** Lembar RINGKASAN — murni presentasional.
 *
 *  Menjawab dua hal dalam hitungan detik: bagaimana kafe berjalan pada
 *  rentang ini (uang, pesanan, tamu yang membuka menu) dan apa yang perlu
 *  disentuh sekarang. Rincian uang — kategori, transaksi satu per satu —
 *  tetap di lembar Penjualan supaya lembar ini masih bisa dibaca dari ponsel
 *  saat tutup kasir.
 *
 *  Susunannya kartu dasbor: baris KPI di atas, lalu kolom lebar berisi angka
 *  otoritatif + laju + komposisi pembayaran, dan kolom sempit berisi dua
 *  ringkasan berbentuk grafik (hari teraktif, konversi). Sisanya menyusul
 *  sebagai kartu setara.
 *
 *  Dipisah dari `page.tsx` supaya susunan yang sama bisa dijalankan dengan
 *  data Supabase nyata maupun fixture (`/dev-preview`).
 */

/** Total pendapatan lunas per hari-minggu, dari matriks jam×hari. */
function perHari(sel: Metrik["jam"]["sel"]): BarisHari[] {
  return NAMA_HARI.map((label, hari) => {
    const baris = sel.filter((s) => s.hari === hari);
    return {
      label,
      nilai: baris.reduce((t, s) => t + s.nilai, 0),
      pesanan: baris.reduce((t, s) => t + s.pesanan, 0),
    };
  });
}

export default function DashboardView({
  m,
  tamu,
  fromIso,
  toIso,
  preset,
  spanDays,
  hrefBase,
}: {
  m: Metrik;
  tamu: PeristiwaTamu;
  fromIso: string;
  toIso: string;
  preset: PresetKey;
  spanDays: number;
  hrefBase?: Record<LembarAnalitik, string>;
}) {
  const banding = labelPembanding(fromIso, spanDays);
  const corong = hitungCorong({
    kini: tamu.kini,
    lalu: tamu.lalu,
    pesananKini: m.kini.pesanan,
    pesananLalu: m.lalu.pesanan,
    lunasKini: m.kini.pesananLunas,
    lunasLalu: m.lalu.pesananLunas,
  });
  const deltaBuka = hitungDelta(tamu.kini.click_menu, tamu.lalu.click_menu);
  // Konversi tamu harus memakai dua event dari sumber yang sama. Total Orders
  // juga memuat pesanan kasir/POS, sehingga membaginya dengan event buka menu
  // dapat menghasilkan angka mustahil seperti 140%.
  const konversi = hitungRasioTerbatas(tamu.kini.click_order, tamu.kini.click_menu);
  const konversiLalu = hitungRasioTerbatas(tamu.lalu.click_order, tamu.lalu.click_menu);
  const deltaKonversi = hitungDelta(konversi ?? 0, konversiLalu ?? 0);
  const maxKlik = Math.max(...tamu.perMenu.map((d) => d.klik), 1);
  const hari = perHari(m.jam.sel);

  const ringkasan = m.kafeBaru
    ? "Kafe ini belum menerima pesanan. Begitu QR Smart Menu terpasang di meja, angka-angka di sini mulai terisi sendiri."
    : m.deltaPendapatan.pct === null
      ? `${rupiah(m.kini.pendapatan)} masuk dari ${m.kini.pesananLunas} pesanan lunas; periode sebelumnya belum ada penjualan yang bisa dibandingkan.`
      : `${rupiah(m.kini.pendapatan)} masuk dari ${m.kini.pesananLunas} pesanan lunas, ${
          m.deltaPendapatan.arah === "up" ? "naik" : m.deltaPendapatan.arah === "down" ? "turun" : "setara"
        }${m.deltaPendapatan.arah === "flat" ? "" : ` ${Math.abs(m.deltaPendapatan.pct).toFixed(1)}%`} dibanding ${banding}.`;

  return (
    <>
      <AnalyticsHeader
        aktif="ringkasan"
        fromIso={fromIso}
        toIso={toIso}
        preset={preset}
        spanDays={spanDays}
        judul="Ringkasan"
        ringkasan={ringkasan}
        hrefBase={hrefBase}
        harian={m.harian}
        transaksi={m.transaksi}
      />

      {/* ── Deteksi Anomali Operasional Dapur & Transaksi ── */}
      <AnomalyPulseStrip
        m={m}
        tamu={tamu}
        hrefPesanan="/dashboard-v2/pesanan"
      />

      {/* ── Empat angka setara. Uang sengaja TIDAK ada di sini: ia punya
          kartunya sendiri di bawah, dan mengulangnya di strip akan membuat
          dua angka otoritatif bersaing di layar yang sama. ── */}
      <Wadah className="an-kpis">
        <KpiKartu
          label="Tamu buka menu"
          ikon="buka"
          tone="navy"
          nilai={tamu.gagal ? undefined : tamu.kini.click_menu}
          nilaiTeks={tamu.gagal ? "—" : undefined}
          delta={tamu.gagal ? undefined : deltaBuka}
          satuan="kunjungan"
          catatan={
            tamu.gagal
              ? "Data peristiwa tak terbaca"
              : `vs ${tamu.lalu.click_menu.toLocaleString("id-ID")} pada ${banding}`
          }
        />
        <KpiKartu
          label="Pesanan masuk"
          ikon="pesanan"
          nilai={m.kini.pesanan}
          delta={m.deltaPesanan}
          satuan="pesanan"
          catatan={`vs ${m.lalu.pesanan.toLocaleString("id-ID")} pada ${banding}`}
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
          label="Buka menu → pesan"
          ikon="konversi"
          tone="accent"
          nilai={konversi ?? undefined}
          nilaiTeks={konversi === null ? "—" : undefined}
          bentuk="persen"
          delta={konversi !== null && konversiLalu !== null ? deltaKonversi : undefined}
          satuan="konversi"
          catatan={
            konversi === null
              ? "Belum ada tamu membuka menu"
              : konversiLalu === null
                ? "Tanpa pembanding"
                : `vs ${Math.round(konversiLalu * 100)}% pada ${banding}`
          }
        />
      </Wadah>

      {/* ── Kolom lebar: uang + laju + jalur pembayaran. Kolom sempit: dua
          ringkasan berbentuk grafik yang menjawab "kapan" dan "seberapa
          sering tamu jadi memesan". ── */}
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
                <Link
                  href={(hrefBase?.penjualan ?? `/dashboard-v2/penjualan?from=${fromIso}&to=${toIso}`) as never}
                  className="dv3-hero-link"
                >
                  Rincian penjualan
                  <ArrowUpRightIcon aria-hidden />
                </Link>
              </div>

              {m.kini.pendapatan === 0 && m.lalu.pendapatan === 0 ? (
                <p className="dv3-annot dv3-hero-quiet">
                  {m.kafeBaru
                    ? "Belum ada laju untuk digambar — grafik ini terisi begitu pesanan lunas pertama masuk."
                    : "Belum ada penjualan lunas pada kedua periode; garis laju menunggu pembayaran pertama."}
                </p>
              ) : (
                <div className="dv3-hero-cumulative">
                  <CumulativeChart titik={m.kumulatif} labelBanding={banding} />
                </div>
              )}
            </div>

            {/* Kartu bersarang: pangsa tiap jalur pembayaran, sejajar dengan
                uang yang baru saja dibaca di atasnya. */}
            <div className="an-nested">
              <div className="dv3-panel-head">
                <h3 className="dv3-panel-title">Jalur pembayaran</h3>
                <span className="dv3-panel-note">Pesanan lunas · tiga teratas</span>
              </div>
              <SegmenKartu irisan={m.metodeBayar} kosong="Belum ada pembayaran lunas untuk dibagi per metode." />
            </div>
          </Kartu>
        </Wadah>

        <Wadah className="an-stack">
          <Kartu aria-labelledby="judul-hari">
            <div className="dv3-panel-head">
              <h2 className="dv3-panel-title" id="judul-hari">
                Hari paling ramai
              </h2>
              <Petunjuk judul="Hari paling ramai" bab="ringkasan">
                Pendapatan lunas dijumlahkan per hari-minggu sepanjang rentang, jadi rentang yang memuat dua hari
                Sabtu akan menumpuk keduanya di batang yang sama.
              </Petunjuk>
              <span className="dv3-panel-note">Pendapatan lunas</span>
            </div>
            <HariAktif baris={hari} />
          </Kartu>

          <Kartu aria-labelledby="judul-konversi">
            <div className="dv3-panel-head">
              <h2 className="dv3-panel-title" id="judul-konversi">
                Tingkat konversi
              </h2>
              <Petunjuk judul="Tingkat konversi" bab="ringkasan">
                Berapa persen tamu yang membuka menu berakhir mengirim pesanan. Dihitung dari peristiwa di ponsel
                tamu dibagi pesanan masuk pada rentang yang sama.
              </Petunjuk>
            </div>
            <GaugeKipas
              rasio={tamu.gagal ? null : konversi}
              label="tamu yang buka menu lalu memesan"
              kosong={
                tamu.gagal
                  ? "Peristiwa tamu tidak terbaca, jadi konversi belum bisa dihitung. Muat ulang halaman."
                  : "Belum ada tamu yang membuka menu pada rentang ini."
              }
            />
          </Kartu>
        </Wadah>
      </div>

      <Wadah className="dv3-grid-a">
        <Kartu aria-labelledby="judul-jam">
          <div className="dv3-panel-head">
            <h2 className="dv3-panel-title" id="judul-jam">
              Jam ramai
            </h2>
            <Petunjuk judul="Jam ramai" bab="ringkasan">
              Matriks hari-minggu × jam dari pesanan yang sudah lunas. Butuh rentang minimal 7 hari; di bawah itu
              tampilannya berubah jadi profil 24 jam.
            </Petunjuk>
            <span className="dv3-panel-note">
              {spanDays >= 7 ? "Hari-minggu × jam, pesanan yang lunas" : "Per jam — rentang di bawah 7 hari tidak dipecah per hari-minggu"}
            </span>
          </div>
          {m.kini.pesanan === 0 ? (
            <Kosong
              judul="Belum ada pesanan untuk dipetakan"
              isi={
                m.kafeBaru
                  ? "Peta ini terisi begitu tamu mulai memesan lewat QR Smart Menu — ia akan menunjukkan jam dan hari kasir harus penuh."
                  : "Tidak ada pesanan pada rentang ini. Lebarkan rentang tanggalnya untuk melihat pola mingguan."
              }
              aksi={m.kafeBaru ? { label: "Buka QR Smart Menu", href: "/dashboard-v2/pengaturan" } : undefined}
            />
          ) : (
            <HeatmapJam jam={m.jam} spanDays={spanDays} />
          )}
        </Kartu>

        <Kartu aria-labelledby="judul-perhatian">
          <div className="dv3-panel-head">
            <h2 className="dv3-panel-title" id="judul-perhatian">
              Butuh perhatian
            </h2>
            <Petunjuk judul="Butuh perhatian" bab="ringkasan">
              Tagihan belum lunas yang lewat 45 menit dan pesanan yang masih di dapur lewat 30 menit naik ke sini.
              Maksimum enam baris, paling genting di atas, dan satu pesanan hanya muncul sekali.
            </Petunjuk>
            {m.perhatian.length > 0 && <span className="dv3-panel-note dv3-num">{m.perhatian.length}</span>}
          </div>
          {m.perhatian.length === 0 ? (
            <Kosong
              judul="Tidak ada yang tertinggal"
              isi="Semua pesanan terbayar tepat waktu, tidak ada yang menua di dapur, dan seluruh menu sedang tayang."
            />
          ) : (
            <ul className="dv3-attn">
              {m.perhatian.map((p) => (
                <li key={p.key}>
                  <Link href={p.href as never} className="dv3-attn-row">
                    <span className={`dv3-attn-dot ${p.tone === "bad" ? "dv3-attn-bad" : "dv3-attn-warn"}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="dv3-attn-title">{p.judul}</span>
                      <span className="dv3-attn-sub">{p.detail}</span>
                    </span>
                    <span className="dv3-attn-side">
                      {p.sisi}
                      <ChevronRightIcon aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Kartu>
      </Wadah>

      {/* Asisten AI berdiri sendiri selebar lembar, bukan menumpuk di kolom
          sempit: kolom itu memaksa kartu hero di sebelahnya meregang setinggi
          tumpukannya, dan hero jadi setengah ruang kosong. */}
      <AsistenAI />

      <Wadah className="dv3-grid-b">
        <Kartu aria-labelledby="judul-corong">
          <div className="dv3-panel-head">
            <h2 className="dv3-panel-title" id="judul-corong">
              Corong tamu
            </h2>
            <Petunjuk judul="Corong tamu" bab="ringkasan">
              Lima langkah dari QR dipindai sampai lunas. Langkah lihat 3D hanya terisi untuk menu yang sudah
              punya model .glb, jadi corong akan tampak datar selama katalog belum bermodel.
            </Petunjuk>
            <span className="dv3-panel-note">Dari QR sampai lunas</span>
          </div>
          {tamu.gagal ? (
            <Kosong
              judul="Peristiwa tamu tidak terbaca"
              isi="Angka pesanan dan pendapatan tetap benar; hanya jejak klik di ponsel tamu yang gagal dimuat barusan. Muat ulang halaman."
            />
          ) : (
            <Funnel
              corong={corong}
              kosong="Belum ada tamu yang membuka menu pada rentang ini. Corong mulai terisi begitu QR Smart Menu dipindai."
            />
          )}
        </Kartu>

        <Kartu aria-labelledby="judul-dilirik">
          <div className="dv3-panel-head">
            <h2 className="dv3-panel-title" id="judul-dilirik">
              Paling dilirik
            </h2>
            <Link href="/dashboard-v2/items" className="dv3-panel-link">
              Semua item <ChevronRightIcon aria-hidden />
            </Link>
          </div>
          {tamu.perMenu.length === 0 ? (
            <Kosong
              judul="Belum ada menu yang dibuka tamu"
              isi="Peringkat ini menghitung berapa kali tiap menu dibuka, dilihat model 3D-nya, dan dipesan dari ponsel tamu."
            />
          ) : (
            <ol className="dv3-rank">
              {tamu.perMenu.map((d) => {
                const konv = d.klik ? Math.round((d.pesan / d.klik) * 100) : null;
                return (
                  <li key={d.id} className="dv3-rank-row">
                    {d.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- thumbnail dari storage publik kafe
                      <img src={d.thumb} alt="" className="dv3-thumb" loading="lazy" decoding="async" />
                    ) : (
                      <span className="dv3-thumb" aria-hidden>
                        {d.nama.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="dv3-rank-name">{d.nama}</span>
                      <span className="dv3-rank-track">
                        <i style={{ width: `${Math.max((d.klik / maxKlik) * 100, 2)}%` }} />
                      </span>
                    </span>
                    <span className="dv3-rank-val">
                      <span className="dv3-num">{d.klik}× dibuka</span>
                      <span className="dv3-rank-sub">
                        {d.lihat3d} lihat 3D · {konv === null ? "—" : `${konv}% pesan`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Kartu>

        <Kartu aria-labelledby="judul-berjalan">
          <div className="dv3-panel-head">
            <h2 className="dv3-panel-title" id="judul-berjalan">
              Pesanan berjalan
            </h2>
            <Link href="/dashboard-v2/pesanan" className="dv3-panel-link">
              Semua <ChevronRightIcon aria-hidden />
            </Link>
          </div>
          {m.berjalan.length === 0 ? (
            <Kosong
              judul="Tidak ada pesanan berjalan"
              isi="Pesanan muncul di sini sejak tamu mengirimnya sampai dinyatakan selesai di kasir."
            />
          ) : (
            <ul className="dv3-attn">
              {m.berjalan.map((o) => {
                const meja = o.table_number ? `Meja ${o.table_number}` : "Tamu";
                const item = (o.items ?? []).reduce((s, it) => s + (it.qty ?? 1), 0);
                const pill =
                  o.status === "ready"
                    ? { cls: "dv3-pill-ready", txt: "Siap" }
                    : o.status === "preparing"
                      ? { cls: "dv3-pill-cook", txt: "Dimasak" }
                      : { cls: "dv3-pill-wait", txt: "Menunggu" };
                return (
                  <li key={o.id_order} className="dv3-attn-row">
                    <span className="min-w-0 dv3-attn-span2">
                      <span className="dv3-attn-title">{meja}</span>
                      <span className="dv3-attn-sub">
                        {fmtJam.format(new Date(o.created_at))} · {item} item · {rupiah(o.total ?? 0)}
                      </span>
                    </span>
                    <span className={`dv3-pill ${pill.cls}`}>{pill.txt}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Kartu>
      </Wadah>

    </>
  );
}
