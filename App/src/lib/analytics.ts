import { cache } from "react";
import { supabaseAdmin } from "./supabase-admin";
import { createClient } from "./supabase/server";

export type EventType = "click_menu" | "view_3d" | "click_order";

/** ISO timestamp N days ago (start of window for queries). */
function sinceDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

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

export async function getDashboardData(slug: string): Promise<DashboardData | null> {
  const { data: cafe } = await supabaseAdmin
    .from("Cafes")
    .select("id_cafe, nama_cafe, slug_url")
    .eq("slug_url", slug)
    .single();

  if (!cafe) return null;

  const [{ data: menus }, { data: logs }] = await Promise.all([
    supabaseAdmin.from("Menus").select("id_menu, nama_menu").eq("cafe_id", cafe.id_cafe),
    supabaseAdmin
      .from("Analytics_Logs")
      .select("menu_id, event_type, created_at")
      .eq("cafe_id", cafe.id_cafe)
      .gte("created_at", sinceDays(DAYS)),
  ]);

  const menuName = new Map<string, string>(
    (menus ?? []).map((m) => [m.id_menu as string, m.nama_menu as string])
  );

  const totals: Record<EventType, number> = { click_menu: 0, view_3d: 0, click_order: 0 };
  const thisWeek: Record<EventType, number> = { click_menu: 0, view_3d: 0, click_order: 0 };
  const lastWeek: Record<EventType, number> = { click_menu: 0, view_3d: 0, click_order: 0 };
  const perDish = new Map<string, { clicks: number; views: number; orders: number }>();
  const dayBuckets = new Map<string, number>();
  const hourly = new Array<number>(24).fill(0);
  const weekday = new Array<number>(7).fill(0); // 0=Mon..6=Sun

  // Build 14-day skeleton (oldest → newest)
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }

  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  for (const log of logs ?? []) {
    const type = log.event_type as EventType;
    if (type in totals) totals[type]++;

    const id = log.menu_id as string;
    const dish = perDish.get(id) ?? { clicks: 0, views: 0, orders: 0 };
    if (type === "click_menu") dish.clicks++;
    else if (type === "view_3d") dish.views++;
    else if (type === "click_order") dish.orders++;
    perDish.set(id, dish);

    const ts = new Date(log.created_at as string);
    const dayKey = (log.created_at as string).slice(0, 10);
    if (dayBuckets.has(dayKey)) dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + 1);

    const h = ts.getHours();
    if (h >= 0 && h < 24) hourly[h]++;

    const wd = ts.getDay() === 0 ? 6 : ts.getDay() - 1; // Mon=0..Sun=6
    weekday[wd]++;

    const age = now - ts.getTime();
    if (type in totals) {
      if (age <= WEEK) thisWeek[type]++;
      else if (age <= 2 * WEEK) lastWeek[type]++;
    }
  }

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

  const recent = [...(logs ?? [])]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 8)
    .map((l) => ({
      name: menuName.get(l.menu_id as string) ?? "—",
      type: l.event_type as EventType,
      at: l.created_at as string,
    }));

  const conversion =
    totals.click_menu > 0 ? (totals.click_order / totals.click_menu) * 100 : 0;
  const view3dRate =
    totals.click_menu > 0 ? (totals.view_3d / totals.click_menu) * 100 : 0;

  // ── Derived insights (plain-language, real data) ──
  const totalEvents = (logs ?? []).length;
  const hourMax = Math.max(...hourly);
  const peakHour = hourMax > 0 ? hourly.indexOf(hourMax) : null;
  const wdMax = Math.max(...weekday);
  const busiestWeekday = wdMax > 0 ? weekday.indexOf(wdMax) : null;
  const avgPerDay = Math.round(totalEvents / DAYS);

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

interface OrderItemShape {
  nama_menu?: string;
  harga_menu?: number;
  qty?: number;
}

export interface RevenueData {
  totalRevenue: number;
  orderCount: number;
  avgOrder: number;
  itemsSold: number;
  revenueDelta: number; // this-week vs last-week %
  dailyRevenue: { label: string; value: number }[]; // last 14 days
  statusCounts: { received: number; preparing: number; ready: number };
  topByRevenue: { name: string; qty: number; revenue: number }[];
  recentOrders: { id: string; table: string; total: number; status: string; at: string }[];
}

export async function getRevenueData(slug: string): Promise<RevenueData | null> {
  const { data: cafe } = await supabaseAdmin
    .from("Cafes")
    .select("id_cafe")
    .eq("slug_url", slug)
    .single();
  if (!cafe) return null;

  const { data: orders } = await supabaseAdmin
    .from("Orders")
    .select("id_order, table_number, items, total, status, created_at")
    .eq("cafe_id", cafe.id_cafe)
    .gte("created_at", sinceDays(DAYS));

  const list = orders ?? [];

  let totalRevenue = 0;
  let itemsSold = 0;
  const statusCounts = { received: 0, preparing: 0, ready: 0 };
  const dayBuckets = new Map<string, number>();
  const perItem = new Map<string, { qty: number; revenue: number }>();

  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }

  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  let thisWeekRev = 0;
  let lastWeekRev = 0;

  for (const o of list) {
    const total = (o.total as number) ?? 0;
    totalRevenue += total;

    const st = o.status as keyof typeof statusCounts;
    if (st in statusCounts) statusCounts[st]++;

    const dayKey = (o.created_at as string).slice(0, 10);
    if (dayBuckets.has(dayKey)) dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + total);

    const age = now - new Date(o.created_at as string).getTime();
    if (age <= WEEK) thisWeekRev += total;
    else if (age <= 2 * WEEK) lastWeekRev += total;

    const items = (Array.isArray(o.items) ? o.items : []) as OrderItemShape[];
    for (const it of items) {
      const qty = it.qty ?? 0;
      const rev = (it.harga_menu ?? 0) * qty;
      itemsSold += qty;
      const name = it.nama_menu ?? "—";
      const cur = perItem.get(name) ?? { qty: 0, revenue: 0 };
      cur.qty += qty;
      cur.revenue += rev;
      perItem.set(name, cur);
    }
  }

  const orderCount = list.length;
  const avgOrder = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
  const revenueDelta =
    lastWeekRev === 0 ? (thisWeekRev > 0 ? 100 : 0) : Math.round(((thisWeekRev - lastWeekRev) / lastWeekRev) * 100);

  const dailyRevenue = [...dayBuckets.entries()].map(([date, value]) => ({
    label: new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    value,
  }));

  const topByRevenue = [...perItem.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const recentOrders = [...list]
    .sort((a, b) => ((a.created_at as string) < (b.created_at as string) ? 1 : -1))
    .slice(0, 8)
    .map((o) => ({
      id: o.id_order as string,
      table: o.table_number as string,
      total: (o.total as number) ?? 0,
      status: o.status as string,
      at: o.created_at as string,
    }));

  return { totalRevenue, orderCount, avgOrder, itemsSold, revenueDelta, dailyRevenue, statusCounts, topByRevenue, recentOrders };
}
