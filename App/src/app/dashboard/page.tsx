import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MousePointerClick,
  Box,
  ShoppingBag,
  Target,
  Clock,
  Flame,
  CalendarDays,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { getDashboardData, type EventType } from "@/lib/analytics";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { getDashboardInventoryDataForSlug } from "@/lib/dashboard-inventory";
import { getTodayOps } from "@/lib/dashboard-today";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { DashboardMetric, DashboardPageHeader, DashboardPanel } from "@/components/dashboard/system";
import LineChart from "@/components/dashboard/LineChart";
import FunnelBars from "@/components/dashboard/FunnelBars";
import HeatmapGrid from "@/components/dashboard/HeatmapGrid";
import DonutChart from "@/components/dashboard/DonutChart";
import WeekdayBars from "@/components/dashboard/WeekdayBars";
import InventoryWorkspace from "@/components/dashboard/InventoryWorkspace";

export const metadata: Metadata = { title: "Analitik · Dashboard | 3Diner" };

const EVENT_LABEL: Record<EventType, string> = {
  click_menu: "Buka menu",
  view_3d: "Lihat 3D",
  click_order: "Mulai pesan",
};
const EVENT_COLOR: Record<EventType, string> = {
  click_menu: "#5A7898",
  view_3d: "#00C2A8",
  click_order: "#FD5002",
};
const WEEKDAY_FULL = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

interface PageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const { start, end } = await searchParams;
  const { userId, slug } = await getDashboardCafeContext();
  if (!userId) redirect("/login");

  const [data, inventory, today] = slug
    ? await Promise.all([
        getDashboardData(slug, start, end),
        getDashboardInventoryDataForSlug(slug),
        getTodayOps(slug),
      ])
    : [null, await getDashboardInventoryDataForSlug(null), await getTodayOps(null)];

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2 text-center px-6">
        <p className="font-semibold" style={{ color: "var(--dash-text)" }}>Belum ada kafe terhubung</p>
        <p className="text-sm" style={{ color: "var(--dash-muted)" }}>Akun ini belum terkait ke kafe mana pun.</p>
      </div>
    );
  }

  const { cafe, totals, deltas, conversion, view3dRate, totalEvents, daily, hourly, weekday, insights, topDishes, recent } = data;
  const base = Math.max(1, totals.click_menu);
  const criticalStock = inventory.summary.low + inventory.summary.empty;

  const funnel = [
    { label: "Buka Menu", value: totals.click_menu, pct: 100, color: "#5A7898" },
    { label: "Lihat Model 3D", value: totals.view_3d, pct: (totals.view_3d / base) * 100, color: "#00C2A8" },
    { label: "Mulai Pesan", value: totals.click_order, pct: (totals.click_order / base) * 100, color: "#FD5002" },
  ];

  const maxDishViews = Math.max(1, ...topDishes.map((d) => d.views || d.clicks));

  const insightTiles = [
    insights.peakHour !== null && {
      icon: Clock,
      accent: "#FD5002",
      bg: "rgba(253,80,2,0.1)",
      label: "Jam tersibuk",
      value: `${String(insights.peakHour).padStart(2, "0")}.00`,
    },
    insights.busiestWeekday !== null && {
      icon: CalendarDays,
      accent: "#00C2A8",
      bg: "rgba(0,194,168,0.1)",
      label: "Hari teramai",
      value: WEEKDAY_FULL[insights.busiestWeekday],
    },
    insights.bestDish && {
      icon: Flame,
      accent: "#F59E0B",
      bg: "rgba(245,158,11,0.1)",
      label: "Menu paling dilirik",
      value: insights.bestDish,
    },
    insights.bestConvDish && {
      icon: Target,
      accent: "#22D3A6",
      bg: "rgba(34,211,166,0.1)",
      label: "Konversi terbaik",
      value: `${insights.bestConvDish.name} · ${insights.bestConvDish.rate}%`,
    },
  ].filter(Boolean) as { icon: typeof Clock; accent: string; bg: string; label: string; value: string }[];

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const rangeLabel = start && end
    ? `${fmt(start)} – ${fmt(end)}`
    : start ? `Sejak ${fmt(start)}`
    : end ? `Hingga ${fmt(end)}`
    : "14 hari terakhir";

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <DashboardPageHeader
        eyebrow={`${cafe.nama_cafe} · ${rangeLabel}`}
        title="Ringkasan Operasional"
        subtitle={
          <>
            <span style={{ color: "var(--dash-text)", fontWeight: 600 }}>{totalEvents.toLocaleString("id-ID")}</span> interaksi ·
            rata-rata <span style={{ color: "var(--dash-text)", fontWeight: 600 }}>{insights.avgPerDay}</span>/hari
          </>
        }
        actions={
          <>
            <Link
              href="/dashboard/orders"
              className="dash-btn inline-flex items-center gap-2 px-3.5 rounded-[10px] text-[13px] font-semibold dash-on-accent"
              style={{ background: "var(--orange)", height: "38px" }}
            >
              <ShoppingBag size={14} strokeWidth={2.2} />
              Kelola Pesanan
            </Link>
            <DateRangePicker initialStart={start} initialEnd={end} />
          </>
        }
      />

      {/* Today Overview — 6 KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4 dash-reveal dash-d1">
        <DashboardMetric value={today.revenueToday} prefix="Rp " label="Omzet Hari Ini" icon={<Wallet size={15} strokeWidth={2} />} accent="#22D3A6" accentBg="rgba(34,211,166,0.12)" sub={`${today.ordersToday} pesanan hari ini`} />
        <DashboardMetric value={today.activeOrders} label="Pesanan Aktif" icon={<ShoppingBag size={15} strokeWidth={2} />} accent="#FD5002" accentBg="rgba(253,80,2,0.12)" sub="perlu diproses" />
        <DashboardMetric value={totals.click_menu} label="Tampilan Menu" icon={<MousePointerClick size={15} strokeWidth={2} />} accent="#9FB6D1" accentBg="rgba(159,182,209,0.12)" delta={deltas.click_menu} />
        <DashboardMetric value={totals.view_3d} label="Lihat Model 3D" icon={<Box size={15} strokeWidth={2} />} accent="#00C2A8" accentBg="rgba(0,194,168,0.12)" delta={deltas.view_3d} />
        <DashboardMetric value={Math.round(conversion)} suffix="%" label="Konversi ke Pesan" icon={<Target size={15} strokeWidth={2} />} accent="#22D3A6" accentBg="rgba(34,211,166,0.12)" sub={`${Math.round(view3dRate)}% buka model 3D`} />
        <DashboardMetric value={criticalStock} label="Stok Kritis" icon={<AlertTriangle size={15} strokeWidth={2} />} accent="#F59E0B" accentBg="rgba(245,158,11,0.12)" sub={criticalStock > 0 ? "bahan di bawah minimum" : "semua stok aman"} />
      </div>

      {/* Insight strip */}
      {insightTiles.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 mb-4 dash-reveal dash-d2">
          {insightTiles.map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={i} className="dash-card dash-panel shrink-0 flex items-center gap-3 px-4 py-3 min-w-[200px]">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.bg, color: t.accent }}>
                  <Icon size={15} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px]" style={{ color: "var(--dash-muted)" }}>{t.label}</p>
                  <p className="text-[13px] font-semibold truncate" style={{ color: "var(--dash-text)" }}>{t.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main analytics — activity + funnel rail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 dash-reveal dash-d3">
        <DashboardPanel title="Aktivitas Harian" className="lg:col-span-2">
          <LineChart data={daily.map((d) => ({ label: d.label, value: d.count }))} />
        </DashboardPanel>
        <DashboardPanel title="Corong Engagement">
          <FunnelBars stages={funnel} />
          <p className="text-xs mt-5 leading-relaxed" style={{ color: "var(--dash-muted)" }}>
            Dari setiap 100 tamu yang membuka menu,{" "}
            <span style={{ color: "#00C2A8", fontWeight: 600 }}>{Math.round(view3dRate)}</span> melihat model 3D dan{" "}
            <span style={{ color: "#FD5002", fontWeight: 600 }}>{Math.round(conversion)}</span> mulai memesan.
          </p>
        </DashboardPanel>
      </div>

      {/* Heatmap + weekday */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 dash-reveal dash-d4">
        <DashboardPanel title="Jam Tersibuk" className="lg:col-span-2">
          <HeatmapGrid hourly={hourly} />
          <p className="text-xs mt-3" style={{ color: "var(--dash-muted)" }}>
            Sebaran interaksi per jam · kotak paling terang = jam paling ramai
          </p>
        </DashboardPanel>
        <DashboardPanel title="Per Hari">
          <WeekdayBars data={weekday} />
        </DashboardPanel>
      </div>

      {/* Operations — komposisi + top menu + aktivitas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 dash-reveal dash-d5">
        <DashboardPanel title="Komposisi Interaksi" className="flex flex-col" bodyClassName="dash-panel-body flex-1 flex items-center">
          <div className="w-full flex items-center">
            <DonutChart
              centerLabel="Interaksi"
              segments={[
                { label: "Buka menu", value: totals.click_menu, color: "#5A7898" },
                { label: "Lihat 3D", value: totals.view_3d, color: "#00C2A8" },
                { label: "Mulai pesan", value: totals.click_order, color: "#FD5002" },
              ]}
            />
          </div>
        </DashboardPanel>

        <DashboardPanel title="Menu Terpopuler">
          <div>
            {topDishes.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--dash-muted)" }}>Belum ada data interaksi.</p>
            ) : (
              <div className="space-y-1">
                {topDishes.map((d, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[20px_1fr_auto] gap-3 items-center px-2 py-2 rounded-lg"
                    style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}
                  >
                    <span className="text-xs font-bold tabular-nums" style={{ color: i === 0 ? "#FD5002" : "var(--dash-muted)" }}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--dash-text)" }}>{d.name}</p>
                      <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full" style={{ width: `${((d.views || d.clicks) / maxDishViews) * 100}%`, background: "#00C2A8" }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right tabular-nums">
                      <span className="text-xs font-semibold" style={{ color: "#00C2A8" }}>{d.views}</span>
                      <span className="text-xs font-semibold" style={{ color: "#FD5002" }}>{d.orders}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Aktivitas Terbaru">
          <div>
            {recent.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--dash-muted)" }}>Belum ada aktivitas.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EVENT_COLOR[r.type] }} />
                    <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--dash-secondary)" }}>
                      <span style={{ color: "var(--dash-text)", fontWeight: 500 }}>{EVENT_LABEL[r.type]}</span> · {r.name}
                    </span>
                    <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--dash-muted)" }}>
                      {relTime(r.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DashboardPanel>
      </div>

      {/* Inventory workspace */}
      <InventoryWorkspace
        items={inventory.items}
        movements={inventory.movements}
        summary={inventory.summary}
        failedLoads={inventory.failedLoads}
        embedded
      />
    </div>
  );
}
