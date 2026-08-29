import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MenuEditorClient from "@/app/dashboard-v2/menu/MenuEditorClient";
import type { MenuFormValues } from "@/components/dp/MenuEditorForm";

export const metadata = { title: "Edit Menu · 3Diner" };
export const dynamic = "force-dynamic";

/** Halaman Edit Menu — memuat satu menu kafe ini, lalu form terisi awal. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data: menu } = await supabaseAdmin
    .from("Menus")
    .select(
      "id_menu,nama_menu,harga_menu,discount_pct,description_menu,category,image_url,is_active,schedule_days,schedule_start,schedule_end,prep_time_minutes,calories,ingredients"
    )
    .eq("id_menu", id)
    .eq("cafe_id", ctx.cafe_id ?? "")
    .maybeSingle();
  if (!menu) notFound();

  // Kategori unik untuk dropdown: distinct di JS (database tidak punya daftar kategori).
  const { data: catRows } = await supabaseAdmin
    .from("Menus")
    .select("category")
    .eq("cafe_id", ctx.cafe_id ?? "");
  const categories = Array.from(
    new Set((catRows ?? []).map((r) => (r.category ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "id"));

  const initial: Partial<MenuFormValues> = {
    nama_menu: menu.nama_menu ?? "",
    deskripsi: menu.description_menu ?? "",
    category: menu.category ?? "",
    harga_menu: menu.harga_menu ?? 0,
    discount_pct: menu.discount_pct ?? null,
    serve_time_minutes: menu.prep_time_minutes ?? null,
    calories: menu.calories ?? null,
    ingredients: menu.ingredients ?? "",
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="dp-page-head">
        <div>
          <Link href="/dashboard-v2/items" className="dp-back-link">
            <ChevronLeftIcon className="h-4 w-4" /> Items
          </Link>
          <h1>Edit Menu</h1>
          <p className="dp-page-sub">{menu.nama_menu ?? "(tanpa nama)"}</p>
        </div>
      </div>
      <MenuEditorClient mode="edit" initial={initial} categories={categories} id_menu={menu.id_menu} />
    </div>
  );
}
