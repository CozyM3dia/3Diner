import { cache } from "react";
import { supabaseAdmin } from "./supabase-admin";
import { createClient } from "./supabase/server";

export type EventType = "click_menu" | "view_3d" | "click_order";

const WIB = "Asia/Jakarta";
// Returns "YYYY-MM-DD" in WIB timezone for a UTC ISO timestamp.
const wibDateKey = (ts: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: WIB }).format(new Date(ts));

export interface DashboardData {
  cafe: { nama_cafe: string; slug_url: string };
  totals: Record<EventType, number>;
  /** This-week vs last-week % change per event type (rounded int, can be negative). */
  deltas: Record<EventType, number>;
  conversion: number; // click_order / click_menu  (%)
  view3dRate: number; // view_3d / click_menu      (%)
  totalEvents: number;
  daily: { label: string; count: number }[]; // last 14 days
  hourly: number[]; // 24 buckets, event count per hour of day
  weekday: number[]; // 7 buckets, Mon..Sun
  topDishes: { name: string; clicks: number; views: number; orders: number }[];
  recent: { name: string; type: EventType; at: string }[];
  insights: {
    peakHour: number | null;       // 0-23, busiest hour
    busiestWeekday: number | null; // 0=Mon..6=Sun
    avgPerDay: number;
    bestDish: string | null;       // most viewed dish
    bestConvDish: { name: string; rate: number } | null; // highest order/click
    quietHint: string | null;      // suggestion text
  };
}

const DAYS = 14;

/** Authenticated user id for this request (cached: dedupes layout + page). */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

export interface CafeRow {
  id_cafe: string;
  nama_cafe: string;
  slug_url: string;
  logo_url: string | null;
}

/** Cached slug → CafeRow lookup. Dedupes within one render pass via React cache(). */
export const getCafeBySlug = cache(async (slug: string): Promise<CafeRow | null> => {
  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("id_cafe, nama_cafe, slug_url, logo_url")
    .eq("slug_url", slug)
    .single();
  return (data as CafeRow | null) ?? null;
});

/** Find the slug of the cafe owned by a given auth user (or null).
 *  Wrapped in React cache() so layout + page in the same request dedupe to one query. */
export const getOwnerCafeSlug = cache(async (ownerId: string): Promise<string | null> => {
  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("slug_url")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  return (data?.slug_url as string) ?? null;
});

export async function getDashboardData(
  slug: string,
  startDate?: string,
  endDate?: string
): Promise<DashboardData | null> {
  const cafe = await getCafeBySlug(slug);
  if (!cafe) return null;

  // Compute effective query window
  const today = new Date();
  const queryStart = startDate
    ? (() => { const d = new Date(startDate); d.setHours(0, 0, 0, 0); return d; })()
    : (() => { const d = new Date(today.getTime() - (DAYS - 1) * 24 * 60 * 60 * 1000); d.setHours(0, 0, 0, 0); return d; })();
  const queryEnd = endDate
    ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })()
    : (() => { const d = new Date(today); d.setHours(23, 59, 59, 999); return d; })();

  const startDay = new Date(queryStart); startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(queryEnd); endDay.setHours(0, 0, 0, 0);
  const rangeDays = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1);

  const [{ data: menus }, analytics] = await Promise.all([
    supabaseAdmin.from("Menus").select("id_menu, nama_menu").eq("cafe_id", cafe.id_cafe),
    supabaseAdmin.rpc("dashboard_analytics", {
      p_cafe_id: cafe.id_cafe,
      p_start: queryStart.toISOString(),
      p_end: queryEnd.toISOString(),
    }),
  ]);

  // Agregasi terjadi di Postgres (dashboard_analytics); di sisi ini hanya
  // merangkai nilai turunan. helper ini menormalisasi jsonb → nilai JS.
  const agg = (analytics.data ?? {}) as Record<string, unknown>;
  const asObject = (v: unknown): Record<string, number> =>
    v && typeof v === "object" ? (v as Record<string, number>) : {};
  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const num = (v: unknown): number => Number(v) || 0;

  const menuName = new Map<string, string>(
    (menus ?? []).map((m) => [m.id_menu as string, m.nama_menu as string])
  );

  const totals: Record<EventType, number> = { click_menu: 0, view_3d: 0, click_order: 0 };
  const aTotals = asObject(agg.totals);
  for (const k of Object.keys(totals) as EventType[]) totals[k] = num(aTotals[k]);

  const aThis = asObject(agg.this_week);
  const aLast = asObject(agg.last_week);
  const thisWeek: Record<EventType, number> = { click_menu: 0, view_3d: 0, click_order: 0 };
  const lastWeek: Record<EventType, number> = { click_menu: 0, view_3d: 0, click_order: 0 };
  for (const k of Object.keys(thisWeek) as EventType[]) {
    thisWeek[k] = num(aThis[k]);
    lastWeek[k] = num(aLast[k]);
  }

  const perDish = new Map<string, { clicks: number; views: number; orders: number }>();
  for (const row of asArray(agg.per_dish)) {
    const d = row as Record<string, unknown>;
    perDish.set(d.menu_id as string, {
      clicks: num(d.clicks),
      views: num(d.views),
      orders: num(d.orders),
    });
  }

  // Build day skeleton from queryStart → queryEnd, lalu isi dari RPC.
  const dayBuckets = new Map<string, number>();
  const cur = new Date(startDay);
  let dCount = 0;
  while (cur <= endDay && dCount < 366) {
    dayBuckets.set(wibDateKey(cur.toISOString()), 0);
    cur.setDate(cur.getDate() + 1);
    dCount++;
  }
  for (const row of asArray(agg.daily)) {
    const d = row as Record<string, unknown>;
    if (dayBuckets.has(d.day as string)) dayBuckets.set(d.day as string, num(d.count));
  }

  const hourly = asArray(agg.hourly).map(num);
  while (hourly.length < 24) hourly.push(0);
  const weekday = asArray(agg.weekday).map(num);
  while (weekday.length < 7) weekday.push(0); // 0=Mon..6=Sun

  const totalEvents = Object.values(totals).reduce((s, n) => s + n, 0);

  const pctDelta = (cur: number, prev: number): number => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };
  const deltas: Record<EventType, number> = {
    click_menu: pctDelta(thisWeek.click_menu, lastWeek.click_menu),
    view_3d: pctDelta(thisWeek.view_3d, lastWeek.view_3d),
    click_order: pctDelta(thisWeek.click_order, lastWeek.click_order),
  };

  const topDishes = [...perDish.entries()]
    .map(([id, v]) => ({ name: menuName.get(id) ?? "—", ...v }))
    .sort((a, b) => b.views - a.views || b.clicks - a.clicks)
    .slice(0, 6);

  const daily = [...dayBuckets.entries()].map(([date, count]) => ({
    label: new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    count,
  }));

  const recent = asArray(agg.recent).map((l) => {
    const row = l as Record<string, unknown>;
    return {
      name: menuName.get(row.menu_id as string) ?? "—",
      type: row.event_type as EventType,
      at: row.created_at as string,
    };
  });

  const conversion =
    totals.click_menu > 0 ? (totals.click_order / totals.click_menu) * 100 : 0;
  const view3dRate =
    totals.click_menu > 0 ? (totals.view_3d / totals.click_menu) * 100 : 0;

  // ── Derived insights (plain-language, real data) ──
  const hourMax = Math.max(...hourly);
  const peakHour = hourMax > 0 ? hourly.indexOf(hourMax) : null;
  const wdMax = Math.max(...weekday);
  const busiestWeekday = wdMax > 0 ? weekday.indexOf(wdMax) : null;
  const avgPerDay = Math.round(totalEvents / rangeDays);

  const dishArr = [...perDish.entries()].map(([id, v]) => ({ name: menuName.get(id) ?? "—", ...v }));
  const bestDish = dishArr.length ? [...dishArr].sort((a, b) => b.views - a.views)[0].name : null;
  const convCandidates = dishArr
    .filter((d) => d.clicks >= 3)
    .map((d) => ({ name: d.name, rate: Math.round((d.orders / d.clicks) * 100) }))
    .sort((a, b) => b.rate - a.rate);
  const bestConvDish = convCandidates.length ? convCandidates[0] : null;

  let quietHint: string | null = null;
  if (conversion < 10 && totals.click_menu > 20) {
    quietHint = "Konversi ke pesan rendah. Coba tambah foto/model 3D di menu populer.";
  } else if (view3dRate > 60) {
    quietHint = "Tamu sangat tertarik model 3D. Pastikan menu unggulan punya model 3D.";
  } else if (peakHour !== null) {
    quietHint = `Trafik memuncak jam ${String(peakHour).padStart(2, "0")}.00. Jadwalkan promo di sekitar jam itu.`;
  }

  return {
    cafe: { nama_cafe: cafe.nama_cafe as string, slug_url: cafe.slug_url as string },
    totals,
    deltas,
    conversion,
    view3dRate,
    totalEvents,
    daily,
    hourly,
    weekday,
    insights: { peakHour, busiestWeekday, avgPerDay, bestDish, bestConvDish, quietHint },
    topDishes,
    recent,
  };
}

// ── Revenue / Sales analytics (from Orders) ────────────────────────────────

export interface RevenueData {
  totalRevenue: number;
  orderCount: number;
  avgOrder: number;
  itemsSold: number;
  revenueDelta: number; // this-week vs last-week %
  dailyRevenue: { label: string; value: number }[]; // last 14 days
  statusCounts: {
    received: number;
    preparing: number;
    ready: number;
    completed: number;
    cancelled: number;
  };
  paymentCounts: {
    cash: number;
    qris: number;
    gopay: number;
    shopeepay: number;
    bank_transfer: number;
    unpaid: number;
  };
  topByRevenue: { name: string; qty: number; revenue: number }[];
  recentOrders: { id: string; table: string; total: number; status: string; at: string }[];
}

export async function getRevenueData(
  slug: string,
  startDate?: string,
  endDate?: string
): Promise<RevenueData | null> {
  const cafe = await getCafeBySlug(slug);
  if (!cafe) return null;

  let queryStart: string | null = null;
  let queryEnd: string | null = null;
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    queryStart = start.toISOString();
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    queryEnd = end.toISOString();
  }

  // Agregasi omzet, status, metode bayar, deret harian, dan kontribusi per menu
  // dipindah ke Postgres (revenue_analytics) — tidak lagi menarik semua baris
  // Orders ke Node. Nilai turunan (delta, avg, rangking) dihitung di sini.
  const { data } = await supabaseAdmin.rpc("revenue_analytics", {
    p_cafe_id: cafe.id_cafe,
    p_start: queryStart,
    p_end: queryEnd,
  });
  const agg = (data ?? {}) as Record<string, unknown>;
  const asObject = (v: unknown): Record<string, number> =>
    v && typeof v === "object" ? (v as Record<string, number>) : {};
  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const num = (v: unknown): number => Number(v) || 0;

  const totalRevenue = num(agg.total_revenue);
  const orderCount = num(agg.order_count);
  const itemsSold = num(agg.items_sold);
  const statusCounts = {
    received: num(asObject(agg.status_counts).received),
    preparing: num(asObject(agg.status_counts).preparing),
    ready: num(asObject(agg.status_counts).ready),
    completed: num(asObject(agg.status_counts).completed),
    cancelled: num(asObject(agg.status_counts).cancelled),
  };
  const p = asObject(agg.payment_counts);
  const paymentCounts = {
    cash: num(p.cash),
    qris: num(p.qris),
    gopay: num(p.gopay),
    shopeepay: num(p.shopeepay),
    bank_transfer: num(p.bank_transfer),
    unpaid: num(p.unpaid),
  };

  const avgOrder = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
  const thisWeekRev = num(agg.this_week_rev);
  const lastWeekRev = num(agg.last_week_rev);
  const revenueDelta =
    lastWeekRev === 0 ? (thisWeekRev > 0 ? 100 : 0) : Math.round(((thisWeekRev - lastWeekRev) / lastWeekRev) * 100);

  // Skeleton hari + isi dari RPC.
  const today = new Date();
  const startDay = startDate ? new Date(startDate) : new Date(today.getTime() - (DAYS - 1) * 24 * 60 * 60 * 1000);
  let endDay = endDate ? new Date(endDate) : new Date(today);
  startDay.setHours(0, 0, 0, 0);
  endDay.setHours(0, 0, 0, 0);
  if (startDay > endDay) endDay = new Date(startDay);

  const dayBuckets = new Map<string, number>();
  const cur = new Date(startDay);
  let count = 0;
  while (cur <= endDay && count < 366) {
    dayBuckets.set(wibDateKey(cur.toISOString()), 0);
    cur.setDate(cur.getDate() + 1);
    count++;
  }
  for (const row of asArray(agg.daily_revenue)) {
    const d = row as Record<string, unknown>;
    if (dayBuckets.has(d.day as string)) dayBuckets.set(d.day as string, num(d.value));
  }

  const dailyRevenue = [...dayBuckets.entries()].map(([date, value]) => ({
    label: new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    value,
  }));

  const topByRevenue = (asArray(agg.per_item) as Record<string, unknown>[])
    .map((r) => ({ name: r.name as string, qty: num(r.qty), revenue: num(r.revenue) }))
    .slice(0, 6);

  const recentOrders = (asArray(agg.recent_orders) as Record<string, unknown>[]).map((o) => ({
    id: o.id_order as string,
    table: o.table_number as string,
    total: num(o.total),
    status: o.status as string,
    at: o.created_at as string,
  }));

  return { totalRevenue, orderCount, avgOrder, itemsSold, revenueDelta, dailyRevenue, statusCounts, paymentCounts, topByRevenue, recentOrders };
}
