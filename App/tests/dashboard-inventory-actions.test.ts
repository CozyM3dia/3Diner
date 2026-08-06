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
  createMenu?: (fd: FormData) => Promise<{ error?: string; id_menu?: string }>;
  createInventoryItem?: (fd: FormData) => Promise<{ error?: string }>;
  updateInventoryItem?: (id: string, fd: FormData) => Promise<{ error?: string }>;
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
              limit: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }),
              }),
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

  it("returns the new menu id from createMenu for recipe sequencing", async () => {
    const actions = await inventoryActions();
    expect(actions.createMenu).toBeTypeOf("function");
    if (!actions.createMenu) return;

    const single = vi.fn().mockResolvedValue({ data: { id_menu: "new-menu" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    from.mockImplementation((table: string) => {
      if (table === "Cafes") {
        return {
          select: () => ({
            eq: () => ({ limit: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }) }) }),
          }),
        };
      }
      if (table === "Menus") return { insert };
      return {};
    });

    await expect(
      actions.createMenu(formData({ nama_menu: "Pasta", harga_menu: "45000" }))
    ).resolves.toEqual({ id_menu: "new-menu" });
  });

  it.each([
    ["current_qty", "-1"],
    ["current_qty", "NaN"],
    ["minimum_qty", "-0.001"],
    ["minimum_qty", "Infinity"],
    ["estimated_unit_cost", "-20"],
    ["estimated_unit_cost", "not-a-number"],
  ])("rejects create inventory item when %s is %s before inserting", async (field, value) => {
    const actions = await inventoryActions();
    expect(actions.createInventoryItem).toBeTypeOf("function");
    if (!actions.createInventoryItem) return;

    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      if (table === "Cafes") {
        return {
          select: () => ({
            eq: () => ({ limit: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }) }) }),
          }),
        };
      }
      if (table === "Inventory_Items") return { insert };
      return {};
    });

    const result = await actions.createInventoryItem(
      formData({
        name: "Gula",
        unit: "gram",
        current_qty: field === "current_qty" ? value : "4",
        minimum_qty: field === "minimum_qty" ? value : "1",
        estimated_unit_cost: field === "estimated_unit_cost" ? value : "5000",
      })
    );

    expect(result).toEqual({ error: "Angka inventory tidak valid." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects update inventory item with invalid numeric fields before updating", async () => {
    const actions = await inventoryActions();
    expect(actions.updateInventoryItem).toBeTypeOf("function");
    if (!actions.updateInventoryItem) return;

    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() });
    from.mockImplementation((table: string) => {
      if (table === "Cafes") {
        return {
          select: () => ({
            eq: () => ({ limit: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }) }) }),
          }),
        };
      }
      if (table === "Inventory_Items") return { update };
      return {};
    });

    const result = await actions.updateInventoryItem(
      "item-1",
      formData({
        name: "Gula",
        unit: "gram",
        current_qty: "4",
        minimum_qty: "bad",
        estimated_unit_cost: "5000",
      })
    );

    expect(result).toEqual({ error: "Angka inventory tidak valid." });
    expect(update).not.toHaveBeenCalled();
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
            eq: () => ({ limit: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }) }) }),
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

  it("rejects zero add and subtract adjustments before the RPC while allowing set zero through", async () => {
    const actions = await inventoryActions();
    expect(actions.adjustInventoryStock).toBeTypeOf("function");
    if (!actions.adjustInventoryStock) return;

    await expect(
      actions.adjustInventoryStock("item-1", formData({ mode: "add", quantity: "0", note: "" }))
    ).resolves.toEqual({ error: "Jumlah penyesuaian harus lebih dari 0." });
    await expect(
      actions.adjustInventoryStock("item-1", formData({ mode: "subtract", quantity: "0", note: "" }))
    ).resolves.toEqual({ error: "Jumlah penyesuaian harus lebih dari 0." });

    expect(rpc).not.toHaveBeenCalled();

    await expect(
      actions.adjustInventoryStock("item-1", formData({ mode: "set", quantity: "0", note: "" }))
    ).resolves.toEqual({});

    expect(rpc).toHaveBeenCalledWith("adjust_inventory_stock", {
      p_cafe_id: "cafe-1",
      p_inventory_item_id: "item-1",
      p_mode: "set",
      p_quantity: 0,
      p_note: null,
    });
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

  it.each([
    ["blank inventory item", [{ inventory_item_id: " ", qty_per_menu: 1 }]],
    ["zero quantity", [{ inventory_item_id: "item-1", qty_per_menu: 0 }]],
    ["negative quantity", [{ inventory_item_id: "item-1", qty_per_menu: -1 }]],
    ["non-finite quantity", [{ inventory_item_id: "item-1", qty_per_menu: Number.NaN }]],
  ])("rejects %s in recipe rows before the RPC", async (_name, rows) => {
    const actions = await inventoryActions();
    expect(actions.saveMenuRecipes).toBeTypeOf("function");
    if (!actions.saveMenuRecipes) return;

    const result = await actions.saveMenuRecipes("menu-1", rows);

    expect(result).toEqual({ error: "Data resep tidak valid." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("allows an intentional empty recipe list to clear recipes through the RPC", async () => {
    const actions = await inventoryActions();
    expect(actions.saveMenuRecipes).toBeTypeOf("function");
    if (!actions.saveMenuRecipes) return;

    await expect(actions.saveMenuRecipes("menu-1", [])).resolves.toEqual({});

    expect(rpc).toHaveBeenCalledWith("replace_menu_recipes", {
      p_cafe_id: "cafe-1",
      p_menu_id: "menu-1",
      p_rows: [],
    });
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
            eq: () => ({ limit: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id_cafe: "cafe-1" } }) }) }),
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
