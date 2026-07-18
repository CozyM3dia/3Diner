import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import OrdersClient, { type OrderRow } from "@/components/dashboard/OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe, nama_cafe").eq("slug_url", slug).single()
    : { data: null };

  const { data: orders } = cafe
    ? await supabaseAdmin
        .from("Orders")
        .select("*")
        .eq("cafe_id", cafe.id_cafe)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [] };

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      <div className="mb-5 dash-reveal">
        <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--dash-text)" }}>Pesanan</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>Pesanan masuk diperbarui otomatis</p>
      </div>
      <OrdersClient initial={(orders ?? []) as OrderRow[]} cafeId={cafe?.id_cafe ?? ""} cafeName={(cafe as { id_cafe: string; nama_cafe?: string } | null)?.nama_cafe ?? "3Diner"} />
    </div>
  );
}
