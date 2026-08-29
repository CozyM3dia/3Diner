import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MenuEditorClient from "@/app/dashboard-v2/menu/MenuEditorClient";

export const metadata = { title: "Tambah Menu · 3Diner" };
export const dynamic = "force-dynamic";

/** Halaman Tambah Menu — form kosong, simpan via `upsertMenuFromEditor`. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  // Kategori unik untuk dropdown: distinct di JS (database tidak punya daftar kategori).
  const { data } = await supabaseAdmin
    .from("Menus")
    .select("category")
    .eq("cafe_id", ctx.cafe_id ?? "");
  const categories = Array.from(
    new Set((data ?? []).map((r) => (r.category ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "id"));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="dp-page-head">
        <div>
          <Link href="/dashboard-v2/items" className="dp-back-link">
            <ChevronLeftIcon className="h-4 w-4" /> Items
          </Link>
          <h1>Tambah Menu</h1>
          <p className="dp-page-sub">Masuk ke katalog Menu Management</p>
        </div>
      </div>
      <MenuEditorClient mode="create" categories={categories} />
    </div>
  );
}
