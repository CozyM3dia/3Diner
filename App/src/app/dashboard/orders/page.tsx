import { redirect } from "next/navigation";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import OrdersClient, { type OrderRow } from "@/components/dashboard/OrdersClient";

export default async function OrdersPage() {
  const { userId, cafeId, cafeName } = await getDashboardCafeContext();
  if (!userId) redirect("/login");

  const { data: orders } = cafeId
    ? await supabaseAdmin
        .from("Orders")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [] };

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      <div className="mb-5 dash-reveal">
        <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--dash-text)" }}>Pesanan</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>Pesanan masuk diperbarui otomatis</p>
      </div>
      <OrdersClient initial={(orders ?? []) as OrderRow[]} cafeId={cafeId ?? ""} cafeName={cafeName ?? "3Diner"} />
    </div>
  );
}
