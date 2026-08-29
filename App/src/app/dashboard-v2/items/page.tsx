import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import ItemsGrid, { type GridItem } from "@/components/dp/ItemsGrid";
import MenuEditorHost from "@/components/dp/MenuEditorHost";

export const metadata = { title: "Items · 3Diner" };
export const dynamic = "force-dynamic";

/** Halaman Items — recreation `items.html` Dream POS.
 *  Editor Tambah/Edit kini drawer floating di atas grid ini (MenuEditorHost). */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data } = await supabaseAdmin
    .from("Menus")
    .select("id_menu,nama_menu,harga_menu,image_url,category,is_active")
    .eq("cafe_id", ctx.cafe_id ?? "")
    .order("nama_menu", { ascending: true });

  const categories = Array.from(
    new Set((data ?? []).map(m => (m.category ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "id"));

  const items: GridItem[] = (data ?? []).map(m => ({
    id_menu: m.id_menu,
    nama_menu: m.nama_menu ?? "(tanpa nama)",
    harga_menu: m.harga_menu,
    image_url: m.image_url,
    category: m.category,
    // Menu lama bisa punya is_active null — di layar pelanggan itu berarti tayang.
    is_active: m.is_active !== false,
  }));

  return (
    <MenuEditorHost categories={categories}>
      <ItemsGrid items={items} initialQuery={q ?? ""} />
    </MenuEditorHost>
  );
}
