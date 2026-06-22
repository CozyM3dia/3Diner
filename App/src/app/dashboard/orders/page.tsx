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
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
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
    <div className="p-5 lg:p-8 max-w-[1100px] mx-auto">
      <div className="mb-7">
        <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>Pesanan</h1>
        <p className="text-sm mt-1" style={{ color: "#5A7898" }}>Pesanan masuk diperbarui otomatis</p>
      </div>
      <OrdersClient initial={(orders ?? []) as OrderRow[]} cafeId={cafe?.id_cafe ?? ""} />
    </div>
  );
}
