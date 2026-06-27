import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Box } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MenuTable from "@/components/dashboard/MenuTable";
import MenuExtractor from "@/components/dashboard/MenuExtractor";
import type { Menu } from "@/types";

export const dynamic = "force-dynamic";

export default async function MenuListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null };

  const { data: menus } = cafe
    ? await supabaseAdmin
        .from("Menus")
        .select("*")
        .eq("cafe_id", cafe.id_cafe)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
    : { data: [] };

  const list = (menus ?? []) as Menu[];

  return (
    <div className="p-5 lg:p-8 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-7 dash-reveal">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>Menu</h1>
          <p className="text-sm mt-1" style={{ color: "#5A7898" }}>{list.length} item terdaftar</p>
        </div>
        <div className="flex items-center gap-2.5">
          <MenuExtractor />
          <Link
            href="/dashboard/menu/new"
            className="dash-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#FD5002" }}
          >
            <Plus size={16} /> Tambah Menu
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Box size={38} style={{ color: "#5A7898" }} strokeWidth={1.2} />
          <p className="mt-4 font-semibold" style={{ color: "#E9EEF6" }}>Belum ada menu</p>
          <p className="text-sm mt-1 mb-6" style={{ color: "#5A7898" }}>Tambah menu pertama untuk kafe kamu</p>
          <Link href="/dashboard/menu/new" className="dash-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#FD5002" }}>
            <Plus size={15} /> Tambah Menu
          </Link>
        </div>
      ) : (
        <MenuTable menus={list} />
      )}
    </div>
  );
}
