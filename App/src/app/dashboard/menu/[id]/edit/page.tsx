import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import MenuForm from "@/components/dashboard/MenuForm";
import { updateMenu, deleteMenu } from "@/lib/dashboard-actions";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InventoryItem, Menu, MenuRecipe } from "@/types";

export const dynamic = "force-dynamic";

export default async function EditMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null };
  if (!cafe) notFound();

  const { data: menu } = await supabaseAdmin
    .from("Menus")
    .select("*")
    .eq("id_menu", id)
    .eq("cafe_id", cafe.id_cafe)
    .single();
  if (!menu) notFound();

  const [{ data: inventoryItems }, { data: recipes }] = await Promise.all([
    supabaseAdmin
      .from("Inventory_Items")
      .select("*")
      .eq("cafe_id", cafe.id_cafe)
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("Menu_Recipes")
      .select("*")
      .eq("menu_id", id)
      .eq("cafe_id", cafe.id_cafe)
      .order("created_at", { ascending: true }),
  ]);

  const onSave = updateMenu.bind(null, id);
  const onDelete = deleteMenu.bind(null, id);

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/menu" className="inline-flex items-center gap-1 text-sm mb-5" style={{ color: "#5A7898" }}>
        <ChevronLeft size={15} /> Menu
      </Link>
      <h1 className="font-display text-2xl font-bold mb-6" style={{ color: "#E9EEF6" }}>Edit Menu</h1>
      <MenuForm
        menu={menu as Menu}
        inventoryItems={(inventoryItems ?? []) as InventoryItem[]}
        recipes={(recipes ?? []) as MenuRecipe[]}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
