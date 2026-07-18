import { INVENTORY_UNITS, type InventoryStatus, type InventoryUnit } from "@/types";

export { INVENTORY_UNITS };

export interface InventoryStatusInput {
  current_qty: number;
  minimum_qty: number;
}

export interface RecipeRequirementInput {
  menu_id: string;
  inventory_item_id: string;
  qty_per_menu: number;
}

export interface RequestedMenuQty {
  id_menu: string;
  qty: number;
}

export interface RequiredInventory {
  inventory_item_id: string;
  required_qty: number;
}

export function isInventoryUnit(value: unknown): value is InventoryUnit {
  return typeof value === "string" && (INVENTORY_UNITS as readonly string[]).includes(value);
}

export function inventoryStatus(item: InventoryStatusInput): InventoryStatus {
  if (item.current_qty <= 0) return "empty";
  if (item.current_qty <= item.minimum_qty) return "low";
  return "safe";
}

export function formatQty(value: number, unit: InventoryUnit | string): string {
  const formatted = Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 3,
  });
  return `${formatted} ${unit}`;
}

export function requiredInventoryForOrder(
  recipes: RecipeRequirementInput[],
  items: RequestedMenuQty[]
): RequiredInventory[] {
  const qtyByMenu = new Map(items.map((item) => [item.id_menu, item.qty]));
  const required = new Map<string, number>();

  for (const recipe of recipes) {
    const orderedQty = qtyByMenu.get(recipe.menu_id) ?? 0;
    if (orderedQty <= 0) continue;
    required.set(
      recipe.inventory_item_id,
      (required.get(recipe.inventory_item_id) ?? 0) + recipe.qty_per_menu * orderedQty
    );
  }

  return [...required.entries()].map(([inventory_item_id, required_qty]) => ({
    inventory_item_id,
    required_qty,
  }));
}
