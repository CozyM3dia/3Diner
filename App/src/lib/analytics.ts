import { supabaseAdmin } from "./supabase-admin";

export type EventType = "click_menu" | "view_3d" | "click_order";

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
  topDishes: { name: string; clicks: number; views: number; orders: number }[];
  recent: { name: string; type: EventType; at: string }[];
}

const DAYS = 14;

/** Find the slug of the cafe owned by a given auth user (or null). */
export async function getOwnerCafeSlug(ownerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("slug_url")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  return (data?.slug_url as string) ?? null;
}

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
      .eq("cafe_id", cafe.id_cafe),
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

  return {
    cafe: { nama_cafe: cafe.nama_cafe as string, slug_url: cafe.slug_url as string },
    totals,
    deltas,
    conversion,
    view3dRate,
    totalEvents: (logs ?? []).length,
    daily,
    hourly,
    topDishes,
    recent,
  };
}
