import { createClient } from "@supabase/supabase-js";
import type { Cafe, Menu, AnalyticsLog, Announcement } from "@/types";
import { isMenuAvailableNow } from "./menu-availability";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────
// Cafe queries
// ─────────────────────────────────────────────

/** Fetch a single cafe by its URL slug.
 *
 *  Kolom dipersempit ke yang dipakai halaman menu pelanggan; status_lunas
 *  dipakai sebagai filter WHERE, tidak perlu ditarik ulang. */
export async function getCafeBySlug(slug: string): Promise<Cafe | null> {
  const { data, error } = await supabase
    .from("Cafes")
    .select(CAFE_PUBLIC_COLUMNS)
    .eq("slug_url", slug)
    .eq("status_lunas", true)
    .single();

  if (error) return null;
  return data as Cafe;
}

const CAFE_PUBLIC_COLUMNS =
  "id_cafe, slug_url, nama_cafe, cover_url, logo_url, greeting, alamat_cafe, google_maps_review_url";

const MENU_COLUMNS =
  "id_menu, cafe_id, nama_menu, harga_menu, description_menu, category, image_url, model_3d_url, is_active, discount_pct, prep_time_minutes, calories, schedule_days, schedule_start, schedule_end";

/** Kolom halaman detail + viewer 3D. Ditambah ingredients/usdz/scale —
 *  tidak ikut daftar menu supaya kartu katalog tetap ringan. */
const MENU_DETAIL_COLUMNS = `${MENU_COLUMNS}, ingredients, usdz_url, model_scale`;

/** Fetch cafe + menus + active announcement in ONE roundtrip.
 *
 *  Sebelumnya halaman [slug] menjalankan waterfall 2 fase (cafe dulu, lalu
 *  menus ∥ announcement). Embedding PostgREST menghemat satu roundtrip ke
 *  region Supabase pada setiap cache-miss/revalidate ISR. */
export async function getMenuPageBySlug(
  slug: string
): Promise<{ cafe: Cafe; menus: Menu[]; announcement: Announcement | null } | null> {
  const { data, error } = await supabase
    .from("Cafes")
    .select(
      `${CAFE_PUBLIC_COLUMNS},
       Menus!cafe_id(${MENU_COLUMNS}),
       Announcements!cafe_id(id, cafe_id, message, bg_color, type, is_active)`
    )
    .eq("slug_url", slug)
    .eq("status_lunas", true)
    .eq("Announcements.is_active", true)
    .order("sort_order", { referencedTable: "Menus", ascending: true, nullsFirst: false })
    .order("created_at", { referencedTable: "Menus", ascending: true })
    .order("updated_at", { referencedTable: "Announcements", ascending: false })
    .limit(1, { referencedTable: "Announcements" })
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    id_cafe: string;
    Menus?: Menu[];
    Announcements?: Announcement[];
  };

  const menus = (row.Menus ?? []).filter((m) => isMenuAvailableNow(m));
  const announcements = row.Announcements ?? [];

  return {
    cafe: data as unknown as Cafe,
    menus,
    announcement: announcements[0] ?? null,
  };
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
    .select(MENU_COLUMNS)
    .eq("cafe_id", cafeId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data as Menu[]).filter((m) => isMenuAvailableNow(m));
}

/** Satu roundtrip: kafe (slug lunas) + satu menu. Mengganti waterfall
 *  getCafeBySlug lalu getMenuById pada halaman detail dan viewer 3D. */
export async function getCafeAndMenuBySlug(
  slug: string,
  menuId: string
): Promise<{ cafe: Cafe; menu: Menu } | null> {
  const { data, error } = await supabase
    .from("Cafes")
    .select(`${CAFE_PUBLIC_COLUMNS}, Menus!inner(${MENU_DETAIL_COLUMNS})`)
    .eq("slug_url", slug)
    .eq("status_lunas", true)
    .eq("Menus.id_menu", menuId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as Cafe & { Menus?: Menu[] };
  const menu = row.Menus?.[0];
  if (!menu) return null;
  const { Menus: _, ...cafe } = row;
  void _;
  return { cafe: cafe as Cafe, menu };
}

export async function getMenuById(cafeId: string, menuId: string): Promise<Menu | null> {
  const { data, error } = await supabase
    .from("Menus")
    .select(MENU_DETAIL_COLUMNS)
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Menu;
}

// ─────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────

/** Active announcement banner for a cafe, or null. */
export async function getActiveAnnouncement(cafeId: string): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from("Announcements")
    .select("id, cafe_id, message, bg_color, type, is_active")
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
