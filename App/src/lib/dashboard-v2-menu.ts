import { supabaseAdmin } from "@/lib/supabase-admin";
import { isMenuAvailableNow } from "@/lib/menu-availability";
import type { Menu } from "@/types";
import {
  countCategories,
  menuCounts,
  type MenuPage,
  type MenuRow,
} from "@/lib/dashboard-v2-menu-view";

/** Lapisan DATA menu (server-only lewat supabaseAdmin).
 *
 *  Helper view/tipe/penghitung hidup di `dashboard-v2-menu-view.ts` yang aman
 *  dipakai komponen klien; modul ini hanya berisi query. */
export * from "@/lib/dashboard-v2-menu-view";

export async function getMenuPage(cafeId: string | null, now = new Date()): Promise<MenuPage> {
  const empty: MenuPage = {
    rows: [],
    counts: { aktif: 0, nonaktif: 0, semua: 0 },
    categories: 0,
    error: null,
  };
  if (!cafeId) return { ...empty, error: "Kafe belum terhubung ke akun ini." };

  const [menusResult, recipesResult, itemsResult] = await Promise.all([
    supabaseAdmin.from("Menus").select("*").eq("cafe_id", cafeId),
    supabaseAdmin.from("Menu_Recipes").select("menu_id,inventory_item_id").eq("cafe_id", cafeId),
    supabaseAdmin
      .from("Inventory_Items")
      .select("id_inventory_item,current_qty,minimum_qty")
      .eq("cafe_id", cafeId),
  ]);

  if (menusResult.error) return { ...empty, error: menusResult.error.message };

  const lowItems = new Set(
    (itemsResult.data ?? [])
      .filter((i) => Number(i.current_qty) <= Number(i.minimum_qty))
      .map((i) => i.id_inventory_item)
  );
  const blockedMenus = new Set(
    (recipesResult.data ?? [])
      .filter((r) => lowItems.has(r.inventory_item_id))
      .map((r) => r.menu_id)
  );

  const rows: MenuRow[] = (menusResult.data ?? []).map((m) => {
    const menu = m as Menu;
    const scheduled = Boolean(
      menu.schedule_days || menu.schedule_start || menu.schedule_end
    );
    return {
      id_menu: menu.id_menu,
      nama_menu: menu.nama_menu,
      category: menu.category ?? null,
      harga_menu: menu.harga_menu,
      discount_pct: menu.discount_pct ?? null,
      is_active: menu.is_active !== false,
      has3d: Boolean(String(menu.model_3d_url ?? "").trim()),
      hasAr: Boolean(String(menu.usdz_url ?? "").trim()),
      scheduled,
      outOfStock: blockedMenus.has(menu.id_menu),
      liveNow: isMenuAvailableNow(menu, now) && !blockedMenus.has(menu.id_menu),
      sort_order: menu.sort_order ?? Number.MAX_SAFE_INTEGER,
    };
  });

  return {
    rows,
    counts: menuCounts(rows),
    categories: countCategories(rows),
    error: null,
  };
}
