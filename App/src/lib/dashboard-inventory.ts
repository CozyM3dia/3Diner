import { getOwnerCafeSlug, getCafeBySlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InventoryItem, InventoryMovement } from "@/types";

export interface InventorySummary {
  total: number;
  low: number;
  empty: number;
  value: number;
}

export interface DashboardInventoryData {
  items: InventoryItem[];
  movements: InventoryMovement[];
  summary: InventorySummary;
  failedLoads: string[];
}

export function summarizeInventory(items: Pick<InventoryItem, "current_qty" | "minimum_qty" | "estimated_unit_cost">[]): InventorySummary {
  return {
    total: items.length,
    low: items.filter((item) => item.current_qty > 0 && item.current_qty <= item.minimum_qty).length,
    empty: items.filter((item) => item.current_qty <= 0).length,
    value: items.reduce((sum, item) => sum + item.current_qty * item.estimated_unit_cost, 0),
  };
}

export function criticalInventoryItems(items: InventoryItem[], limit = 4): InventoryItem[] {
  return [...items]
    .filter((item) => item.current_qty <= item.minimum_qty)
    .sort((a, b) => {
      if (a.current_qty <= 0 && b.current_qty > 0) return -1;
      if (b.current_qty <= 0 && a.current_qty > 0) return 1;
      return a.current_qty - a.minimum_qty - (b.current_qty - b.minimum_qty);
    })
    .slice(0, limit);
}

export async function getDashboardInventoryDataForSlug(slug: string | null): Promise<DashboardInventoryData> {
  const empty: DashboardInventoryData = {
    items: [],
    movements: [],
    summary: summarizeInventory([]),
    failedLoads: [],
  };

  if (!slug) {
    return { ...empty, failedLoads: ["profil kafe"] };
  }

  const cafe = await getCafeBySlug(slug);

  const cafeId = cafe?.id_cafe;
  if (!cafeId) {
    return { ...empty, failedLoads: ["profil kafe"] };
  }

  const [itemsResult, movementsResult] = await Promise.all([
    supabaseAdmin
      .from("Inventory_Items")
      .select("*")
      .eq("cafe_id", cafeId)
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("Inventory_Movements")
      .select("*, inventory_item:Inventory_Items(name, unit)")
      .eq("cafe_id", cafeId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const items = (itemsResult.data ?? []) as InventoryItem[];
  const movements = (movementsResult.data ?? []) as InventoryMovement[];
  const failedLoads = [
    itemsResult.error ? "data bahan" : null,
    movementsResult.error ? "riwayat mutasi" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    items,
    movements,
    summary: summarizeInventory(items),
    failedLoads,
  };
}

export async function getDashboardInventoryDataForOwner(ownerId: string): Promise<DashboardInventoryData> {
  const slug = await getOwnerCafeSlug(ownerId);
  return getDashboardInventoryDataForSlug(slug);
}
