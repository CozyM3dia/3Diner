import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Box } from "lucide-react";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MenuTable from "@/components/dashboard/MenuTable";
import MenuExtractor from "@/components/dashboard/MenuExtractor";
import AiCreditMeter from "@/components/dashboard/AiCreditMeter";
import { getCreditStatus } from "@/lib/ai-credits";
import type { Menu } from "@/types";

type MenuInventoryState = "none" | "ready" | "low";
type MenuRecipeRow = {
  menu_id: string;
  qty_per_menu: number;
  inventory_item?: { current_qty: number } | { current_qty: number }[] | null;
};

export default async function MenuListPage() {
  const { userId, cafeId } = await getDashboardCafeContext();
  if (!userId) redirect("/login");

  const creditStatus = cafeId ? await getCreditStatus(cafeId) : null;

  const [menuResult, recipeResult] = cafeId
    ? await Promise.all([
        supabaseAdmin
          .from("Menus")
          .select("*")
          .eq("cafe_id", cafeId)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("Menu_Recipes")
          .select("menu_id,qty_per_menu,inventory_item:Inventory_Items(current_qty)")
          .eq("cafe_id", cafeId),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const { data: menus, error: menusError } = menuResult;
  const { data: recipes, error: recipesError } = recipeResult;

  if (menusError) {
    throw new Error(`Gagal memuat menu: ${menusError.message}`);
  }
  if (recipesError) {
    throw new Error(`Gagal memuat resep menu: ${recipesError.message}`);
  }

  const list = (menus ?? []) as Menu[];
  const inventoryByMenu: Record<string, MenuInventoryState> = {};
  for (const menu of list) inventoryByMenu[menu.id_menu] = "none";

  for (const recipe of recipes ?? []) {
    const row = recipe as MenuRecipeRow;
    const joinedInventory = Array.isArray(row.inventory_item) ? row.inventory_item[0] : row.inventory_item;
    const current = Number(joinedInventory?.current_qty ?? 0);
    const state: MenuInventoryState = current >= Number(row.qty_per_menu) ? "ready" : "low";
    inventoryByMenu[row.menu_id] = inventoryByMenu[row.menu_id] === "low" || state === "low" ? "low" : "ready";
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 dash-reveal">
        <div>
          <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--dash-text)" }}>Menu</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>{list.length} item terdaftar</p>
        </div>
        {/* Mobile: stacked full-width (primary on top); sm+: inline row */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 sm:gap-2.5 [&_button]:w-full sm:[&_button]:w-auto">
          <MenuExtractor />
          <Link
            href="/dashboard/menu/new"
            className="dash-btn inline-flex items-center justify-center gap-2 px-3.5 rounded-[10px] text-[13px] font-semibold dash-on-accent"
            style={{ background: "var(--orange)", height: "38px" }}
          >
            <Plus size={15} /> Tambah Menu
          </Link>
        </div>
      </div>

      {/* Meteran jatah diletakkan di atas daftar menu karena di halaman inilah
          tombol yang membakar credit berada. */}
      <div className="mb-5 dash-reveal">
        <AiCreditMeter status={creditStatus} />
      </div>

      {list.length === 0 ? (
        <div className="dash-panel flex flex-col items-center justify-center py-24">
          <Box size={38} style={{ color: "var(--dash-muted)" }} strokeWidth={1.2} />
          <p className="mt-4 font-semibold" style={{ color: "var(--dash-text)" }}>Belum ada menu</p>
          <p className="text-sm mt-1 mb-6" style={{ color: "var(--dash-muted)" }}>Tambah menu pertama untuk kafe kamu</p>
          <Link href="/dashboard/menu/new" className="dash-btn inline-flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] text-[13px] font-semibold dash-on-accent" style={{ background: "var(--orange)" }}>
            <Plus size={15} /> Tambah Menu
          </Link>
        </div>
      ) : (
        <MenuTable menus={list} inventoryByMenu={inventoryByMenu} />
      )}
    </div>
  );
}
