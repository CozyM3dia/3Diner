import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";
import { redirect } from "next/navigation";
import OrdersBoard, { type BoardOrder } from "@/components/dp/OrdersBoard";

export const metadata = { title: "Pesanan · 3Diner" };

export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const cafeId = ctx.cafe_id ?? "";
  const since30 = new Date(new Date(startOfTodayWIB()).getTime() - 29 * 864e5).toISOString();

  const { data } = await supabaseAdmin
    .from("Orders")
    .select("id_order,total,status,payment_status,table_number,items,created_at")
    .eq("cafe_id", cafeId)
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(200);

  const orders: BoardOrder[] = (data ?? []).map(o => ({
    id_order: o.id_order,
    created_at: o.created_at,
    status: o.status ?? "awaiting",
    payment_status: o.payment_status ?? "unpaid",
    table_number: o.table_number,
    total: o.total,
    items: o.items ?? [],
  }));

  return (
    <>
      <div className="dp-page-head">
        <div>
          <h1>Pesanan</h1>
        </div>
      </div>
      <OrdersBoard orders={orders} />
    </>
  );
}
