import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet, Receipt, TrendingUp, Package } from "lucide-react";
import { getRevenueData, getOwnerCafeSlug, getSessionUserId } from "@/lib/analytics";
import { formatRupiah } from "@/lib/format";
import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import DonutChart from "@/components/dashboard/DonutChart";

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-4" style={{ color: "#5A7898" }}>
      {children}
    </h2>
  );
}

const PANEL = { background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" } as const;

export default async function RevenuePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const slug = await getOwnerCafeSlug(userId);
  const data = slug ? await getRevenueData(slug) : null;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2 text-center px-6">
        <p className="font-semibold" style={{ color: "#E9EEF6" }}>Belum ada data penjualan</p>
        <p className="text-sm" style={{ color: "#5A7898" }}>Pesanan yang masuk akan muncul di sini.</p>
      </div>
    );
  }

  const { totalRevenue, orderCount, avgOrder, itemsSold, revenueDelta, dailyRevenue, statusCounts, topByRevenue, recentOrders } = data;
  const maxItemRev = Math.max(1, ...topByRevenue.map((d) => d.revenue));

  return (
    <div className="p-5 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-7 dash-reveal">
        <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>Penjualan</h1>
        <p className="text-sm mt-1" style={{ color: "#5A7898" }}>
          Ringkasan pendapatan 14 hari terakhir · {orderCount.toLocaleString("id-ID")} pesanan
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5 dash-reveal dash-d1">
        <StatCard value={totalRevenue} prefix="Rp " label="Total Pendapatan" icon={<Wallet size={17} strokeWidth={2} />} accent="#22D3A6" accentBg="rgba(34,211,166,0.12)" delta={revenueDelta} />
        <StatCard value={orderCount} label="Jumlah Pesanan" icon={<Receipt size={17} strokeWidth={2} />} accent="#9FB6D1" accentBg="rgba(159,182,209,0.12)" sub="14 hari terakhir" />
        <StatCard value={avgOrder} prefix="Rp " label="Rata-rata / Pesanan" icon={<TrendingUp size={17} strokeWidth={2} />} accent="#FD5002" accentBg="rgba(253,80,2,0.12)" sub="nilai per transaksi" />
        <StatCard value={itemsSold} label="Item Terjual" icon={<Package size={17} strokeWidth={2} />} accent="#00C2A8" accentBg="rgba(0,194,168,0.12)" sub="total porsi" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5 dash-reveal dash-d2">
        <section className="lg:col-span-2 rounded-2xl p-5" style={PANEL}>
          <SectionLabel>Pendapatan Harian</SectionLabel>
          <RevenueChart data={dailyRevenue} />
        </section>
        <section className="rounded-2xl p-5 flex flex-col" style={PANEL}>
          <SectionLabel>Status Pesanan</SectionLabel>
          <div className="flex-1 flex items-center">
            <DonutChart
              centerLabel="Pesanan"
              segments={[
                { label: "Baru", value: statusCounts.received, color: "#FD5002" },
                { label: "Diproses", value: statusCounts.preparing, color: "#F59E0B" },
                { label: "Siap", value: statusCounts.ready, color: "#22D3A6" },
              ]}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 dash-reveal dash-d3">
        <section className="lg:col-span-2 rounded-2xl p-5" style={PANEL}>
          <SectionLabel>Menu Penyumbang Pendapatan</SectionLabel>
          {topByRevenue.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "#5A7898" }}>Belum ada penjualan.</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[20px_1fr_auto] gap-3 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>
                <span>#</span><span>Menu</span><span className="text-right">Qty · Pendapatan</span>
              </div>
              {topByRevenue.map((d, i) => (
                <div key={i} className="grid grid-cols-[20px_1fr_auto] gap-3 items-center px-2 py-2 rounded-lg" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                  <span className="text-xs font-bold tabular-nums" style={{ color: i === 0 ? "#FD5002" : "#5A7898" }}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#E9EEF6" }}>{d.name}</p>
                    <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(d.revenue / maxItemRev) * 100}%`, background: "#22D3A6" }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right tabular-nums">
                    <span className="text-xs" style={{ color: "#5A7898" }}>{d.qty}×</span>
                    <span className="text-xs font-semibold" style={{ color: "#22D3A6" }}>{formatRupiah(d.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl p-5" style={PANEL}>
          <SectionLabel>Pesanan Terbaru</SectionLabel>
          {recentOrders.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "#5A7898" }}>Belum ada pesanan.</p>
          ) : (
            <ul className="space-y-3">
              {recentOrders.map((o, i) => {
                const s = STATUS_LABEL[o.status] ?? { l: o.status, c: "#5A7898" };
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.c }} />
                    <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "#9FB6D1" }}>
                      <span style={{ color: "#E9EEF6", fontWeight: 500 }}>Meja {o.table}</span> · {formatRupiah(o.total)}
                    </span>
                    <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "#5A7898" }}>{relTime(o.at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
