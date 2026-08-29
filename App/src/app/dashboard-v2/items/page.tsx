import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import ItemsGrid, { type GridItem } from "@/components/dp/ItemsGrid";

export const metadata = { title: "Items · 3Diner" };
export const dynamic = "force-dynamic";

/** Halaman Items — recreation `items.html` Dream POS.
 *  Skema nyata: Menus(id_menu, nama_menu, harga_menu, image_url, category, is_active). */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data } = await supabaseAdmin
    .from("Menus")
    .select("id_menu,nama_menu,harga_menu,image_url,category,is_active")
    .eq("cafe_id", ctx.cafe_id ?? "")
    .order("nama_menu", { ascending: true });

  const items: GridItem[] = (data ?? []).map(m => ({
    id_menu: m.id_menu,
    nama_menu: m.nama_menu ?? "(tanpa nama)",
    harga_menu: m.harga_menu,
    image_url: m.image_url,
    category: m.category,
    // Menu lama bisa punya is_active null — di layar pelanggan itu berarti tayang.
    is_active: m.is_active !== false,
  }));

  return <ItemsGrid items={items} />;
}
