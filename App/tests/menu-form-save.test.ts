import { describe, expect, it, vi } from "vitest";
import { saveMenuAndRecipes } from "../src/lib/menu-form-save";

const fd = new FormData();
const rows = [{ inventory_item_id: "item-1", qty_per_menu: 2 }];

describe("saveMenuAndRecipes", () => {
  it("saves an existing menu before recipes and navigates only after both succeed", async () => {
    const order: string[] = [];
    const onSave = vi.fn(async () => {
      order.push("menu");
      return {};
    });
    const saveRecipes = vi.fn(async () => {
      order.push("recipes");
      return {};
    });
    const navigate = vi.fn(() => order.push("navigate"));
    const refresh = vi.fn(() => order.push("refresh"));

    await expect(
      saveMenuAndRecipes({
        fd,
        menuId: "menu-1",
        rows,
        onSave,
        saveRecipes,
        navigate,
        refresh,
      })
    ).resolves.toEqual({});

    expect(saveRecipes).toHaveBeenCalledWith("menu-1", rows);
    expect(order).toEqual(["menu", "recipes", "navigate", "refresh"]);
  });

  it("uses the new menu id returned by createMenu before saving recipes", async () => {
    const onSave = vi.fn(async () => ({ id_menu: "new-menu" }));
    const saveRecipes = vi.fn(async () => ({}));
    const navigate = vi.fn();
    const refresh = vi.fn();

    await expect(
      saveMenuAndRecipes({
        fd,
        rows,
        onSave,
        saveRecipes,
        navigate,
        refresh,
      })
    ).resolves.toEqual({});

    expect(saveRecipes).toHaveBeenCalledWith("new-menu", rows);
    expect(navigate).toHaveBeenCalledWith("/dashboard/menu");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps a newly-created menu on the page when recipe save fails", async () => {
    const onSave = vi.fn(async () => ({ id_menu: "new-menu" }));
    const saveRecipes = vi.fn(async () => ({ error: "Bahan tidak ditemukan." }));
    const navigate = vi.fn();
    const refresh = vi.fn();

    await expect(
      saveMenuAndRecipes({
        fd,
        rows,
        onSave,
        saveRecipes,
        navigate,
        refresh,
      })
    ).resolves.toEqual({
      error: "Menu tersimpan tetapi resep gagal: Bahan tidak ditemukan.",
      persistedMenuId: "new-menu",
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("retries recipes for a newly-created menu without creating another menu", async () => {
    const onSave = vi.fn(async () => ({ id_menu: "duplicate-menu" }));
    const saveRecipes = vi.fn(async () => ({}));
    const navigate = vi.fn();
    const refresh = vi.fn();

    await expect(
      saveMenuAndRecipes({
        fd,
        menuId: "new-menu",
        rows,
        onSave,
        saveRecipes,
        navigate,
        refresh,
        skipMenuSave: true,
      })
    ).resolves.toEqual({});

    expect(onSave).not.toHaveBeenCalled();
    expect(saveRecipes).toHaveBeenCalledWith("new-menu", rows);
    expect(navigate).toHaveBeenCalledWith("/dashboard/menu");
  });
});
