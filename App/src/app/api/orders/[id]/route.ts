import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Halaman status memanggil ini berulang saat menunggu pembayaran, jadi batasnya
 *  longgar — tapi tetap ada supaya token yang bocor tidak bisa dipakai memanen
 *  data pesanan tanpa henti. */
const ORDER_READ_PER_IP = { limit: 120, windowSeconds: 60 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Mengambil pesanan dari server memakai `customer_token` sebagai kredensial.
 *
 *  Ini yang membuat pesanan selamat dari localStorage yang dibersihkan, tab
 *  incognito, dan pindah perangkat. Token dikirim sebagai query string karena
 *  hanya dibaca, bukan data pribadi pelanggan. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") ?? "";

  if (!id || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  const limit = await consumeRateLimit(
    `order-read:ip:${clientIp(req)}`,
    ORDER_READ_PER_IP.limit,
    ORDER_READ_PER_IP.windowSeconds
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const { data, error } = await supabaseAdmin.rpc("get_order_for_customer", {
    p_order_id: id,
    p_token: token,
  });

  if (error) {
    return NextResponse.json({ error: "Gagal memuat pesanan" }, { status: 502 });
  }

  const result = data as { error?: unknown; order?: unknown; reviewUrl?: unknown } | null;
  if (!result || result.error || !result.order) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(
    { order: result.order, reviewUrl: result.reviewUrl ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
