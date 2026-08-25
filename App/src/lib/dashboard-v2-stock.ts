import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InventoryUnit } from "@/types";
import {
  countsByTab,
  type StockPage,
  type StockRow,
} from "@/lib/dashboard-v2-stock-view";

/** Lapisan DATA stok (server-only lewat supabaseAdmin).
 *
 *  Helper view/tipe/penghitung hidup di `dashboard-v2-stock-view.ts` yang aman
 *  dipakai komponen klien; modul ini hanya berisi query. */
export * from "@/lib/dashboard-v2-stock-view";

export async function getStockPage(cafeId: string | null): Promise<StockPage> {
  const empty: StockPage = {
    rows: [],
    counts: { menipis: 0, habis: 0, semua: 0 },
    menusByItem: new Map(),
    lastAdjustedAt: null,
    error: null,
  };
  if (!cafeId) return { ...empty, error: "Kafe belum terhubung ke akun ini." };

  const [itemsResult, recipesResult, lastMove] = await Promise.all([
    supabaseAdmin
      .from("Inventory_Items")
      .select("id_inventory_item,name,unit,current_qty,minimum_qty")
      .eq("cafe_id", cafeId),
    supabaseAdmin.from("Menu_Recipes").select("menu_id,inventory_item_id").eq("cafe_id", cafeId),
    supabaseAdmin
      .from("Inventory_Movements")
      .select("created_at")
      .eq("cafe_id", cafeId)
      .in("movement_type", ["manual_add", "manual_subtract", "manual_set"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (itemsResult.error) return { ...empty, error: itemsResult.error.message };

  const menusByItem = new Map<string, Set<string>>();
  for (const r of recipesResult.data ?? []) {
    const set = menusByItem.get(r.inventory_item_id) ?? new Set<string>();
    set.add(r.menu_id);
    menusByItem.set(r.inventory_item_id, set);
  }

  const rows: StockRow[] = (itemsResult.data ?? []).map((i) => ({
    id_inventory_item: i.id_inventory_item,
    name: i.name,
    unit: i.unit as InventoryUnit,
    current_qty: Number(i.current_qty),
    minimum_qty: Number(i.minimum_qty),
    affectedMenus: menusByItem.get(i.id_inventory_item)?.size ?? 0,
  }));

  return {
    rows,
    counts: countsByTab(rows),
    menusByItem,
    lastAdjustedAt: lastMove.data?.created_at ?? null,
    error: null,
  };
}
