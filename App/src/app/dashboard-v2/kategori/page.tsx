import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import CategoriesTable, { type CategoryRow } from "@/components/dp/CategoriesTable";

export const metadata = { title: "Categories · 3Diner" };
export const dynamic = "force-dynamic";

/** Halaman Categories — recreation `categories.html` Dream POS.
 *  Tidak ada tabel Categories di Supabase: kategori = teks `Menus.category`,
 *  jadi barisnya hasil agregasi menu per teks kategori. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data, error } = await supabaseAdmin
    .from("Menus")
    .select("nama_menu,image_url,category,is_active,created_at")
    .eq("cafe_id", ctx.cafe_id ?? "")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Data gagal dimuat. Coba lagi.");

  const byName = new Map<string, CategoryRow>();
  for (const m of data ?? []) {
    const name = (m.category ?? "").trim() || "Lainnya";
    const row = byName.get(name) ?? {
      name,
      items: 0,
      liveItems: 0,
      // Query terurut naik, jadi baris pertama kategori ini = menu terlamanya.
      firstCreatedAt: m.created_at,
      thumb: null,
    };
    row.items += 1;
    if (m.is_active !== false) row.liveItems += 1;
    if (!row.thumb && m.image_url) row.thumb = m.image_url;
    byName.set(name, row);
  }

  return <CategoriesTable rows={[...byName.values()]} />;
}
