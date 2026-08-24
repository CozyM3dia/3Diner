import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { readBoundedArrayBuffer } from "@/lib/bounded-response";
import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";

const ALLOWED_QR_HOSTS = new Set(["api.midtrans.com", "api.sandbox.midtrans.com"]);
const MAX_QR_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 5_000;
// QR untuk pasangan (orderId, transaksi) tidak pernah berubah, tapi status
// pending bisa berakhir — cache singkat memotong Supabase read + fetch Midtrans
// pada buka ulang/cetak berulang tanpa menyajikan QR yang sudah mati terlalu lama.
const QR_CACHE_SECONDS = 60;
const PROXY_PER_IP = { limit: 30, windowSeconds: 60 };

function isAllowedQrUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && parsed.port === "" && ALLOWED_QR_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function safeOrderId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) || "order";
}

function unauthorized() {
  return NextResponse.json({ error: "QRIS tidak tersedia" }, { status: 401 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId")?.trim();
  const token = searchParams.get("token")?.trim();

  if (!orderId || !token || searchParams.has("url")) return unauthorized();

  // Endpoint ini melakukan Supabase read + fetch keluar ke Midtrans per hit;
  // tanpa limiter ia adalah vektor amplifikasi termurah di aplikasi.
  const limit = await consumeRateLimit(`qr-proxy:ip:${clientIp(req)}`, PROXY_PER_IP.limit, PROXY_PER_IP.windowSeconds);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const { data: order, error: orderError } = await supabaseAdmin
    .from("Orders")
    .select("id_order, customer_token, payment_status, payment_qr_url")
    .eq("id_order", orderId)
    .eq("customer_token", token)
    .maybeSingle();

  if (orderError || !order || order.payment_status !== "pending" ||
      typeof order.payment_qr_url !== "string" || !isAllowedQrUrl(order.payment_qr_url)) {
    return unauthorized();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(order.payment_qr_url, {
      redirect: "error",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: "QRIS tidak tersedia" }, { status: 502 });

    const contentType = res.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (!contentType?.startsWith("image/")) {
      return NextResponse.json({ error: "QRIS tidak tersedia" }, { status: 502 });
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_QR_BYTES) {
      return NextResponse.json({ error: "QRIS tidak tersedia" }, { status: 502 });
    }

    const buffer = await readBoundedArrayBuffer(res, MAX_QR_BYTES);
    if (buffer.byteLength > MAX_QR_BYTES) {
      return NextResponse.json({ error: "QRIS tidak tersedia" }, { status: 502 });
    }

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="QRIS-${safeOrderId(orderId)}.png"`,
        // Gambar QR bersifat privat per pesanan; browser boleh memegangnya
        // sebentar, tapi CDN/shared cache tidak boleh.
        "Cache-Control": `private, max-age=${QR_CACHE_SECONDS}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "QRIS tidak tersedia" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
