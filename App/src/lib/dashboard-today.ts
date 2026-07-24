import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCafeBySlug } from "@/lib/analytics";

export interface TodayOps {
  /** Total omzet pesanan yang dibuat hari ini (WIB) */
  revenueToday: number;
  /** Pesanan berstatus received/preparing (belum siap) */
  activeOrders: number;
  /** Jumlah pesanan hari ini */
  ordersToday: number;
}

const EMPTY: TodayOps = { revenueToday: 0, activeOrders: 0, ordersToday: 0 };

/** Awal hari ini dalam WIB (Asia/Jakarta), sebagai ISO UTC untuk filter created_at. */
export function startOfTodayWIB(now = new Date()): string {
  const wibDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // yyyy-mm-dd
  return new Date(`${wibDate}T00:00:00+07:00`).toISOString();
}

export async function getTodayOps(slug: string | null): Promise<TodayOps> {
  if (!slug) return EMPTY;

  const cafe = await getCafeBySlug(slug);
  const cafeId = cafe?.id_cafe;
  if (!cafeId) return EMPTY;

  const [todayResult, activeResult] = await Promise.all([
    supabaseAdmin
      .from("Orders")
      .select("total")
      .eq("cafe_id", cafeId)
      .gte("created_at", startOfTodayWIB()),
    supabaseAdmin
      .from("Orders")
      .select("id_order", { count: "exact", head: true })
      .eq("cafe_id", cafeId)
      .in("status", ["received", "preparing"]),
  ]);

  const rows = (todayResult.data ?? []) as { total: number }[];
  return {
    revenueToday: rows.reduce((sum, r) => sum + (r.total ?? 0), 0),
    ordersToday: rows.length,
    activeOrders: activeResult.count ?? 0,
  };
}
