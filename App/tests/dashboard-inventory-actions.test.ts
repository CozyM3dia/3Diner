import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();
const revalidatePath = vi.fn();
const getOwnerCafeSlug = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from, rpc },
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
    rpc.mockResolvedValue({ data: {}, error: null });
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

  it("uses the atomic stock adjustment RPC instead of separate inventory writes", async () => {
    const actions = await inventoryActions();
    expect(actions.adjustInventoryStock).toBeTypeOf("function");
    if (!actions.adjustInventoryStock) return;

    const itemSingle = vi.fn().mockResolvedValue({
      data: { current_qty: 2, unit: "kg", estimated_unit_cost: 12_500 },
      error: null,
    });
    const update = vi.fn(() => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }));
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

    expect(rpc).toHaveBeenCalledWith("adjust_inventory_stock", {
      p_cafe_id: "cafe-1",
      p_inventory_item_id: "item-1",
      p_mode: "add",
      p_quantity: 3,
      p_note: "Restock",
    });
    expect(update).not.toHaveBeenCalled();
    expect(movementInsert).not.toHaveBeenCalled();
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

  it("uses the atomic recipe replacement RPC for valid recipe rows", async () => {
    const actions = await inventoryActions();
    expect(actions.saveMenuRecipes).toBeTypeOf("function");
    if (!actions.saveMenuRecipes) return;

    const menuSingle = vi.fn().mockResolvedValue({ data: { id_menu: "menu-1" }, error: null });
    const recipeDelete = vi.fn(() => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }));
    const recipeInsert = vi.fn().mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      if (table === "Cafes") {
        return {
          select: () => ({
            eq: () => ({ single: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }) }),
          }),
        };
      }
      if (table === "Menus") return { select: () => ({ eq: () => ({ eq: () => ({ single: menuSingle }) }) }) };
      if (table === "Menu_Recipes") return { delete: recipeDelete, insert: recipeInsert };
      return {};
    });

    await expect(
      actions.saveMenuRecipes("menu-1", [{ inventory_item_id: "item-1", qty_per_menu: 2.5 }])
    ).resolves.toEqual({});

    expect(rpc).toHaveBeenCalledWith("replace_menu_recipes", {
      p_cafe_id: "cafe-1",
      p_menu_id: "menu-1",
      p_rows: [{ inventory_item_id: "item-1", qty_per_menu: 2.5 }],
    });
    expect(recipeDelete).not.toHaveBeenCalled();
    expect(recipeInsert).not.toHaveBeenCalled();
  });

  it("surfaces a cross-cafe inventory item rejection without replacing recipes", async () => {
    const actions = await inventoryActions();
    expect(actions.saveMenuRecipes).toBeTypeOf("function");
    if (!actions.saveMenuRecipes) return;

    rpc.mockResolvedValue({ data: { error: "inventory_item_not_found" }, error: null });

    await expect(
      actions.saveMenuRecipes("menu-1", [{ inventory_item_id: "other-cafe-item", qty_per_menu: 1 }])
    ).resolves.toEqual({ error: "Bahan tidak ditemukan." });

    expect(rpc).toHaveBeenCalledWith("replace_menu_recipes", {
      p_cafe_id: "cafe-1",
      p_menu_id: "menu-1",
      p_rows: [{ inventory_item_id: "other-cafe-item", qty_per_menu: 1 }],
    });
    expect(from).not.toHaveBeenCalledWith("Menu_Recipes");
    expect(revalidatePath).not.toHaveBeenCalledWith("/dashboard/menu");
  });
});
