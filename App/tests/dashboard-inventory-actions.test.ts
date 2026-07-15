import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const revalidatePath = vi.fn();
const getOwnerCafeSlug = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
}));

vi.mock("@/lib/analytics", () => ({
  getOwnerCafeSlug,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

type InventoryActionModule = {
  createInventoryItem?: (fd: FormData) => Promise<{ error?: string }>;
  adjustInventoryStock?: (id: string, fd: FormData) => Promise<{ error?: string }>;
  saveMenuRecipes?: (
    menuId: string,
    rows: { inventory_item_id: string; qty_per_menu: number }[]
  ) => Promise<{ error?: string }>;
};

async function inventoryActions(): Promise<InventoryActionModule> {
  return await import("../src/lib/dashboard-actions");
}

function formData(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

describe("inventory dashboard actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getOwnerCafeSlug.mockResolvedValue("cafe-slug");
    from.mockImplementation((table: string) => {
      if (table === "Cafes") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }),
            }),
          }),
        };
      }
      return {};
    });
  });

  it("rejects an inventory item with an invalid unit before inserting", async () => {
    const actions = await inventoryActions();
    expect(actions.createInventoryItem).toBeTypeOf("function");
    if (!actions.createInventoryItem) return;

    const result = await actions.createInventoryItem(
      formData({ name: "Gula", unit: "bag", current_qty: "4" })
    );

    expect(result).toEqual({ error: "Satuan bahan tidak valid." });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("records a manual stock addition with the calculated movement values", async () => {
    const actions = await inventoryActions();
    expect(actions.adjustInventoryStock).toBeTypeOf("function");
    if (!actions.adjustInventoryStock) return;

    const itemSingle = vi.fn().mockResolvedValue({
      data: {
        id_inventory_item: "item-1",
        current_qty: 2,
        unit: "kg",
        estimated_unit_cost: 12_500,
      },
      error: null,
    });
    const updateEqCafe = vi.fn().mockResolvedValue({ error: null });
    const updateEqId = vi.fn(() => ({ eq: updateEqCafe }));
    const update = vi.fn(() => ({ eq: updateEqId }));
    const movementInsert = vi.fn().mockResolvedValue({ error: null });

    from.mockImplementation((table: string) => {
      if (table === "Cafes") {
        return {
          select: () => ({
            eq: () => ({ single: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }) }),
          }),
        };
      }
      if (table === "Inventory_Items") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: itemSingle }) }) }),
          update,
        };
      }
      if (table === "Inventory_Movements") return { insert: movementInsert };
      return {};
    });

    await expect(
      actions.adjustInventoryStock("item-1", formData({ mode: "add", quantity: "3", note: "Restock" }))
    ).resolves.toEqual({});

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ current_qty: 5 }));
    expect(movementInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        cafe_id: "cafe-1",
        inventory_item_id: "item-1",
        movement_type: "manual_add",
        delta_qty: 3,
        qty_before: 2,
        qty_after: 5,
        unit: "kg",
        unit_cost: 12_500,
        reference_type: "manual",
        note: "Restock",
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/inventory");
  });

  it("rejects duplicate inventory items in a menu recipe before replacing it", async () => {
    const actions = await inventoryActions();
    expect(actions.saveMenuRecipes).toBeTypeOf("function");
    if (!actions.saveMenuRecipes) return;

    const result = await actions.saveMenuRecipes("menu-1", [
      { inventory_item_id: "item-1", qty_per_menu: 2 },
      { inventory_item_id: "item-1", qty_per_menu: 1 },
    ]);

    expect(result).toEqual({ error: "Satu bahan tidak boleh muncul dua kali di resep yang sama." });
    expect(from).toHaveBeenCalledTimes(1);
  });
});
