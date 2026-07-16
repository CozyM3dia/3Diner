import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuListPage from "../src/app/dashboard/menu/page";
import MenuTable from "../src/components/dashboard/MenuTable";
import type { Menu } from "../src/types";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOwnerCafeSlug: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/dashboard-actions", () => ({
  reorderMenus: vi.fn(async () => ({})),
  setMenuAvailability: vi.fn(async () => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock("@/lib/analytics", () => ({
  getOwnerCafeSlug: mocks.getOwnerCafeSlug,
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: mocks.from },
}));

const menus: Menu[] = [
  {
    id_menu: "menu-ready",
    cafe_id: "cafe-1",
    nama_menu: "Es Kopi",
    harga_menu: 18000,
    description_menu: null,
    model_3d_url: "",
    redirect_link: "",
    created_at: "2026-01-01T00:00:00.000Z",
    category: "Minuman",
    is_active: true,
  },
  {
    id_menu: "menu-low",
    cafe_id: "cafe-1",
    nama_menu: "Nasi Goreng",
    harga_menu: 32000,
    description_menu: null,
    model_3d_url: "",
    redirect_link: "",
    created_at: "2026-01-02T00:00:00.000Z",
    category: "Makanan",
    is_active: true,
  },
  {
    id_menu: "menu-none",
    cafe_id: "cafe-1",
    nama_menu: "Roti Bakar",
    harga_menu: 22000,
    description_menu: null,
    model_3d_url: "",
    redirect_link: "",
    created_at: "2026-01-03T00:00:00.000Z",
    category: null,
    is_active: false,
  },
];

function queryResult(data: unknown, error: Error | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: <T,>(resolve: (value: { data: unknown; error: Error | null }) => T) =>
      Promise.resolve({ data, error }).then(resolve),
  };
}

function renderPage(recipes: unknown[], recipesError: Error | null = null) {
  const cafeQuery = queryResult({ id_cafe: "cafe-1" });
  const menuQuery = queryResult(menus);
  const recipeQuery = queryResult(recipes, recipesError);

  mocks.from.mockImplementation((table: string) => {
    if (table === "Cafes") return cafeQuery;
    if (table === "Menus") return menuQuery;
    if (table === "Menu_Recipes") return recipeQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  return MenuListPage().then(renderToStaticMarkup);
}

describe("MenuTable inventory readiness", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    mocks.getOwnerCafeSlug.mockResolvedValue("cafe-slug");
    mocks.from.mockReset();
  });

  it("renders compact, accessible readiness labels for each menu row", () => {
    const html = renderToStaticMarkup(
      React.createElement(MenuTable, {
        menus,
        inventoryByMenu: {
          "menu-ready": "ready",
          "menu-low": "low",
        },
      })
    );

    expect(html).toMatch(/<table[^>]*aria-label="Daftar menu"/);
    expect(html).toContain("Resep aktif");
    expect(html).toContain("Stok kurang");
    expect(html).toContain("Tanpa resep");
  });

  it("renders object and array recipe joins while preserving the lowest readiness", async () => {
    const html = await renderPage([
      { menu_id: "menu-ready", qty_per_menu: 2, inventory_item: { current_qty: 10 } },
      { menu_id: "menu-low", qty_per_menu: 10, inventory_item: [{ current_qty: 8 }] },
      { menu_id: "menu-low", qty_per_menu: 1, inventory_item: { current_qty: 10 } },
    ]);

    expect(html).toContain("Resep aktif");
    expect(html.match(/Stok kurang/g)).toHaveLength(1);
    expect(html.match(/Tanpa resep/g)).toHaveLength(1);
  });

  it("surfaces recipe query failures instead of rendering every menu without a recipe", async () => {
    await expect(renderPage([], new Error("recipe query unavailable"))).rejects.toThrow(
      "Gagal memuat resep menu: recipe query unavailable"
    );
  });
});
