import { createClient } from "@supabase/supabase-js";
import type { Cafe, Menu, AnalyticsLog, Announcement } from "@/types";
import { isMenuAvailableNow } from "./menu-availability";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────
// Cafe queries
// ─────────────────────────────────────────────

/** Fetch a single cafe by its URL slug */
export async function getCafeBySlug(slug: string): Promise<Cafe | null> {
  const { data, error } = await supabase
    .from("Cafes")
    .select("*")
    .eq("slug_url", slug)
    .eq("status_lunas", true)
    .single();

  if (error) return null;
  return data as Cafe;
}

// ─────────────────────────────────────────────
// Menu queries
// ─────────────────────────────────────────────

/** Fetch all customer-visible menus (active + within schedule) for a cafe.
 *
 *  Kolom dipersempit ke yang dipakai daftar menu pelanggan (MenuBrowser/MenuCard +
 *  isMenuAvailableNow). Sisa kolom (redirect_link, usdz, ingredients, model_scale,
 *  sort_order, created_at) hanya dibutuhkan halaman detail/editor, bukan di sini —
 *  mengurangi transfer ketika daftar menu panjang. */
export async function getMenusByCafeId(cafeId: string): Promise<Menu[]> {
  const { data, error } = await supabase
    .from("Menus")
    .select(
      "id_menu, cafe_id, nama_menu, harga_menu, description_menu, category, image_url, model_3d_url, is_active, discount_pct, prep_time_minutes, calories, schedule_days, schedule_start, schedule_end"
    )
    .eq("cafe_id", cafeId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data as Menu[]).filter((m) => isMenuAvailableNow(m));
}

// ─────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────

/** Active announcement banner for a cafe, or null. */
export async function getActiveAnnouncement(cafeId: string): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from("Announcements")
    .select("*")
    .eq("cafe_id", cafeId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as Announcement) ?? null;
}

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────

/** Log a customer interaction event (fire and forget) */
export async function logEvent(
  payload: Pick<AnalyticsLog, "cafe_id" | "menu_id" | "event_type" | "duration">
): Promise<void> {
  await supabase.from("Analytics_Logs").insert([payload]);
}
