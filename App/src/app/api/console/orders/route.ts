import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { loadConsoleOrders } from "@/lib/console-orders-query";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const ctx = await getStaffContext();
    if (ctx.error) return Response.json({ error: "Sesi gagal diperiksa." }, { status: 503, headers });
    if (!ctx.cafe_id || ctx.is_active === false || !canOpenOwnerConsole(ctx.role)) return Response.json({ error: "Tidak berwenang." }, { status: 403, headers });
    return Response.json({ orders: await loadConsoleOrders(ctx.cafe_id) }, { headers });
  } catch { return Response.json({ error: "Pesanan gagal diperbarui." }, { status: 503, headers }); }
}
