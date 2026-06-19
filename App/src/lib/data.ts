/**
 * Data access layer — swap USE_DUMMY ke false saat Supabase sudah siap.
 */

import type { Cafe, Menu, AnalyticsLog } from "@/types";
import { DUMMY_CAFE, DUMMY_MENUS } from "./dummy-data";

const USE_DUMMY = true; // ← ganti false saat Supabase ready

// ─── Lazy import Supabase helpers (hanya dipanggil kalau tidak dummy) ──────
async function getSupabaseFns() {
  const mod = await import("./supabase");
  return mod;
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function getCafeBySlug(slug: string): Promise<Cafe | null> {
  if (USE_DUMMY) {
    return DUMMY_CAFE.slug_url === slug ? DUMMY_CAFE : null;
  }
  const { getCafeBySlug: fn } = await getSupabaseFns();
  return fn(slug);
}

export async function getMenusByCafeId(cafeId: string): Promise<Menu[]> {
  if (USE_DUMMY) {
    return DUMMY_MENUS.filter((m) => m.cafe_id === cafeId);
  }
  const { getMenusByCafeId: fn } = await getSupabaseFns();
  return fn(cafeId);
}

export async function logEvent(
  payload: Pick<AnalyticsLog, "cafe_id" | "menu_id" | "event_type" | "duration">
): Promise<void> {
  if (USE_DUMMY) return;
  const { logEvent: fn } = await getSupabaseFns();
  fn(payload).catch(() => {/* fire and forget */});
}

export async function getMenuById(
  cafeId: string,
  menuId: string
): Promise<Menu | null> {
  if (USE_DUMMY) {
    return (
      DUMMY_MENUS.find(
        (m) => m.id_menu === menuId && m.cafe_id === cafeId
      ) ?? null
    );
  }
  const { supabase } = await getSupabaseFns();
  const { data, error } = await supabase
    .from("Menus")
    .select("*")
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId)
    .single();
  if (error) return null;
  return data as Menu;
}
