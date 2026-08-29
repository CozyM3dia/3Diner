import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";
import KitchenBoard, { type KitchenOrder } from "@/components/dp/KitchenBoard";

export const metadata = { title: "Kitchen · 3Diner" };
export const dynamic = "force-dynamic";

/** Antrean dapur — recreation `kitchen.html` Dream POS, read-only.
 *
 *  Status yang relevan bagi dapur: belum disentuh (`awaiting`/`received`),
 *  sedang dimasak (`preparing`), sudah matang (`ready`). `completed` dan
 *  `cancelled` sudah lepas dari dapur, jadi tidak ditarik.
 *
 *  Jendela 30 hari, sama seperti halaman Pesanan: pesanan yang belum ditutup
 *  tetap pesanan terbuka walau dibuat kemarin, dan menyaring ke "hari ini"
 *  membuat papan ini kosong terus padahal antreannya nyata. */
const STATUS_DAPUR = ["awaiting", "received", "preparing", "ready"];

export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const since30 = new Date(new Date(startOfTodayWIB()).getTime() - 29 * 864e5).toISOString();

  const { data } = await supabaseAdmin
    .from("Orders")
    .select("id_order,created_at,status,payment_status,table_number,notes,items")
    .eq("cafe_id", ctx.cafe_id ?? "")
    .in("status", STATUS_DAPUR)
    .gte("created_at", since30)
    .order("created_at", { ascending: true })
    .limit(60);

  const orders: KitchenOrder[] = (data ?? []).map(o => ({
    id_order: o.id_order,
    created_at: o.created_at,
    status: o.status ?? "awaiting",
    payment_status: o.payment_status ?? "unpaid",
    table_number: o.table_number,
    notes: o.notes,
    items: o.items ?? [],
  }));

  return <KitchenBoard orders={orders} />;
}
