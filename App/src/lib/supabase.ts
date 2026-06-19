import { createClient } from "@supabase/supabase-js";
import type { Cafe, Menu, AnalyticsLog } from "@/types";

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

/** Fetch all menus belonging to a cafe */
export async function getMenusByCafeId(cafeId: string): Promise<Menu[]> {
  const { data, error } = await supabase
    .from("Menus")
    .select("*")
    .eq("cafe_id", cafeId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return data as Menu[];
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
