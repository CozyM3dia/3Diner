import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet, Receipt, TrendingUp, Package } from "lucide-react";
import { getRevenueData, getOwnerCafeSlug, getSessionUserId } from "@/lib/analytics";
import { formatRupiah } from "@/lib/format";
import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import DonutChart from "@/components/dashboard/DonutChart";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import ExportReport from "@/components/dashboard/ExportReport";

export const metadata: Metadata = { title: "Penjualan · Dashboard | 3Diner" };
export const dynamic = "force-dynamic";

function relTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  received: { l: "Baru", c: "#FD5002" },
  preparing: { l: "Diproses", c: "#F59E0B" },
  ready: { l: "Siap", c: "#22D3A6" },
};

interface PageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function RevenuePage({ searchParams }: PageProps) {
  const { start, end } = await searchParams;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const slug = await getOwnerCafeSlug(userId);
  const data = slug ? await getRevenueData(slug, start, end) : null;

  if (!data) {
    return (
      <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--dash-text)" }}>Penjualan</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>Belum ada data penjualan pada rentang terpilih.</p>
          </div>
          <div className="shrink-0 flex items-center gap-2.5">
            <ExportReport start={start} end={end} />
            <DateRangePicker initialStart={start} initialEnd={end} />
          </div>
        </div>
        <div className="dash-panel flex flex-col items-center justify-center min-h-[40vh] gap-2 text-center px-6">
          <p className="font-semibold" style={{ color: "var(--dash-text)" }}>Belum ada data penjualan</p>
          <p className="text-sm" style={{ color: "var(--dash-muted)" }}>Pesanan yang masuk akan muncul di sini.</p>
        </div>
      </div>
    );
  }

  const { totalRevenue, orderCount, avgOrder, itemsSold, revenueDelta, dailyRevenue, statusCounts, paymentCounts, topByRevenue, recentOrders } = data;
  const maxItemRev = Math.max(1, ...topByRevenue.map((d) => d.revenue));

  // Dynamically generate subtitle text based on active range
  const subtitleLabel = (() => {
    if (start && end) {
      const s = new Date(start).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      const e = new Date(end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      return `Ringkasan pendapatan ${s} - ${e} · ${orderCount.toLocaleString("id-ID")} pesanan`;
    }
    if (start) {
      const s = new Date(start).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      return `Ringkasan pendapatan sejak ${s} · ${orderCount.toLocaleString("id-ID")} pesanan`;
    }
    if (end) {
      const e = new Date(end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      return `Ringkasan pendapatan hingga ${e} · ${orderCount.toLocaleString("id-ID")} pesanan`;
    }
    return `Ringkasan pendapatan 14 hari terakhir · ${orderCount.toLocaleString("id-ID")} pesanan`;
  })();

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 dash-reveal">
        <div>
          <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--dash-text)" }}>Penjualan</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>
            {subtitleLabel}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2.5">
          <ExportReport start={start} end={end} />
          <DateRangePicker initialStart={start} initialEnd={end} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 dash-reveal dash-d1">
        <StatCard value={totalRevenue} prefix="Rp " label="Total Pendapatan" icon={<Wallet size={15} strokeWidth={2} />} accent="#22D3A6" accentBg="rgba(34,211,166,0.12)" delta={start || end ? undefined : revenueDelta} />
        <StatCard value={orderCount} label="Jumlah Pesanan" icon={<Receipt size={15} strokeWidth={2} />} accent="#9FB6D1" accentBg="rgba(159,182,209,0.12)" sub={start || end ? "Rentang terpilih" : "14 hari terakhir"} />
        <StatCard value={avgOrder} prefix="Rp " label="Rata-rata / Pesanan" icon={<TrendingUp size={15} strokeWidth={2} />} accent="#FD5002" accentBg="rgba(253,80,2,0.12)" sub="nilai per transaksi" />
        <StatCard value={itemsSold} label="Item Terjual" icon={<Package size={15} strokeWidth={2} />} accent="#00C2A8" accentBg="rgba(0,194,168,0.12)" sub="total porsi" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 dash-reveal dash-d2">
        <section className="lg:col-span-2 dash-panel">
          <div className="dash-panel-head">Pendapatan Harian</div>
          <div className="dash-panel-body">
            <RevenueChart data={dailyRevenue} />
          </div>
        </section>
        <section className="dash-panel">
          <div className="dash-panel-head">Status &amp; Pembayaran</div>
          <div className="dash-panel-body flex flex-col gap-5">
            <div className="flex items-center justify-center">
              <DonutChart
                centerLabel="Pesanan"
                segments={[
                  { label: "Baru", value: statusCounts.received, color: "#FD5002" },
                  { label: "Diproses", value: statusCounts.preparing, color: "#F59E0B" },
                  { label: "Siap", value: statusCounts.ready, color: "#22D3A6" },
                ]}
              />
            </div>
            <div style={{ borderTop: "1px solid var(--dash-border)", paddingTop: "18px" }}>
              <div className="flex items-center justify-center">
                <DonutChart
                  centerLabel="Transaksi"
                  segments={[
                    { label: "Tunai (Cash)", value: paymentCounts.cash, color: "#22D3A6" },
                    { label: "QRIS", value: paymentCounts.qris, color: "#00C2A8" },
                    { label: "Belum Bayar", value: paymentCounts.unpaid, color: "#5A7898" },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 dash-reveal dash-d3">
        <section className="lg:col-span-2 dash-panel">
          <div className="dash-panel-head">Menu Penyumbang Pendapatan</div>
          <div className="dash-panel-body">
            {topByRevenue.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--dash-muted)" }}>Belum ada penjualan.</p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[20px_1fr_auto] gap-3 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--dash-muted)" }}>
                  <span>#</span><span>Menu</span><span className="text-right">Qty · Pendapatan</span>
                </div>
                {topByRevenue.map((d, i) => (
                  <div key={i} className="grid grid-cols-[20px_1fr_auto] gap-3 items-center px-2 py-2 rounded-lg" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                    <span className="text-xs font-bold tabular-nums" style={{ color: i === 0 ? "#FD5002" : "var(--dash-muted)" }}>{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--dash-text)" }}>{d.name}</p>
                      <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(d.revenue / maxItemRev) * 100}%`, background: "#22D3A6" }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right tabular-nums">
                      <span className="text-xs" style={{ color: "var(--dash-muted)" }}>{d.qty}×</span>
                      <span className="text-xs font-semibold" style={{ color: "#22D3A6" }}>{formatRupiah(d.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel-head">Pesanan Terbaru</div>
          <div className="dash-panel-body">
            {recentOrders.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--dash-muted)" }}>Belum ada pesanan.</p>
            ) : (
              <ul className="space-y-3">
                {recentOrders.map((o, i) => {
                  const s = STATUS_LABEL[o.status] ?? { l: o.status, c: "#5A7898" };
                  return (
                    <li key={i} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.c }} />
                      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--dash-secondary)" }}>
                        <span style={{ color: "var(--dash-text)", fontWeight: 500 }}>Meja {o.table}</span> · {formatRupiah(o.total)}
                      </span>
                      <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--dash-muted)" }}>{relTime(o.at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
