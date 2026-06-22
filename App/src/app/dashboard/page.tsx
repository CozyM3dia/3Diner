import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MousePointerClick, Box, ShoppingBag, Target } from "lucide-react";
import { getDashboardData, getOwnerCafeSlug, type EventType } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/dashboard/StatCard";
import LineChart from "@/components/dashboard/LineChart";
import FunnelBars from "@/components/dashboard/FunnelBars";
import HeatmapGrid from "@/components/dashboard/HeatmapGrid";
import DonutChart from "@/components/dashboard/DonutChart";

export const metadata: Metadata = { title: "Analitik · Dashboard | 3Diner" };
export const dynamic = "force-dynamic";

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

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-4" style={{ color: "#5A7898" }}>
      {children}
    </h2>
  );
}

const PANEL = { background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" } as const;

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const data = slug ? await getDashboardData(slug) : null;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2 text-center px-6">
        <p className="font-semibold" style={{ color: "#E9EEF6" }}>Belum ada kafe terhubung</p>
        <p className="text-sm" style={{ color: "#5A7898" }}>Akun ini belum terkait ke kafe mana pun.</p>
      </div>
    );
  }

  const { totals, deltas, conversion, view3dRate, totalEvents, daily, hourly, topDishes, recent } = data;
  const base = Math.max(1, totals.click_menu);

  const funnel = [
    { label: "Buka Menu", value: totals.click_menu, pct: 100, color: "#5A7898" },
    { label: "Lihat Model 3D", value: totals.view_3d, pct: (totals.view_3d / base) * 100, color: "#00C2A8" },
    { label: "Mulai Pesan", value: totals.click_order, pct: (totals.click_order / base) * 100, color: "#FD5002" },
  ];

  const maxDishViews = Math.max(1, ...topDishes.map((d) => d.views || d.clicks));

  return (
    <div className="p-5 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>
          Analitik
        </h1>
        <p className="text-sm mt-1" style={{ color: "#5A7898" }}>
          Ringkasan engagement 14 hari terakhir · {totalEvents.toLocaleString("id-ID")} total interaksi
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          value={totals.click_menu}
          label="Tampilan Menu"
          icon={MousePointerClick}
          accent="#9FB6D1"
          accentBg="rgba(159,182,209,0.12)"
          delta={deltas.click_menu}
        />
        <StatCard
          value={totals.view_3d}
          label="Lihat Model 3D"
          icon={Box}
          accent="#00C2A8"
          accentBg="rgba(0,194,168,0.12)"
          delta={deltas.view_3d}
        />
        <StatCard
          value={totals.click_order}
          label="Mulai Pesan"
          icon={ShoppingBag}
          accent="#FD5002"
          accentBg="rgba(253,80,2,0.12)"
          delta={deltas.click_order}
        />
        <StatCard
          value={Math.round(conversion)}
          suffix="%"
          label="Konversi ke Pesan"
          icon={Target}
          accent="#22D3A6"
          accentBg="rgba(34,211,166,0.12)"
          sub={`${Math.round(view3dRate)}% buka model 3D`}
        />
      </div>

      {/* Timeline + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <section className="lg:col-span-2 rounded-2xl p-5" style={PANEL}>
          <SectionLabel>Aktivitas Harian</SectionLabel>
          <LineChart data={daily.map((d) => ({ label: d.label, value: d.count }))} />
        </section>
        <section className="rounded-2xl p-5" style={PANEL}>
          <SectionLabel>Corong Engagement</SectionLabel>
          <FunnelBars stages={funnel} />
          <p className="text-xs mt-5 leading-relaxed" style={{ color: "#5A7898" }}>
            Dari setiap 100 tamu yang membuka menu,{" "}
            <span style={{ color: "#00C2A8", fontWeight: 600 }}>{Math.round(view3dRate)}</span> melihat model 3D dan{" "}
            <span style={{ color: "#FD5002", fontWeight: 600 }}>{Math.round(conversion)}</span> mulai memesan.
          </p>
        </section>
      </div>

      {/* Heatmap + composition donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <section className="lg:col-span-2 rounded-2xl p-5" style={PANEL}>
          <SectionLabel>Jam Tersibuk</SectionLabel>
          <HeatmapGrid hourly={hourly} />
          <p className="text-xs mt-3" style={{ color: "#5A7898" }}>
            Sebaran interaksi per jam · kotak paling terang = jam paling ramai
          </p>
        </section>
        <section className="rounded-2xl p-5 flex flex-col" style={PANEL}>
          <SectionLabel>Komposisi Interaksi</SectionLabel>
          <div className="flex-1 flex items-center">
            <DonutChart
              centerLabel="Interaksi"
              segments={[
                { label: "Buka menu", value: totals.click_menu, color: "#5A7898" },
                { label: "Lihat 3D", value: totals.view_3d, color: "#00C2A8" },
                { label: "Mulai pesan", value: totals.click_order, color: "#FD5002" },
              ]}
            />
          </div>
        </section>
      </div>

      {/* Top dishes + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-2xl p-5" style={PANEL}>
          <SectionLabel>Menu Terpopuler</SectionLabel>
          {topDishes.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "#5A7898" }}>Belum ada data interaksi.</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[20px_1fr_auto] gap-3 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>
                <span>#</span>
                <span>Menu</span>
                <span className="text-right">3D · Pesan</span>
              </div>
              {topDishes.map((d, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[20px_1fr_auto] gap-3 items-center px-2 py-2 rounded-lg"
                  style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}
                >
                  <span className="text-xs font-bold tabular-nums" style={{ color: i === 0 ? "#FD5002" : "#5A7898" }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#E9EEF6" }}>
                      {d.name}
                    </p>
                    <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${((d.views || d.clicks) / maxDishViews) * 100}%`, background: "#00C2A8" }}
                      />
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
        </section>

        <section className="rounded-2xl p-5" style={PANEL}>
          <SectionLabel>Aktivitas Terbaru</SectionLabel>
          {recent.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "#5A7898" }}>Belum ada aktivitas.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EVENT_COLOR[r.type] }} />
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "#9FB6D1" }}>
                    <span style={{ color: "#E9EEF6", fontWeight: 500 }}>{EVENT_LABEL[r.type]}</span> · {r.name}
                  </span>
                  <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "#5A7898" }}>
                    {relTime(r.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
