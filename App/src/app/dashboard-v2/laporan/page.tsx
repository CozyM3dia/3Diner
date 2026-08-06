import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";
import { formatRupiah } from "@/lib/format";
import {
  buildDailySeries,
  buildFunnel,
  describeFunnel,
  describePeak,
  getReportPage,
  MODE_LABEL,
  parseMode,
  parsePeriod,
  PERIODS,
  REPORT_MODES,
  type TaxSummary,
} from "@/lib/dashboard-v2-reports";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";
import BarSeries from "@/components/dashboard-v2/BarSeries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Laporan · Konsol Owner",
};

interface PageProps {
  searchParams: Promise<{ mode?: string; hari?: string }>;
}

/** Rute Laporan — empat mode, satu rute.
 *
 *  Bukti Tantri: mereka menambah SCOPE, bukan rute. Dua rute datar (penjualan
 *  dan analitik) akan jadi empat begitu laporan pajak masuk, lalu enam begitu
 *  ada laporan staf — dan nav tumbuh setiap kali ada pertanyaan baru. */
export default async function OwnerReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode = parseMode(params.mode);
  const days = parsePeriod(params.hari);

  const ctx = await getStaffContext();
  const page = await getReportPage(ctx.cafe_id ?? null, days);

  const hrefFor = (m: string, d: number = days) => `/dashboard-v2/laporan?mode=${m}&hari=${d}`;

  // Deret dihitung sekali, dipakai untuk grafik DAN untuk kalimatnya — kalau
  // dihitung dua kali, keduanya bisa menyimpulkan puncak yang berbeda.
  // RPC sudah mengembalikan deret per hari (WIB); buildDailySeries mengisi hari
  // kosong supaya bentuk grafik tidak memadatkan waktu.
  const revenueSeries = buildDailySeries(
    page.dailyRevenue.map((d) => ({ created_at: d.day + "T12:00:00+07:00", value: d.value })),
    days
  );
  const openSeries = buildDailySeries(
    page.openTimestamps.map((t) => ({ created_at: t, value: 1 })),
    days
  );

  // Menu teratas dari agregat RPC (urutan sudah menurun omzet); share dihitung
  // terhadap total omzet seluruh item, konsisten dengan perilaku tallyMenus.
  const tally = (() => {
    const total = page.perItem.reduce((s, m) => s + m.revenue, 0);
    return page.perItem.slice(0, 5).map((m) => ({ ...m, share: total > 0 ? m.revenue / total : 0 }));
  })();

  return (
    <OwnerShell title="Laporan" right={<span className="dv2-sub">{days} hari terakhir</span>}>
      <nav className="dv2-tabs" aria-label="Mode laporan">
        {REPORT_MODES.map((m) => (
          <Link
            key={m}
            href={hrefFor(m)}
            className="dv2-tab"
            aria-current={m === mode ? "page" : undefined}
          >
            {MODE_LABEL[m]}
          </Link>
        ))}
        <span className="dv2-tab dv2-tab-note">
          {/* Periode dipilih, bukan dikunci mati di 14 hari seperti analitik lama. */}
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={hrefFor(mode, p)}
              className="dv2-period"
              aria-current={p === days ? "page" : undefined}
            >
              {p} hari
            </Link>
          ))}
        </span>
      </nav>

      {page.error ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Gagal memuat laporan</p>
          <p className="dv2-state-body">{page.error}</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor(mode)}>
            Coba lagi
          </Link>
        </div>
      ) : !page.hasOrders && page.events.open === 0 ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Belum ada aktivitas di {days} hari terakhir</p>
          {/* Dinyatakan sebagai keadaan, bukan sebagai kegagalan — dan menawarkan
              periode yang lebih panjang alih-alih membiarkan layar kosong. */}
          <p className="dv2-state-body">Coba periode yang lebih panjang, atau tunggu pesanan masuk.</p>
          {days !== 90 && (
            <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor(mode, 90)}>
              Lihat 90 hari
            </Link>
          )}
        </div>
      ) : (
        <>
          {mode === "penjualan" && (
            <section className="dv2-report" aria-label="Penjualan">
              <div className="dv2-figs">
                {/* Uang yang DITERIMA, bukan yang dipesan: pesanan belum bayar
                    bukan omzet, dan menjumlahkannya membuat laporan selalu
                    lebih besar dari isi laci. */}
                <Figure value={formatRupiah(page.paidRevenue)} label={`Diterima · ${page.paidCount} pesanan lunas`} />
                <Figure value={String(page.completedCount)} label="Pesanan selesai" />
                <Figure
                  value={formatRupiah(page.paidCount ? Math.round(page.paidRevenue / page.paidCount) : 0)}
                  label="Rata-rata per pesanan lunas"
                />
              </div>

              <Panel title="Omzet harian" note="hanya pesanan yang sudah dibayar">
                <BarSeries
                  label={`Omzet harian ${days} hari terakhir`}
                  points={revenueSeries}
                  caption={describePeak(revenueSeries, "rupiah")}
                  format={formatRupiah}
                />
              </Panel>
            </section>
          )}

          {mode === "tamu" && (
            <section className="dv2-report" aria-label="Perilaku tamu">
              <Panel
                title="Dari membuka menu sampai memesan"
                note="wilayah yang tidak direkam POS mana pun"
              >
                <div className="dv2-funnel">
                  {buildFunnel(page.events).map((s) => (
                    <div className="dv2-funnel-row" key={s.label}>
                      <span className="dv2-funnel-label">{s.label}</span>
                      <span
                        className="dv2-funnel-bar"
                        style={{ width: `${Math.max(2, s.ratio * 100)}%` }}
                        aria-hidden="true"
                      />
                      <span className="dv2-funnel-value">{s.value.toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                </div>
                <p className="dv2-chart-caption">{describeFunnel(buildFunnel(page.events))}</p>
              </Panel>

              <Panel title="Menu dibuka per hari" note="tiap kali tamu membuka daftar menu">
                <BarSeries
                  label="Menu dibuka per hari"
                  points={openSeries}
                  caption={describePeak(openSeries, "count")}
                  format={(n) => n.toLocaleString("id-ID")}
                />
              </Panel>
            </section>
          )}

          {mode === "menu" && (
            <section className="dv2-report" aria-label="Menu">
              <Panel title="Menu teratas" note="dihitung dari isi pesanan, bukan dari harga hari ini">
                <div className="dv2-table" role="table" aria-label="Menu teratas">
                  <div className="dv2-row dv2-row-head" role="row">
                    <span className="dv2-col-menu">Menu</span>
                    <span className="dv2-col-num">Terjual</span>
                    <span className="dv2-col-price">Rp</span>
                    <span className="dv2-col-num">% omzet</span>
                  </div>
                  {tally.map((m) => (
                    <div className="dv2-row" role="row" key={m.name}>
                      <span className="dv2-col-menu">{m.name}</span>
                      <span className="dv2-col-num">{m.qty}</span>
                      <span className="dv2-col-price">{m.revenue.toLocaleString("id-ID")}</span>
                      <span className="dv2-col-num">{(m.share * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          )}

          {mode === "pajak" && <TaxPanel tax={page.tax} />}
        </>
      )}
    </OwnerShell>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="dv2-fig">{value}</div>
      <div className="dv2-sub">{label}</div>
    </div>
  );
}

/** Panel selalu punya judul DAN satu baris penjelas.
 *
 *  Subjudul itu memberi tahu CAKUPAN angkanya tanpa tooltip — pelajaran yang
 *  dicatat dari Efferd dan tidak pernah dipasang sampai sekarang. */
function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dv2-panel">
      <header className="dv2-panel-head">
        <h2 className="dv2-panel-title">{title}</h2>
        <p className="dv2-panel-note">{note}</p>
      </header>
      {children}
    </section>
  );
}

function TaxPanel({ tax }: { tax: TaxSummary }) {
  const t = tax;
  return (
    <section className="dv2-report" aria-label="Pajak">
      <div className="dv2-figs">
        <Figure value={formatRupiah(t.tax)} label="Pajak terkumpul" />
        <Figure value={formatRupiah(t.service)} label="Service charge" />
        <Figure value={formatRupiah(t.subtotal)} label="Dasar pengenaan" />
      </div>

      <Panel title="Rincian" note="diambil dari potret tarif tiap pesanan, bukan tarif hari ini">
        <div className="dv2-table" role="table" aria-label="Rincian pajak">
          <div className="dv2-row" role="row">
            <span className="dv2-col-menu">Subtotal seluruh pesanan</span>
            <span className="dv2-col-price">{t.subtotal.toLocaleString("id-ID")}</span>
          </div>
          <div className="dv2-row" role="row">
            <span className="dv2-col-menu">Service charge</span>
            <span className="dv2-col-price">{t.service.toLocaleString("id-ID")}</span>
          </div>
          <div className="dv2-row" role="row">
            <span className="dv2-col-menu">Pajak</span>
            <span className="dv2-col-price">{t.tax.toLocaleString("id-ID")}</span>
          </div>
          <div className="dv2-row dv2-row-foot" role="row">
            <span className="dv2-col-menu">Total dibayar tamu</span>
            <span className="dv2-col-price">{t.total.toLocaleString("id-ID")}</span>
          </div>
        </div>
      </Panel>

      {t.untaxedOrders > 0 && (
        /* Bukan peringatan yang menakut-nakuti, tapi angka yang bisa dicek:
           berapa pesanan yang dihitung tanpa tarif sama sekali. */
        <p className="dv2-note">
          {t.untaxedOrders} dari {t.orders} pesanan dihitung dengan pajak 0%. Kalau kafemu terutang
          PBJT, tarifnya perlu diisi di Pengaturan — pesanan lama tetap memakai tarif saat itu.
        </p>
      )}
    </section>
  );
}
