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

  // Agregat omzet & status hari ini dihitung di Postgres (today_orders_summary),
  // bukan dengan menarik semua baris Orders hari ini ke Node.
  const { data, error } = await supabaseAdmin.rpc("today_orders_summary", {
    p_cafe_id: cafeId,
    p_today_start: startOfTodayWIB(),
  });
  if (error) return EMPTY;

  const a = (data ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number => Number(v) || 0;
  return {
    revenueToday: num(a.total_revenue),
    ordersToday: num(a.orders_today),
    activeOrders: num(a.active_orders),
  };
}
