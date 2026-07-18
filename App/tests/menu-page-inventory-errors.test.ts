import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewMenuPage from "../src/app/dashboard/menu/new/page";
import EditMenuPage from "../src/app/dashboard/menu/[id]/edit/page";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOwnerCafeSlug: vi.fn(),
  from: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
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

vi.mock("@/lib/dashboard-actions", () => ({
  createMenu: vi.fn(async () => ({})),
  updateMenu: vi.fn(async () => ({})),
  deleteMenu: vi.fn(async () => ({})),
  saveMenuRecipes: vi.fn(async () => ({})),
}));

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

const menu = {
  id_menu: "menu-1",
  cafe_id: "cafe-1",
  nama_menu: "Pasta",
  harga_menu: 45000,
  description_menu: null,
  model_3d_url: "",
  redirect_link: "",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("menu page inventory query errors", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    mocks.getOwnerCafeSlug.mockResolvedValue("cafe-slug");
    mocks.from.mockReset();
  });

  it("renders a blocking Indonesian error on new menu inventory query failure", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "Cafes") return queryResult({ id_cafe: "cafe-1" });
      if (table === "Inventory_Items") return queryResult(null, new Error("inventory unavailable"));
      throw new Error(`Unexpected table: ${table}`);
    });

    const html = renderToStaticMarkup(await NewMenuPage());

    expect(html).toContain("Inventory belum dapat dimuat");
    expect(html).toContain("Terjadi kendala saat memuat bahan inventory");
  });

  it("renders a blocking Indonesian error on edit menu inventory query failure", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "Cafes") return queryResult({ id_cafe: "cafe-1" });
      if (table === "Menus") return queryResult(menu);
      if (table === "Inventory_Items") return queryResult(null, new Error("inventory unavailable"));
      if (table === "Menu_Recipes") return queryResult([]);
      throw new Error(`Unexpected table: ${table}`);
    });

    const html = renderToStaticMarkup(await EditMenuPage({ params: Promise.resolve({ id: "menu-1" }) }));

    expect(html).toContain("Inventory belum dapat dimuat");
    expect(html).toContain("Terjadi kendala saat memuat bahan inventory");
  });
});
