import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";
import MenuEditor, { type EditorMenu } from "@/components/dashboard-v2/MenuEditor";
import type { Menu } from "@/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ubah menu · Konsol Owner",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Lapis 2 rute Menu — tempat satu item DIKERJAKAN.
 *
 *  Daftar hanya untuk memilih item mana yang disentuh. Semua yang dipotong dari
 *  baris 44px ada di sini, dibagi lima tab supaya tiap tab menjawab satu
 *  pertanyaan dan bukan satu formulir raksasa. */
export default async function MenuEditorPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getStaffContext();
  const cafeId = ctx.cafe_id ?? null;

  if (!cafeId) notFound();

  // Kepemilikan disaring di query, bukan sesudahnya: id menu yang datang dari
  // URL adalah id yang bisa ditukar.
  const [menuResult, recipes, groups] = await Promise.all([
    supabaseAdmin.from("Menus").select("*").eq("id_menu", id).eq("cafe_id", cafeId).maybeSingle(),
    supabaseAdmin
      .from("Menu_Recipes")
      .select("id_menu_recipe", { count: "exact", head: true })
      .eq("cafe_id", cafeId)
      .eq("menu_id", id),
    supabaseAdmin
      .from("Menu_Option_Groups")
      .select("id_option_group", { count: "exact", head: true })
      .eq("cafe_id", cafeId)
      .eq("menu_id", id),
  ]);

  if (!menuResult.data) notFound();
  const menu = menuResult.data as Menu;

  const editorMenu: EditorMenu = {
    id_menu: menu.id_menu,
    nama_menu: menu.nama_menu,
    category: menu.category ?? null,
    harga_menu: menu.harga_menu,
    description_menu: menu.description_menu ?? null,
    is_active: menu.is_active !== false,
    discount_pct: menu.discount_pct ?? null,
    schedule_days: menu.schedule_days ?? null,
    schedule_start: menu.schedule_start ?? null,
    schedule_end: menu.schedule_end ?? null,
    has3d: Boolean(String(menu.model_3d_url ?? "").trim()),
    hasAr: Boolean(String(menu.usdz_url ?? "").trim()),
    recipeCount: recipes.count ?? 0,
    optionGroupCount: groups.count ?? 0,
  };

  return (
    <OwnerShell
      title={menu.nama_menu}
      right={
        <Link className="dv2-btn" href="/dashboard-v2/menu">
          Kembali ke daftar
        </Link>
      }
    >
      <MenuEditor menu={editorMenu} />
    </OwnerShell>
  );
}
