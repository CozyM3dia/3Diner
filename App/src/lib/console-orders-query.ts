import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";
import type { BoardOrder } from "@/components/dp/OrdersBoard";

export async function loadConsoleOrders(cafeId: string): Promise<BoardOrder[]> {
  const since = new Date(new Date(startOfTodayWIB()).getTime() - 29 * 864e5).toISOString();
  const rows: BoardOrder[] = [];
  const size = 200;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabaseAdmin.from("Orders")
      .select("id_order,total,subtotal,tax_pct,tax_amount,service_pct,service_amount,prices_include_tax,status,payment_status,payment_method,table_number,items,notes,cancelled_reason,created_at")
      .eq("cafe_id", cafeId)
      .or(`created_at.gte.${since},status.in.(awaiting,received,preparing,ready)`)
      .order("created_at", { ascending: false }).order("id_order", { ascending: false })
      .range(offset, offset + size - 1);
    if (error) throw new Error("Pesanan gagal dimuat. Coba lagi.");
    const page = (data ?? []).map(o => ({ ...o, status: o.status ?? "awaiting", payment_status: o.payment_status ?? "unpaid", items: Array.isArray(o.items) ? o.items : [] })) as BoardOrder[];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}
