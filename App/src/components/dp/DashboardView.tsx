import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  MousePointerClickIcon,
  ReceiptTextIcon,
  ScaleIcon,
  TargetIcon,
} from "lucide-react";
import AnalyticsHeader, { labelPembanding, type LembarAnalitik } from "@/components/dp/AnalyticsHeader";
import HeatmapJam from "@/components/dp/HeatmapJam";
import Petunjuk from "@/components/dp/Petunjuk";
import Funnel from "@/components/dp/Funnel";
import Sparkline from "@/components/dp/Sparkline";
import { Angka, DeltaTag, Kosong } from "@/components/dp/ledger";
import type { PresetKey } from "@/lib/date-range";
import { hitungCorong, hitungDelta, type Metrik } from "@/lib/dashboard-metrics";
import type { PeristiwaTamu } from "@/lib/dashboard-query";
import { fmtJam, rupiah } from "@/lib/dashboard-format";

/** Lembar RINGKASAN — murni presentasional.
 *
 *  Menjawab dua hal dalam hitungan detik: bagaimana kafe berjalan pada
 *  rentang ini (uang, pesanan, tamu yang membuka menu) dan apa yang perlu
 *  disentuh sekarang. Rincian uang — metode bayar, kategori, transaksi —
 *  dipindah ke lembar Penjualan supaya lembar ini tetap bisa dibaca dari
 *  ponsel saat tutup kasir.
 *
 *  Dipisah dari `page.tsx` supaya susunan yang sama bisa dijalankan dengan
 *  data Supabase nyata maupun fixture (`/dev-preview`).
 */
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
  const konversi = tamu.kini.click_menu ? m.kini.pesanan / tamu.kini.click_menu : null;
  const konversiLalu = tamu.lalu.click_menu ? m.lalu.pesanan / tamu.lalu.click_menu : null;
  const maxKlik = Math.max(...tamu.perMenu.map((d) => d.klik), 1);

  const ringkasan =
    m.kafeBaru
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
        kicker="Ringkasan operasional"
        judul="Bagaimana kafe berjalan"
        ringkasan={ringkasan}
        hrefBase={hrefBase}
      />

      {/* ── Kepala ledger: satu angka otoritatif + sparkline kumulatif. ── */}
      <section className="dv3-hero dv3-reveal" style={{ "--i": 0 } as CSSProperties} aria-labelledby="judul-pendapatan">
        <div className="dv3-hero-fig">
          <h2 className="dv3-eyebrow" id="judul-pendapatan">
            Pendapatan lunas · {spanDays} hari
          </h2>
          <strong className="dv3-ledger-figure dv3-num">{rupiah(m.kini.pendapatan)}</strong>
          <div className="dv3-ledger-meta">
            <DeltaTag delta={m.deltaPendapatan} satuan="pendapatan" />
            <span>
              {m.deltaPendapatan.pct !== null
                ? `dari ${rupiah(m.lalu.pendapatan)} pada ${banding}`
                : `${banding} tanpa penjualan lunas`}
            </span>
          </div>
          <Link href={(hrefBase?.penjualan ?? `/dashboard-v2/penjualan?from=${fromIso}&to=${toIso}`) as never} className="dv3-hero-link">
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
          <figure className="dv3-hero-spark">
            <Sparkline titik={m.kumulatif} />
            <figcaption className="dv3-legend">
              <span className="dv3-legend-item">
                <span className="dv3-key dv3-key-now" aria-hidden />
                Kumulatif periode ini
              </span>
              <span className="dv3-legend-item">
                <span className="dv3-key dv3-key-dash" aria-hidden />
                {banding}
              </span>
            </figcaption>
          </figure>
        )}
      </section>

      {/* ── Angka sekunder: garis rambut vertikal, tanpa kartu. ── */}
      <div className="dv3-strip dv3-reveal" style={{ "--i": 1 } as CSSProperties}>
        <Angka
          icon={<ReceiptTextIcon />}
          label="Pesanan masuk"
          nilai={m.kini.pesanan}
          bawah={<DeltaTag delta={m.deltaPesanan} satuan="pesanan" />}
        />
        <Angka
          icon={<ScaleIcon />}
          label="Nilai rata-rata"
          nilai={m.kini.nilaiRata > 0 ? rupiah(m.kini.nilaiRata) : "—"}
          bawah={m.kini.nilaiRata > 0 ? <DeltaTag delta={m.deltaNilaiRata} satuan="transaksi lunas" /> : "Belum ada transaksi lunas"}
        />
        <Angka
          icon={<MousePointerClickIcon />}
          label="Tamu buka menu"
          nilai={tamu.gagal ? "—" : tamu.kini.click_menu.toLocaleString("id-ID")}
          bawah={tamu.gagal ? "Data peristiwa tak terbaca" : <DeltaTag delta={deltaBuka} satuan="kunjungan" />}
        />
        <Angka
          icon={<TargetIcon />}
          label="Buka menu → pesan"
          nilai={konversi === null ? "—" : `${Math.round(konversi * 100)}%`}
          bawah={
            konversi === null
              ? "Belum ada tamu membuka menu"
              : konversiLalu === null
                ? "Tanpa pembanding"
                : `dari ${Math.round(konversiLalu * 100)}% pada ${banding}`
          }
        />
      </div>

      <div className="dv3-grid-a">
        <section className="dv3-panel dv3-reveal" style={{ "--i": 2 } as CSSProperties} aria-labelledby="judul-jam">
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
        </section>

        <section className="dv3-panel dv3-reveal" style={{ "--i": 3 } as CSSProperties} aria-labelledby="judul-perhatian">
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
        </section>
      </div>

      <div className="dv3-grid-b">
        <section className="dv3-panel dv3-reveal" style={{ "--i": 4 } as CSSProperties} aria-labelledby="judul-corong">
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
        </section>

        <section className="dv3-panel dv3-reveal" style={{ "--i": 5 } as CSSProperties} aria-labelledby="judul-dilirik">
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
        </section>

        <section className="dv3-panel dv3-reveal" style={{ "--i": 6 } as CSSProperties} aria-labelledby="judul-berjalan">
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
        </section>
      </div>
    </>
  );
}
