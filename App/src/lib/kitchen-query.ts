import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { TiketDapur } from "@/lib/kitchen-model";

/** Read every open ticket. A fixed oldest-first limit hides new orders during a rush. */
export async function ambilTiketDapur(cafeId: string): Promise<TiketDapur[]> {
  if (!cafeId) return [];
  const tickets: TiketDapur[] = [];
  const size = 200;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabaseAdmin.from("Orders")
      .select("id_order,created_at,status,payment_status,table_number,notes,items")
      .eq("cafe_id", cafeId)
      .in("status", ["awaiting", "received", "preparing", "ready"])
      .order("created_at", { ascending: true })
      .order("id_order", { ascending: true })
      .range(offset, offset + size - 1);
    if (error) throw new Error("Antrean dapur gagal dimuat. Coba lagi.");
    const page = (data ?? []).map(o => ({ ...o, items: Array.isArray(o.items) ? o.items : [] })) as TiketDapur[];
    tickets.push(...page);
    if (page.length < size) return tickets;
  }
}
