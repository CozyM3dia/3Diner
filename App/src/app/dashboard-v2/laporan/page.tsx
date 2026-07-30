import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";
import { formatRupiah } from "@/lib/format";
import {
  buildDailySeries,
  buildFunnel,
  buildLedger,
  completedOrders,
  type LedgerRow,
  describeFunnel,
  describePeak,
  getReportPage,
  MODE_LABEL,
  paidOrders,
  parseMode,
  parsePeriod,
  PERIODS,
  REPORT_MODES,
  summarizeTax,
  tallyMenus,
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

  const paid = paidOrders(page.orders);
  const done = completedOrders(page.orders);

  // Deret dihitung sekali, dipakai untuk grafik DAN untuk kalimatnya — kalau
  // dihitung dua kali, keduanya bisa menyimpulkan puncak yang berbeda.
  const revenueSeries = buildDailySeries(
    paid.map((o) => ({ created_at: o.created_at, value: o.total })),
    days
  );
  const openSeries = buildDailySeries(
    page.openTimestamps.map((t) => ({ created_at: t, value: 1 })),
    days
  );

  return (
    <OwnerShell
      title="Laporan"
      note="Hanya pesanan yang sudah dibayar yang dihitung — pesanan belum lunas bukan omzet."
      cafe={ctx.cafe_name ?? "Kafe"}
      right={<span className="dv2-sub">{days} hari terakhir</span>}
    >
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
      ) : page.orders.length === 0 && page.events.open === 0 ? (
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
              {/* Buku besar, bukan tiga kartu angka.
                  Uang yang DITERIMA, bukan yang dipesan: pesanan belum bayar
                  bukan omzet, dan menjumlahkannya membuat laporan selalu lebih
                  besar dari isi laci. Lalu turun sampai bagian yang benar-benar
                  tinggal di kafe — pajak dan service charge memang masuk ke
                  laci, tapi keduanya terutang ke pihak lain. */}
              <Panel
                title="Dari yang masuk sampai yang tinggal"
                note={
                  paid.length
                    ? `${days} hari terakhir · rata-rata ${formatRupiah(
                        Math.round(paid.reduce((s, o) => s + o.total, 0) / paid.length)
                      )} per pesanan lunas`
                    : `${days} hari terakhir · belum ada pesanan lunas`
                }
              >
                <Ledger rows={buildLedger(summarizeTax(paid))} />
              </Panel>

              <Panel
                title="Omzet harian"
                note={`hanya pesanan yang sudah dibayar · ${done.length} pesanan selesai di periode ini`}
              >
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
                  {tallyMenus(page.orders).map((m) => (
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

          {mode === "pajak" && <TaxPanel orders={page.orders} />}
        </>
      )}
    </OwnerShell>
  );
}

/** Buku besar — deret pengurangan bernama, bukan deret kartu.
 *
 *  Potongan ditulis dalam kurung DAN diberi nada, dua penyandian untuk satu
 *  arti: konvensi akuntansi diambil dari `tantri/summary-report-per-shift`,
 *  dan penyandian gandanya memenuhi §1.3 — dicetak hitam-putih, tanda kurung
 *  tetap memberi tahu mana yang mengurangi.
 *
 *  Keterangan tiap baris menempel di bawah labelnya, bukan di tooltip: ambang
 *  yang disembunyikan di balik sentuhan membuat layar tidak bisa dipindai,
 *  dan itu jebakan yang terlihat langsung di `tantri/daftar-stok`. */
function Ledger({ rows }: { rows: LedgerRow[] }) {
  return (
    <dl className="dv2-ledger">
      {rows.map((r) => (
        <div
          className="dv2-ledger-row"
          key={r.label}
          data-total={r.total ? "true" : undefined}
        >
          <dt className="dv2-ledger-label">
            {r.label}
            {r.note ? <span className="dv2-ledger-note">{r.note}</span> : null}
          </dt>
          <dd className="dv2-ledger-value" data-tone={r.deduction ? "deduction" : undefined}>
            {r.deduction ? `(${formatRupiah(r.value)})` : formatRupiah(r.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Satu kolom di pita angka.
 *
 *  Angka dulu, keterangannya di bawah — urutan dari wireframe v3 yang sudah
 *  disetujui. Pemisah antar kolom adalah rule vertikal dari `.dv2-fig-cell`,
 *  bukan bingkai: tiga kartu berbingkai terbaca sebagai tiga objek yang
 *  saling berebut, satu pita bergaris terbaca sebagai satu pita berkolom. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="dv2-fig-cell">
      <div className="dv2-fig">{value}</div>
      <div className="dv2-fig-meta" title={label}>
        {label}
      </div>
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

function TaxPanel({ orders }: { orders: Parameters<typeof summarizeTax>[0] }) {
  const t = summarizeTax(orders);
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
