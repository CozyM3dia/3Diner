import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet, Receipt, TrendingUp, Package } from "lucide-react";
import { getRevenueData } from "@/lib/analytics";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { formatRupiah } from "@/lib/format";
import RevenueChart from "@/components/dashboard/RevenueChart";
import DonutChart from "@/components/dashboard/DonutChart";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import ExportReport from "@/components/dashboard/ExportReport";
import {
  DashboardMetric,
  DashboardPageHeader,
  DashboardPanel,
  StatusBadge,
  type StatusKind,
} from "@/components/dashboard/system";

export const metadata: Metadata = { title: "Penjualan · Dashboard | 3Diner" };

function relTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

const STATUS_KIND: Record<string, StatusKind> = {
  received: "order-received",
  preparing: "order-preparing",
  ready: "order-ready",
  completed: "order-completed",
  cancelled: "order-cancelled",
};

interface PageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function RevenuePage({ searchParams }: PageProps) {
  const { start, end } = await searchParams;
  const { userId, slug } = await getDashboardCafeContext();
  if (!userId) redirect("/login");

  const data = slug ? await getRevenueData(slug, start, end) : null;

  const actions = (
    <>
      <ExportReport start={start} end={end} />
      <DateRangePicker initialStart={start} initialEnd={end} />
    </>
  );

  if (!data) {
    return (
      <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
        <DashboardPageHeader
          title="Penjualan"
          subtitle="Belum ada data penjualan pada rentang terpilih."
          actions={actions}
        />
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
      <DashboardPageHeader title="Penjualan" subtitle={subtitleLabel} actions={actions} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 dash-reveal dash-d1">
        <DashboardMetric value={totalRevenue} prefix="Rp " label="Total Pendapatan" icon={<Wallet size={15} strokeWidth={2} />} accent="#22D3A6" accentBg="rgba(34,211,166,0.12)" delta={start || end ? undefined : revenueDelta} />
        <DashboardMetric value={orderCount} label="Jumlah Pesanan" icon={<Receipt size={15} strokeWidth={2} />} accent="#9FB6D1" accentBg="rgba(159,182,209,0.12)" sub={start || end ? "Rentang terpilih" : "14 hari terakhir"} />
        <DashboardMetric value={avgOrder} prefix="Rp " label="Rata-rata / Pesanan" icon={<TrendingUp size={15} strokeWidth={2} />} accent="#FD5002" accentBg="rgba(253,80,2,0.12)" sub="nilai per transaksi" />
        <DashboardMetric value={itemsSold} label="Item Terjual" icon={<Package size={15} strokeWidth={2} />} accent="#00C2A8" accentBg="rgba(0,194,168,0.12)" sub="total porsi" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 dash-reveal dash-d2">
        <DashboardPanel title="Pendapatan Harian" className="lg:col-span-2">
          <RevenueChart data={dailyRevenue} />
        </DashboardPanel>
        <DashboardPanel title="Status &amp; Pembayaran" bodyClassName="dash-panel-body flex flex-col gap-5">
          <div className="flex items-center justify-center">
            <DonutChart
              centerLabel="Pesanan"
              segments={[
                { label: "Baru", value: statusCounts.received, color: "#FD5002" },
                { label: "Diproses", value: statusCounts.preparing, color: "#F59E0B" },
                { label: "Siap", value: statusCounts.ready, color: "#22D3A6" },
                /* Dua status terminal berbagi satu abu netral, bukan dapat hue
                   sendiri-sendiri: donut ini sudah memakai tiga hue, dan
                   menambah dua lagi membuat tidak ada yang menonjol. */
                { label: "Selesai", value: statusCounts.completed, color: "#9FB6D1" },
                { label: "Dibatalkan", value: statusCounts.cancelled, color: "#5A7898" },
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
                  { label: "GoPay", value: paymentCounts.gopay, color: "#38BDF8" },
                  { label: "ShopeePay", value: paymentCounts.shopeepay, color: "#FB7185" },
                  { label: "Transfer Bank", value: paymentCounts.bank_transfer, color: "#A78BFA" },
                  { label: "Belum Bayar", value: paymentCounts.unpaid, color: "#5A7898" },
                ]}
              />
            </div>
          </div>
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 dash-reveal dash-d3">
        <DashboardPanel title="Menu Penyumbang Pendapatan" className="lg:col-span-2">
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
        </DashboardPanel>

        <DashboardPanel title="Pesanan Terbaru">
          {recentOrders.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--dash-muted)" }}>Belum ada pesanan.</p>
          ) : (
            <ul className="space-y-3">
              {recentOrders.map((o, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <StatusBadge kind={STATUS_KIND[o.status] ?? "pay-unpaid"} label={STATUS_KIND[o.status] ? undefined : o.status} />
                  <span className="text-sm flex-1 min-w-0 truncate tabular-nums" style={{ color: "var(--dash-secondary)" }}>
                    <span style={{ color: "var(--dash-text)", fontWeight: 500 }}>Meja {o.table}</span> · {formatRupiah(o.total)}
                  </span>
                  <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--dash-muted)" }}>{relTime(o.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
