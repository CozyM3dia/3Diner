import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";

const PAYMENT_METHOD_PER_IP = { limit: 20, windowSeconds: 60 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Mencatat pilihan bayar tunai ke database.
 *
 *  Sebelumnya pilihan ini hanya hidup di localStorage, jadi kolom
 *  `payment_method` kosong untuk semua pesanan tunai dan laporan penjualan tidak
 *  bisa memisahkan tunai dari QRIS.
 *
 *  Rute ini sengaja tidak bisa menyetel `payment_status`. Pelanggan menyatakan
 *  cara bayar; kasir yang menyatakan lunas. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    orderToken?: unknown;
    method?: unknown;
  } | null;

  const token = typeof body?.orderToken === "string" ? body.orderToken : "";
  const method = typeof body?.method === "string" ? body.method : "";

  if (!id || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }
  if (method !== "cash") {
    return NextResponse.json({ error: "Metode pembayaran tidak valid" }, { status: 400 });
  }

  const limit = await consumeRateLimit(
    `order-pay:ip:${clientIp(req)}`,
    PAYMENT_METHOD_PER_IP.limit,
    PAYMENT_METHOD_PER_IP.windowSeconds
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const { data, error } = await supabaseAdmin.rpc("set_order_payment_method", {
    p_order_id: id,
    p_token: token,
    p_method: method,
  });

  if (error) {
    return NextResponse.json({ error: "Gagal menyimpan metode pembayaran" }, { status: 502 });
  }

  const result = data as { error?: unknown; ok?: unknown } | null;
  if (result?.error === "order_not_found") {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }
  if (result?.error === "payment_locked") {
    return NextResponse.json(
      { error: "Pembayaran pesanan ini sudah diproses" },
      { status: 409 }
    );
  }
  if (!result?.ok) {
    return NextResponse.json({ error: "Gagal menyimpan metode pembayaran" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
