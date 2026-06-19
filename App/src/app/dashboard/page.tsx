import type { Metadata } from "next";
import Image from "next/image";
import {
  MousePointerClick,
  Box,
  ShoppingBag,
  TrendingUp,
  Trophy,
  Activity,
} from "lucide-react";
import { getDashboardData, type EventType } from "@/lib/analytics";
import Counter from "@/components/dashboard/Counter";
import AnimatedBar from "@/components/dashboard/AnimatedBar";
import DailyChart from "@/components/dashboard/DailyChart";

export const metadata: Metadata = {
  title: "Analytik · Dashboard | 3Diner",
};

export const dynamic = "force-dynamic";

// Pilot cafe (no auth yet — analytics-only check build)
const CAFE_SLUG = "senja-kopi";

const EVENT_LABEL: Record<EventType, string> = {
  click_menu: "Buka menu",
  view_3d: "Lihat 3D",
  click_order: "Klik pesan",
};
const EVENT_COLOR: Record<EventType, string> = {
  click_menu: "#254473",
  view_3d: "#022C60",
  click_order: "#FD5002",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.round(h / 24);
  return `${d} hari lalu`;
}

export default async function DashboardPage() {
  const data = await getDashboardData(CAFE_SLUG);

  if (!data) {
    return (
      <main
        className="min-h-dvh flex items-center justify-center px-6 text-center"
        style={{ background: "#FDFDFD" }}
      >
        <p style={{ color: "#51698F" }}>Data kafe tidak ditemukan.</p>
      </main>
    );
  }

  const { totals, conversion, totalEvents, daily, topDishes, recent } = data;
  const maxView = Math.max(1, ...topDishes.map((d) => d.views));

  const stats = [
    { label: "Tampilan Menu", value: totals.click_menu, icon: MousePointerClick, accent: "#254473" },
    { label: "Lihat Model 3D", value: totals.view_3d, icon: Box, accent: "#022C60" },
    { label: "Klik Pesan", value: totals.click_order, icon: ShoppingBag, accent: "#FD5002" },
  ];

  // Funnel stages (relative to top of funnel)
  const base = Math.max(1, totals.click_menu);
  const funnel = [
    { label: "Buka Menu", value: totals.click_menu, pct: 100 },
    { label: "Lihat Model 3D", value: totals.view_3d, pct: (totals.view_3d / base) * 100 },
    { label: "Klik Pesan", value: totals.click_order, pct: (totals.click_order / base) * 100 },
  ];

  return (
    <main className="min-h-dvh" style={{ background: "#FDFDFD" }}>
      <div className="max-w-5xl mx-auto px-5 py-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-8 fade-up">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "#022C60" }}
            >
              <Image
                src="/brand/logo-3diner-mark.svg"
                alt="3Diner"
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight" style={{ color: "#022C60" }}>
                Analytik
              </h1>
              <p className="text-xs" style={{ color: "#51698F" }}>
                {data.cafe.nama_cafe} · 14 hari terakhir
              </p>
            </div>
          </div>
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: "#FDD8C3", color: "#FD5002" }}
          >
            <Activity size={13} />
            {totalEvents.toLocaleString("id-ID")} interaksi
          </div>
        </header>

        {/* Stat cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-2xl p-4 fade-up stagger-${i + 1}`}
              style={{ background: "#FFFFFF", border: "1px solid #CFD9E4" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "#E0E7EE" }}
              >
                <s.icon size={17} color={s.accent} strokeWidth={2.2} />
              </div>
              <p className="text-2xl font-bold leading-none" style={{ color: "#022C60" }}>
                <Counter value={s.value} />
              </p>
              <p className="text-xs mt-1.5" style={{ color: "#51698F" }}>
                {s.label}
              </p>
            </div>
          ))}

          {/* Conversion card — accent */}
          <div
            className="rounded-2xl p-4 fade-up stagger-4"
            style={{ background: "#022C60" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(253,80,2,0.2)" }}
            >
              <TrendingUp size={17} color="#FD5002" strokeWidth={2.2} />
            </div>
            <p className="text-2xl font-bold leading-none text-white">
              <Counter value={conversion} decimals={1} suffix="%" />
            </p>
            <p className="text-xs mt-1.5" style={{ color: "rgba(253,253,253,0.7)" }}>
              Konversi ke Pesan
            </p>
          </div>
        </section>

        {/* Funnel + Daily chart */}
        <section className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Funnel */}
          <div
            className="rounded-2xl p-5 fade-up"
            style={{ background: "#FFFFFF", border: "1px solid #CFD9E4" }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#022C60" }}>
              Alur Konversi
            </h2>
            <div className="space-y-4">
              {funnel.map((f, i) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ color: "#254473" }}>
                      {f.label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "#022C60" }}>
                      {f.value.toLocaleString("id-ID")}
                      <span style={{ color: "#51698F" }}> · {f.pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <AnimatedBar pct={f.pct} delayMs={i * 150} gradient />
                </div>
              ))}
            </div>
          </div>

          {/* Daily */}
          <div
            className="rounded-2xl p-5 fade-up stagger-1"
            style={{ background: "#FFFFFF", border: "1px solid #CFD9E4" }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#022C60" }}>
              Aktivitas Harian
            </h2>
            <DailyChart data={daily} />
          </div>
        </section>

        {/* Top dishes */}
        <section
          className="rounded-2xl p-5 mb-4 fade-up"
          style={{ background: "#FFFFFF", border: "1px solid #CFD9E4" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={15} color="#FD5002" />
            <h2 className="text-sm font-semibold" style={{ color: "#022C60" }}>
              Menu Terpopuler
            </h2>
          </div>
          <div className="space-y-3.5">
            {topDishes.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span
                  className="w-5 text-sm font-bold shrink-0"
                  style={{ color: i === 0 ? "#FD5002" : "#51698F" }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate" style={{ color: "#022C60" }}>
                      {d.name}
                    </span>
                    <span className="text-xs ml-2 shrink-0" style={{ color: "#51698F" }}>
                      {d.views} lihat · {d.orders} pesan
                    </span>
                  </div>
                  <AnimatedBar
                    pct={(d.views / maxView) * 100}
                    delayMs={i * 90}
                    fill={i === 0 ? "#FD5002" : "#254473"}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section
          className="rounded-2xl p-5 fade-up stagger-1"
          style={{ background: "#FFFFFF", border: "1px solid #CFD9E4" }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#022C60" }}>
            Aktivitas Terbaru
          </h2>
          <ul className="space-y-2.5">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: EVENT_COLOR[r.type] }}
                />
                <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "#254473" }}>
                  <span className="font-medium" style={{ color: "#022C60" }}>
                    {EVENT_LABEL[r.type]}
                  </span>{" "}
                  — {r.name}
                </span>
                <span className="text-xs shrink-0" style={{ color: "#51698F" }}>
                  {relTime(r.at)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-center text-xs mt-8" style={{ color: "#51698F" }}>
          3Diner Dashboard · mode preview (tanpa login)
        </p>
      </div>
    </main>
  );
}
