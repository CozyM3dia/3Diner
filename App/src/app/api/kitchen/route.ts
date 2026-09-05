import { getStaffContext, canOpenKitchenConsole, canOpenOwnerConsole } from "@/lib/staff-context";
import { ambilTiketDapur } from "@/lib/kitchen-query";

export const dynamic = "force-dynamic";

/** Clerk-backed staff authorization; never expose Orders through anonymous RLS. */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const ctx = await getStaffContext();
    if (ctx.error) return Response.json({ error: "Sesi gagal diperiksa. Coba lagi." }, { status: 503, headers });
    if (!ctx.cafe_id || !ctx.role || ctx.is_active === false ||
      (!canOpenKitchenConsole(ctx.role) && !canOpenOwnerConsole(ctx.role))) {
      return Response.json({ error: "Akses dapur tidak diizinkan." }, { status: 403, headers });
    }
    return Response.json({ tickets: await ambilTiketDapur(ctx.cafe_id) }, { headers });
  } catch {
    return Response.json({ error: "Antrean gagal diperbarui. Data terakhir tetap ditampilkan." }, { status: 503, headers });
  }
}
