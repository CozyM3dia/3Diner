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

  const [openResult, todaySummary, cafeResult] = await Promise.all([
    supabaseAdmin
      .from("Orders")
      .select("id_order,table_number,items,total,status,payment_method,payment_status,created_at,notes,subtotal,tax_pct,tax_amount,service_pct,service_amount,prices_include_tax")
      .eq("cafe_id", cafeId)
      .in("status", ["received", "preparing", "ready"])
      .order("created_at", { ascending: true }),
    // Angka "hari ini" di-agregasi di Postgres (today_orders_summary), bukan
    // dengan menarik semua baris Orders hari ini ke Node untuk dijumlahkan.
    supabaseAdmin.rpc("today_orders_summary", { p_cafe_id: cafeId, p_today_start: since }),
    supabaseAdmin
      .from("Cafes")
      .select("alamat_cafe,tax_configured_at")
      .eq("id_cafe", cafeId)
      .maybeSingle(),
  ]);

  const orders = (openResult.data ?? []) as KasirOrder[];

  /** Angka gagal tampil sebagai "—", bukan "0".
   *
   *  Nol saat query gagal tidak terlihat seperti kegagalan: kasir menyimpulkan
   *  kafenya sepi padahal datanya tidak sampai. Itu sebabnya `null` di sini
   *  dibedakan dari nol yang benar. */
  let totals: KasirTotals | null = null;
  if (!todaySummary.error) {
    const a = (todaySummary.data ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number => Number(v) || 0;
    totals = {
      completedCount: num(a.completed_count),
      receivedAmount: num(a.received_amount),
      cashAmount: num(a.cash_amount),
      noncashAmount: num(a.noncash_amount),
    };
  }

  return (
    <KasirQueue
      initial={orders}
      totals={totals}
      cafeId={cafeId}
      cafeName={ctx.cafe_name ?? "Kafe"}
      cafeAddress={cafeResult.data?.alamat_cafe ?? null}
      taxConfigured={Boolean(cafeResult.data?.tax_configured_at)}
      staffName={ctx.full_name ?? "Kasir"}
    />
  );
}
