import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AddonsTable, { type AddonRow } from "@/components/dp/AddonsTable";

export const metadata = { title: "Addons · 3Diner" };
export const dynamic = "force-dynamic";

/** Addons — recreation `addons.html` Dream POS.
 *  Sumber data nyata: Menu_Option_Groups (grup pilihan per-menu)
 *  → Menu_Option_Values (pilihan: nama, price_delta, is_active).
 *  Pemetaan kolom template: Item=menu, Addon=nilai opsi,
 *  Price=price_delta, Status=is_active. Coupons sengaja tidak dibuat. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const cafeId = ctx.cafe_id ?? "";
  const { data } = await supabaseAdmin
    .from("Menu_Option_Values")
    .select(
      "id_option_value, name, price_delta, is_active, option_group_id," +
      "group:Menu_Option_Groups(id_option_group, name, menu_id, menu:Menus(id_menu, nama_menu, category))",
    )
    .eq("cafe_id", cafeId)
    .order("sort_order", { ascending: true })
    .limit(300);

  type RawValue = {
    id_option_value: string;
    name: string;
    price_delta: number;
    is_active: boolean;
    option_group_id: string;
    group: {
      id_option_group: string;
      name: string;
      menu_id: string;
      menu: { id_menu: string; nama_menu: string; category: string | null } | null;
    } | null;
  };

  const rows: AddonRow[] = ((data ?? []) as unknown as RawValue[]).map(v => ({
    valueId: v.id_option_value,
    valueName: v.name,
    priceDelta: v.price_delta ?? 0,
    isActive: v.is_active,
    groupId: v.group?.id_option_group ?? v.option_group_id,
    groupName: v.group?.name ?? "Grup",
    menuId: v.group?.menu?.id_menu ?? v.group?.menu_id ?? "",
    menuName: v.group?.menu?.nama_menu ?? "Menu",
    menuCategory: v.group?.menu?.category ?? null,
  }));

  return <AddonsTable rows={rows} menus={await fetchMenus(cafeId)} />;
}

/** Daftar menu untuk dropdown modal Add — diambil terpisah dari addon rows,
 *  supaya menu yang BELUM punya addon pun tetap bisa dipilih. */
async function fetchMenus(cafeId: string) {
  const { data } = await supabaseAdmin
    .from("Menus")
    .select("id_menu, nama_menu, category")
    .eq("cafe_id", cafeId)
    .order("nama_menu", { ascending: true })
    .limit(300);
  return (data ?? []).map(m => ({ id: m.id_menu, name: m.nama_menu, category: m.category }));
}
