import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, CircleAlert } from "lucide-react";
import MenuForm from "@/components/dashboard/MenuForm";
import { createMenu } from "@/lib/dashboard-actions";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InventoryItem } from "@/types";

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
  const { data: inventoryItems, error: inventoryError } = cafe
    ? await supabaseAdmin
        .from("Inventory_Items")
        .select("*")
        .eq("cafe_id", cafe.id_cafe)
        .order("name", { ascending: true })
    : { data: [], error: null };

  if (inventoryError) {
    return (
      <div className="p-5 lg:p-8 max-w-5xl mx-auto">
        <Link href="/dashboard/menu" className="inline-flex items-center gap-1 text-sm mb-5" style={{ color: "var(--dash-muted)" }}>
          <ChevronLeft size={15} /> Menu
        </Link>
        <h1 className="font-display text-2xl font-bold mb-6" style={{ color: "#E9EEF6" }}>Tambah Menu</h1>
        <section
          className="dash-card flex min-h-56 flex-col items-center justify-center rounded-2xl px-5 py-10 text-center"
          style={{ background: "#0D1829", border: "1px solid rgba(239,68,68,0.28)" }}
          aria-labelledby="inventory-load-error-title"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
            <CircleAlert size={23} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2 id="inventory-load-error-title" className="mt-4 font-semibold" style={{ color: "#E9EEF6" }}>
            Inventory belum dapat dimuat
          </h2>
          <p className="mt-1 max-w-md text-sm" style={{ color: "#9FB6D1" }}>
            Terjadi kendala saat memuat bahan inventory. Coba muat ulang halaman sebelum menambah menu.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/menu" className="inline-flex items-center gap-1 text-sm mb-5" style={{ color: "var(--dash-muted)" }}>
        <ChevronLeft size={15} /> Menu
      </Link>
      <h1 className="font-display text-2xl font-bold mb-6" style={{ color: "#E9EEF6" }}>Tambah Menu</h1>
      <MenuForm onSave={createMenu} inventoryItems={(inventoryItems ?? []) as InventoryItem[]} recipes={[]} />
    </div>
  );
}
