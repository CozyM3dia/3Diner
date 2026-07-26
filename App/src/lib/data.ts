import { cache } from "react";
import type { Cafe, Menu, AnalyticsLog, Announcement } from "@/types";

async function getSupabaseFns() {
  return import("./supabase");
}

export async function getActiveAnnouncement(cafeId: string): Promise<Announcement | null> {
  const { getActiveAnnouncement: fn } = await getSupabaseFns();
  return fn(cafeId);
}

/** `generateMetadata` dan komponen halaman berjalan dalam satu request yang
 *  sama dan memerlukan kafe serta menu yang persis sama. Tanpa cache(), tiap
 *  halaman menu menembak Supabase dua kali untuk jawaban yang identik. */
export const getCafeBySlug = cache(async (slug: string): Promise<Cafe | null> => {
  const { getCafeBySlug: fn } = await getSupabaseFns();
  return fn(slug);
});

export async function getMenusByCafeId(cafeId: string): Promise<Menu[]> {
  const { getMenusByCafeId: fn } = await getSupabaseFns();
  return fn(cafeId);
}

export async function logEvent(
  payload: Pick<AnalyticsLog, "cafe_id" | "menu_id" | "event_type" | "duration">
): Promise<void> {
  const { logEvent: fn } = await getSupabaseFns();
  fn(payload).catch(() => {/* fire and forget */});
}

export const getMenuById = cache(async (
  cafeId: string,
  menuId: string
): Promise<Menu | null> => {
  const { supabase } = await getSupabaseFns();
  const { data, error } = await supabase
    .from("Menus")
    .select("*")
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId)
    .single();
  if (error) return null;
  return data as Menu;
});
