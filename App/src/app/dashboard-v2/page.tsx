import Link from "next/link";
import { EuroIcon, ReceiptTextIcon, FlameIcon, EyeIcon } from "lucide-react";
import "./beranda.css";
import { getStaffContext } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHomeData, type HomeFigure } from "@/lib/dashboard-v2-home";
import { formatRupiah } from "@/lib/format";
import { describePeak, type DailyPoint } from "@/lib/dashboard-v2-reports";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";
import BarSeries from "@/components/dashboard-v2/BarSeries";

export const dynamic = "force-dynamic";

const KPI_ICONS = [EuroIcon, ReceiptTextIcon, FlameIcon, EyeIcon];
const KPI_TONES = ["var(--orange)", "var(--semantic-teal)", "var(--semantic-warning)", "var(--dash-secondary)"];

function KpiCard({
  figure,
  Icon,
  tone,
}: {
  figure: HomeFigure;
  Icon: typeof EuroIcon;
  tone: string;
}) {
  // Arah delta ditentukan dari kata pembanding yang sudah dihitung lib —
  // bukan dari menebak tanda angka.
  const turun = figure.comparison.startsWith("−");
  const naik = figure.comparison.startsWith("+");
  return (
    <div className="home-kpi">
      <span
        className="home-kpi-icon"
        style={{ "--pill-c": tone } as React.CSSProperties}
        aria-hidden="true"
      >
        <Icon size={18} />
      </span>
      <div>
        <div className="home-kpi-num">
          {figure.label.endsWith("Rp") ? formatRupiah(figure.value ?? 0) : (figure.value ?? 0)}
        </div>
        <div className="home-kpi-label">{figure.label.replace(" · Rp", "")}</div>
        <div
          className="home-kpi-delta"
          style={{ "--delta-c": turun ? "var(--semantic-danger)" : naik ? "var(--semantic-success)" : undefined } as React.CSSProperties}
        >
          {figure.comparison}
        </div>
      </div>
    </div>
  );
}

/** Beranda Konsol Owner — kelas operasional dengan bentuk Dashboard Dream POS:
 *  strip KPI ber-icon di atas, lalu grid kartu (tren, terlaris, antrean, tugas).
 *
 *  Pertanyaan yang dijawab tetap sama: "Apa yang perlu saya urus?" — kartu-kartu
 *  hanya mengubah cara membacanya, bukan apa yang boleh dilakukan di sini. */
export default async function OwnerHomePage() {
  const ctx = await getStaffContext();
  const cafeId = ctx.cafe_id ?? null;
  const data = await getHomeData(cafeId);
  const report = await loadHomeReport(cafeId);

  const belumPernahJualan = !data.everSoldAnything;

  // Pesanan tertua yang masih menunggu diterima — angka umurnya yang membuat
  // ringkasan ini punya urgensi, bukan sekadar empat kotak angka.
  const queue = await getQueueSummary(cafeId);

  return (
    <OwnerShell
      title="Beranda"
      badges={{ "/dashboard-v2": data.tasks.length + data.hiddenTasks }}
      right={<span className="dv2-sub">{ctx.cafe_name ?? "Kafe"}</span>}
    >
      {belumPernahJualan ? (
        <section className="dv2-state">
          <p className="dv2-state-title">Kafemu belum menerima pesanan</p>
          <p className="dv2-state-body">
            Tiga langkah tersisa: isi menu, cetak QR meja, tempel di meja.
          </p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href="/dashboard-v2/menu">
            Lanjutkan penyiapan
          </Link>
        </section>
      ) : (
        <>
          {/* ── Strip KPI ala template: icon tinted + angka + delta ── */}
          {data.figures === null ? (
            <section className="dv2-state">
              <p className="dv2-state-title">Angka hari ini tidak bisa dibaca</p>
              <p className="dv2-state-body">{data.figuresError ?? "Sebab tidak diketahui."}</p>
            </section>
          ) : (
            <div className="home-kpis">
              {data.figures.map((f, i) => (
                <KpiCard key={f.label} figure={f} Icon={KPI_ICONS[i] ?? EyeIcon} tone={KPI_TONES[i] ?? "var(--dash-secondary)"} />
              ))}
            </div>
          )}

          <div className="home-grid">
            {/* ── Tren pendapatan (padanan Total Revenue chart template) ── */}
            {report.dailyRevenue.length > 0 && (
              <section className="home-card" aria-label="Tren pendapatan 7 hari terakhir">
                <h3 className="home-card-title">Tren Pendapatan · 7 Hari</h3>
                <BarSeries
                  points={report.dailyRevenue}
                  caption={describePeak(report.dailyRevenue, "rupiah")}
                  format={(v) => formatRupiah(v)}
                  label="Grafik batang pendapatan harian"
                />
              </section>
            )}

            {/* ── Menu Terlaris (padanan Top Selling Item template) ── */}
            {report.topMenus.length > 0 && (
              <section className="home-card" aria-label="Menu terlaris">
                <h3 className="home-card-title">Menu Terlaris</h3>
                <div style={{ display: "grid", gap: "var(--dv2-space-4)" }}>
                  {report.topMenus.map((m, i) => (
                    <div className="home-top-item" key={m.name}>
                      <span className="home-top-name">{`${i + 1}. ${m.name}`}</span>
                      <span className="home-top-qty">{m.qty}× terjual</span>
                      {/* Bar porsi relatif: tinggi baris sama, lebar bercerita. */}
                      <span className="home-top-bar" aria-hidden="true">
                        <span style={{ width: `${Math.max(6, (m.qty / report.topMenus[0].qty) * 100)}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Ringkasan Antrean (padanan Active Orders; READ-ONLY) ── */}
            <section className="home-card" aria-label="Ringkasan antrean dapur">
              <h3 className="home-card-title">Antrean Dapur Sekarang</h3>
              {queue === null ? (
                <p className="dv2-sub">Antrean tidak bisa dibaca saat ini.</p>
              ) : (
                <>
                  <div className="home-queue-stats">
                    <div className="home-queue-stat">
                      <b>{queue.received + queue.preparing + queue.ready}</b>
                      <span>pesanan berjalan</span>
                    </div>
                    <div className="home-queue-stat">
                      <b>{queue.ready}</b>
                      <span>siap diantar</span>
                    </div>
                    <div className="home-queue-stat">
                      <b>{queue.oldestMinutes ?? "—"}</b>
                      <span>menit · tertua belum diterima</span>
                    </div>
                  </div>
                  <p className="home-queue-old">
                    Pemrosesan status tetap di Kasir — layar ini hanya membaca.
                  </p>
                  <div className="home-queue-cta">
                    <Link className="dv2-btn dv2-btn-solid" href="/kasir">
                      Buka Kasir
                    </Link>
                  </div>
                </>
              )}
            </section>

            {/* ── Perlu diurus (task list existing, bentuk kartu) ── */}
            <section className="dv2-group" aria-label="Perlu diurus">
              <div className="dv2-ghd">
                <span>
                  Perlu diurus <b>{data.tasks.length + data.hiddenTasks}</b>
                </span>
                <span className="dv2-ghd-note">
                  hal yang belum diputuskan · bukan ringkasan
                </span>
              </div>

              {data.tasks.length === 0 ? (
                <div className="dv2-state">
                  {/* Kabar baik tanpa CTA — tombol di sini membatalkan kabarnya. */}
                  <p className="dv2-state-title">Tidak ada yang perlu diurus</p>
                  <p className="dv2-state-body">Stok, menu, dan pengaturan semuanya aman.</p>
                </div>
              ) : (
                <>
                  {data.tasks.map((t) => (
                    <div className="dv2-row" key={t.id}>
                      <span className="dv2-kind">{t.kind}</span>
                      <span className="dv2-text" title={t.text}>
                        {t.text}
                      </span>
                      <span className="dv2-state-chip">{t.state}</span>
                      <Link className="dv2-btn dv2-btn-solid" href={t.href}>
                        {t.actionLabel}
                      </Link>
                    </div>
                  ))}
                  {data.hiddenTasks > 0 && (
                    <p className="dv2-more">
                      {data.hiddenTasks} hal lain menunggu, ditahan supaya tiga teratas tetap
                      terbaca sekilas.
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </OwnerShell>
  );
}

/* ── Pengambil data tambahan (server-only), dibungkus agar halaman tetap tipis ── */

/** Deret harian + menu terlaris untuk dua widget Beranda.
 *
 *  `perItem` dari report_analytics SUDAH berupa agregasi qty per menu di
 *  Postgres — diurutkan server-side, jadi cukup ambil lima teratas.
 *  Label tanggal dibuat di sini karena BarSeries menampilkannya per batang. */
async function loadHomeReport(cafeId: string | null): Promise<{
  dailyRevenue: DailyPoint[];
  topMenus: { name: string; qty: number }[];
}> {
  if (!cafeId) return { dailyRevenue: [], topMenus: [] };
  try {
    const page = await import("@/lib/dashboard-v2-reports").then((m) =>
      m.getReportPage(cafeId, 7),
    );
    return {
      dailyRevenue: page.dailyRevenue.map((d) => ({
        ...d,
        label: `${d.day.slice(8)}/${d.day.slice(5, 7)}`,
      })),
      topMenus: page.perItem
        .slice()
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)
        .map((p) => ({ name: p.name, qty: p.qty })),
    };
  } catch {
    // Widget grafik boleh kosong saat sumbernya gagal; kegagalan diam-diam
    // lebih baik daripada membiarkan seluruh Beranda mati karena satu kartu.
    return { dailyRevenue: [], topMenus: [] };
  }
}

interface QueueSummary {
  received: number;
  preparing: number;
  ready: number;
  /** Umur pesanan tertua yang belum diterima, dalam menit. */
  oldestMinutes: number | null;
}

/** Ringkasan antrean dapur — BACA SAJA.
 *
 *  Angkanya dihitung dari baris Orders langsung; tidak ada fungsi mutasi yang
 *  lewat sini, sesuai kontrak §5.2 (kasir satu-satunya pengubah status). */
async function getQueueSummary(cafeId: string | null): Promise<QueueSummary | null> {
  if (!cafeId) return null;
  const { data, error } = await supabaseAdmin
    .from("Orders")
    .select("status,created_at")
    .eq("cafe_id", cafeId)
    .in("status", ["received", "preparing", "ready"]);
  if (error || !data) return null;

  let received = 0;
  let preparing = 0;
  let ready = 0;
  let oldestMs = Infinity;
  for (const o of data as { status: string; created_at: string }[]) {
    if (o.status === "received") {
      received += 1;
      oldestMs = Math.min(oldestMs, Date.now() - new Date(o.created_at).getTime());
    } else if (o.status === "preparing") preparing += 1;
    else if (o.status === "ready") ready += 1;
  }
  return {
    received,
    preparing,
    ready,
    oldestMinutes: Number.isFinite(oldestMs) ? Math.max(1, Math.round(oldestMs / 60000)) : null,
  };
}
