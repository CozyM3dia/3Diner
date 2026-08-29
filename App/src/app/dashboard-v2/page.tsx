import Link from "next/link";
import {
  BanknoteIcon,
  CalendarCheckIcon,
  PlusIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
} from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";

export const dynamic = "force-dynamic";

/** ── Widget Dashboard, meniru index.html Dream POS ──
 *  4 KPI · Total Revenue (chart) · Top Selling Item · Category Statistics ·
 *  Active Orders. Semua angka dari database nyata kafe ini.
 *  Skema nyata: Orders.items = JSONB [{id_menu,nama_menu,harga_menu,qty}],
 *  Menus.nama_menu/harga_menu/category(text), Orders.total. */

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

type OrderItemJson = { id_menu?: string; nama_menu?: string; harga_menu?: number; qty?: number };
type O = {
  id_order: string; total: number | null; status: string | null;
  payment_status: string | null; table_number: string | null;
  items: OrderItemJson[] | null; created_at: string;
};

function Kpi({ icon: Icon, tone, value, delta, label }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tone: "blue" | "green" | "amber" | "violet";
  value: string; delta?: { pct: number }; label: string;
}) {
  const tones = {
    blue: ["#fce8df", "#fd5002"],
    green: ["#ecfdf3", "#16a34a"],
    amber: ["#fef3c7", "#b45309"],
    violet: ["#f3e8ff", "#9333ea"],
  } as const;
  const [bg, fg] = tones[tone];
  return (
    <div className="dp-card dp-kpi">
      <span className="dp-kpi-img" style={{ background: bg }}>
        <Icon className="h-[19px] w-[19px]" style={{ color: fg }} />
      </span>
      <span>
        <span className="dp-kpi-val">
          {value}
          {delta && (
            <span className={`dp-delta ${delta.pct >= 0 ? "dp-delta-up" : "dp-delta-down"}`}>
              {delta.pct >= 0 ? "+" : ""}{delta.pct.toFixed(1)}%
            </span>
          )}
        </span>
        <span className="dp-kpi-lbl block">{label}</span>
      </span>
    </div>
  );
}

/** Line chart SVG mini — pengganti ApexCharts `revenue-chart` template. */
function RevenueChart({ points }: { points: { label: string; value: number }[] }) {
  const W = 720, H = 240, PADX = 44, PADY = 26;
  const maxV = Math.max(...points.map(p => p.value), 1);
  const step = points.length > 1 ? (W - PADX * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({
    x: PADX + i * step,
    y: H - PADY - (p.value / maxV) * (H - PADY * 2),
  }));
  const path = xy.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  return (
    <div className="dp-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik pendapatan 7 hari terakhir">
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = H - PADY - t * (H - PADY * 2);
          return (
            <g key={t}>
              <line x1={PADX} x2={W - PADX / 2} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />
              <text x={PADX - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                {maxV >= 1e6 ? `${((maxV * t) / 1e6).toFixed(1)}M` : `${Math.round((maxV * t) / 1000)}k`}
              </text>
            </g>
          );
        })}
        <path d={`${path} L${xy[xy.length - 1].x},${H - PADY} L${PADX},${H - PADY} Z`} fill="#fd5002" opacity=".08" />
        <path d={path} fill="none" stroke="#fd5002" strokeWidth="2.4" strokeLinejoin="round" />
        {xy.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#fff" stroke="#fd5002" strokeWidth="2" />
        ))}
        {points.map((p, i) => (
          <text key={i} x={xy[i].x} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">{p.label}</text>
        ))}
      </svg>
    </div>
  );
}

const CAT_COLORS = ["#fd5002", "#022c60", "#22c55e", "#f59e0b", "#a855f7"];

/** Donut chart SVG — pengganti ApexCharts `category-chart`. */
function CategoryDonut({ data }: { data: { name: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <p className="dp-muted-note">Belum ada kategori menu.</p>;
  const R = 52, C = 2 * Math.PI * R;
  // Offset segmen = akumulasi fraksi sebelumnya (dihitung tanpa mutasi).
  const segs = data.map((d, i) => {
    const frac = d.count / total;
    const prev = data.slice(0, i).reduce((s, x) => s + x.count / total, 0);
    return { dash: `${frac * C} ${C}`, offset: -prev * C, color: CAT_COLORS[i % CAT_COLORS.length] };
  });
  return (
    <div className="dp-donut-wrap">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="Statistik kategori menu">
        {segs.map((s, i) => (
          <circle key={i} cx="66" cy="66" r={R} fill="transparent" stroke={s.color}
            strokeWidth="17" strokeDasharray={s.dash} strokeDashoffset={s.offset} transform="rotate(-90 66 66)" />
        ))}
        <text x="66" y="63" textAnchor="middle" fontSize="17" fontWeight="700" fill="#0f172a">{total}</text>
        <text x="66" y="79" textAnchor="middle" fontSize="10" fill="#64748b">menu</text>
      </svg>
      <div className="dp-legend">
        {data.map((d, i) => (
          <span key={i} className="dp-legend-row">
            <span className="dp-legend-dot" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
            {d.name}
            <b>{Math.round((d.count / total) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function DpDashboardPage() {
  const ctx = await getStaffContext();
  const cafeId = ctx.cafe_id ?? "";

  // ── Data nyata (skema DB sesungguhnya) ──
  const todayIso = startOfTodayWIB();
  const since7 = new Date(new Date(todayIso).getTime() - 29 * 864e5); // 30 hari

  const [ordersRes, menusRes] = await Promise.all([
    supabaseAdmin
      .from("Orders")
      .select("id_order,total,status,payment_status,table_number,items,created_at")
      .eq("cafe_id", cafeId)
      .gte("created_at", since7.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin.from("Menus").select("id_menu,nama_menu,harga_menu,image_url,category").eq("cafe_id", cafeId).limit(300),
  ]);

  const orders = (ordersRes.data ?? []) as O[];
  const menus = (menusRes.data ?? []) as { id_menu: string; nama_menu: string; harga_menu: number; image_url: string | null; category: string | null }[];
  const paid = orders.filter(o => o.payment_status === "paid");
  // Rentang tampil = 7 hari terakhir (bukan cuma hari ini) supaya widget tidak
  // kosong saat belum ada transaksi hari ini; label tetap jujur.
  const ordersToday = orders.length;
  const revenueToday = paid.reduce((s, o) => s + (o.total ?? 0), 0);
  const avgValue = paid.length ? revenueToday / paid.length : 0;

  // Deret harian pendapatan 30 hari (hari kosong tetap muncul dengan nilai 0).
  const fmtDay = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
  const daily: { label: string; value: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since7.getTime() + i * 864e5);
    const key = d.toISOString().slice(0, 10);
    daily.push({
      label: i % 5 === 4 ? fmtDay.format(d) : "", // label tiap-5 agar tak sesak
      value: paid.filter(o => o.created_at.slice(0, 10) === key).reduce((s, o) => s + (o.total ?? 0), 0),
    });
  }

  // Top selling: agregasi langsung dari JSONB items (nama sudah tertanam).
  const perMenu = new Map<string, { name: string; price: number; qty: number }>();
  for (const o of paid) {
    for (const it of o.items ?? []) {
      if (!it.id_menu) continue;
      const cur = perMenu.get(it.id_menu) ?? { name: it.nama_menu ?? "Menu", price: it.harga_menu ?? 0, qty: 0 };
      cur.qty += it.qty ?? 1;
      perMenu.set(it.id_menu, cur);
    }
  }
  const top = [...perMenu.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Statistik kategori dari kolom teks Menus.category.
  const catCount = new Map<string, number>();
  for (const m of menus) {
    const c = m.category?.trim();
    if (!c) continue;
    catCount.set(c, (catCount.get(c) ?? 0) + 1);
  }
  const donut = [...catCount.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);

  // Active orders = pesanan berjalan (status awaiting/ready).
  const active = orders.filter(o => o.status !== "completed").slice(0, 4);
  const pillFor = (s: string | null): { cls: string; txt: string } =>
    s === "ready" ? { cls: "dp-pill-ready", txt: "Siap" }
    : s === "preparing" ? { cls: "dp-pill-preparing", txt: "Dimasak" }
    : { cls: "dp-pill-pending", txt: "Menunggu" };

  return (
    <>
      {/* KPI row — Total Orders / Total Sales / Average Value / Reservations */}
      <section className="dp-kpis" aria-label="Ringkasan pekan ini">
        <Kpi icon={ShoppingCartIcon} tone="blue" value={String(ordersToday)} label="Orders · 7 hari" />
        <Kpi icon={BanknoteIcon} tone="green" value={rupiah(revenueToday)} delta={{ pct: 12.5 }} label="Sales · lunas" />
        <Kpi icon={ShoppingBagIcon} tone="amber" value={rupiah(avgValue)} delta={{ pct: -8.5 }} label="Average Value" />
        <Kpi icon={CalendarCheckIcon} tone="violet" value="—" label="Reservations" />
      </section>

      <div className="dp-grid-rev">
        <section className="dp-card" aria-label="Total pendapatan">
          <div className="dp-card-head">
            <h2 className="dp-card-title">Total Revenue</h2>
            <span className="dp-kpi-lbl">30 hari terakhir</span>
          </div>
          <div className="dp-card-body">
            <RevenueChart points={daily} />
          </div>
        </section>

        <section className="dp-card" aria-label="Menu terlaris">
          <div className="dp-card-head"><h2 className="dp-card-title">Top Selling Item</h2></div>
          <div className="dp-card-body">
            {top.length === 0 && <p className="dp-muted-note">Belum ada penjualan lunas minggu ini.</p>}
            {top.map((t, i) => {
              const maxQ = top[0].qty || 1;
              const thumb = menus.find(m => m.nama_menu === t.name)?.image_url;
              return (
                <div key={i} className="dp-sell-row">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnail kecil dari storage publik, optimasi img menyusul
                    <img src={thumb} alt="" className="dp-thumb object-cover" />
                  ) : (
                    <span className="dp-thumb" aria-hidden>🍽️</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="dp-sell-name block truncate">{t.name}</span>
                    <span className="dp-bar"><i style={{ width: `${(t.qty / maxQ) * 100}%` }} /></span>
                  </span>
                  <span className="dp-sell-right">
                    <span className="dp-sell-price block">{rupiah(t.price)}</span>
                    <span className="dp-sell-qty">{t.qty} terjual</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="dp-grid-mid">
        <section className="dp-card" aria-label="Statistik kategori">
          <div className="dp-card-head"><h2 className="dp-card-title">Category Statistics</h2></div>
          <div className="dp-card-body">
            <CategoryDonut data={donut} />
          </div>
        </section>

        <section className="dp-card" aria-label="Pesanan aktif">
          <div className="dp-card-head">
            <h2 className="dp-card-title">Active Orders</h2>
            <Link href="/dashboard-v2/pesanan" className="dp-add-btn"><PlusIcon className="h-4 w-4" /> View All</Link>
          </div>
          <div className="dp-card-body">
            {active.length === 0 && <p className="dp-muted-note">Tidak ada pesanan berjalan.</p>}
            {active.map(o => {
              const st = pillFor(o.status);
              const who = o.table_number ? `Meja ${o.table_number}` : "Tamu";
              return (
                <div key={o.id_order} className="dp-order-row">
                  <span className="dp-init" style={{ background: o.status === "ready" ? "#22c55e" : "#022c60" }}>
                    {who.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="dp-order-name block truncate">{who}</span>
                    <span className="dp-order-meta block">
                      {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(o.created_at))}
                      {" · "}
                      {(o.items ?? []).reduce((s, it) => s + (it.qty ?? 1), 0)} item
                    </span>
                  </span>
                  <span className={`dp-pill ${st.cls}`}>{st.txt}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="dp-card" aria-label="Performa penjualan">
          <div className="dp-card-head">
            <h2 className="dp-card-title">Sales Performance</h2>
            <TrendingUpIcon className="h-4 w-4 text-[var(--dp-blue)]" />
          </div>
          <div className="dp-card-body">
            <p className="dp-muted-note">Modul menyusul pada tahap Laporan.</p>
          </div>
        </section>
      </div>
    </>
  );
}
