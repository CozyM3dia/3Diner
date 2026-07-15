import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import MenuForm from "@/components/dashboard/MenuForm";
import { createMenu } from "@/lib/dashboard-actions";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InventoryItem } from "@/types";

export const dynamic = "force-dynamic";

export default async function NewMenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null };
  const { data: inventoryItems } = cafe
    ? await supabaseAdmin
        .from("Inventory_Items")
        .select("*")
        .eq("cafe_id", cafe.id_cafe)
        .order("name", { ascending: true })
    : { data: [] };

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/menu" className="inline-flex items-center gap-1 text-sm mb-5" style={{ color: "#5A7898" }}>
        <ChevronLeft size={15} /> Menu
      </Link>
      <h1 className="font-display text-2xl font-bold mb-6" style={{ color: "#E9EEF6" }}>Tambah Menu</h1>
      <MenuForm onSave={createMenu} inventoryItems={(inventoryItems ?? []) as InventoryItem[]} recipes={[]} />
    </div>
  );
}
