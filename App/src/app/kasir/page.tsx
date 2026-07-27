import { getStaffContext } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import KasirQueue, { type KasirOrder, type KasirTotals } from "@/components/kasir/KasirQueue";

export const dynamic = "force-dynamic";

/** Awal hari operasional dalam WIB.
 *
 *  Kafe menutup buku per hari kalender setempat, bukan per UTC. Tanpa ini,
 *  angka "hari ini" berganti jam 7 pagi di tengah persiapan buka. */
function startOfTodayWib(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const midnightWib = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate());
  return new Date(midnightWib - 7 * 3600_000).toISOString();
}

export default async function KasirPage() {
  const ctx = await getStaffContext();
  const cafeId = ctx.cafe_id ?? "";

  const since = startOfTodayWib();

  const [openResult, todayResult] = await Promise.all([
    supabaseAdmin
      .from("Orders")
      .select("id_order,table_number,items,total,status,payment_method,payment_status,created_at,notes")
      .eq("cafe_id", cafeId)
      .in("status", ["received", "preparing", "ready"])
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("Orders")
      .select("total,status,payment_method,payment_status")
      .eq("cafe_id", cafeId)
      .gte("created_at", since),
  ]);

  const orders = (openResult.data ?? []) as KasirOrder[];

  /** Angka gagal tampil sebagai "—", bukan "0".
   *
   *  Nol saat query gagal tidak terlihat seperti kegagalan: kasir menyimpulkan
   *  kafenya sepi padahal datanya tidak sampai. Itu sebabnya `null` di sini
   *  dibedakan dari nol yang benar. */
  let totals: KasirTotals | null = null;
  if (!todayResult.error) {
    const rows = todayResult.data ?? [];
    const paid = rows.filter((r) => r.payment_status === "paid");
    totals = {
      completedCount: rows.filter((r) => r.status === "completed").length,
      receivedAmount: paid.reduce((s, r) => s + (r.total ?? 0), 0),
      cashAmount: paid.filter((r) => r.payment_method === "cash").reduce((s, r) => s + (r.total ?? 0), 0),
      qrisAmount: paid.filter((r) => r.payment_method === "qris").reduce((s, r) => s + (r.total ?? 0), 0),
    };
  }

  return (
    <KasirQueue
      initial={orders}
      totals={totals}
      cafeId={cafeId}
      cafeName={ctx.cafe_name ?? "Kafe"}
      staffName={ctx.full_name ?? "Kasir"}
    />
  );
}
