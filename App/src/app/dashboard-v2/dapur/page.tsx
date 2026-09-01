import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";
import KitchenBoard, { type KitchenOrder } from "@/components/dp/KitchenBoard";

export const metadata = { title: "Kitchen · 3Diner" };
export const dynamic = "force-dynamic";

/** Antrean dapur di dalam konsol — recreation `kitchen.html` Dream POS,
 *  read-only. Ini halaman yang sama dengan /dapur (permukaan standalone
 *  untuk perangkat dapur), tapi berbingkai Shell dashboard-v2 sehingga
 *  pemilik/manager bisa pindah ke modul lain lewat sidebar.
 *
 *  Guard: owner & manager (konsol). Staf kitchen tetap dilayani /dapur.
 *  Status yang relevan: belum disentuh (`awaiting`/`received`), sedang
 *  dimasak (`preparing`), sudah matang (`ready`). Jendela 30 hari —
 *  pesanan belum ditutup tetap terbuka walau dibuat kemarin. */
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

  return (
    <>
      <div className="dp-page-head">
        <h1>Kitchen</h1>
      </div>
      <KitchenBoard orders={orders} />
    </>
  );
}
