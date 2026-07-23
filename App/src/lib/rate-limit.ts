import { supabaseAdmin } from "./supabase-admin";

/** Hasil satu percakapan dengan penghitung. `retryAfterSeconds` selalu >= 1
 *  agar layak dipakai langsung sebagai header Retry-After. */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface ConsumeRateLimitRow {
  allowed?: unknown;
  reset_at?: unknown;
}

/** IP pemanggil di belakang proxy Vercel. x-forwarded-for berisi rantai
 *  "klien, proxy1, proxy2" — hop pertama yang mewakili klien. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function secondsUntil(value: unknown): number {
  if (typeof value !== "string") return 1;
  const reset = Date.parse(value);
  if (Number.isNaN(reset)) return 1;
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

/** Menaikkan penghitung fixed-window untuk `key` lewat RPC consume_rate_limit.
 *
 *  Sengaja fail-open: kalau limiter sendiri bermasalah (tabel hilang, koneksi
 *  putus), permintaan diloloskan. Menolak pesanan pelanggan karena penghitung
 *  rusak lebih merugikan kafe daripada melewatkan sebagian trafik. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error || !data || typeof data !== "object") {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const row = data as ConsumeRateLimitRow;
    if (row.allowed === false) {
      return { allowed: false, retryAfterSeconds: secondsUntil(row.reset_at) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/** Respons 429 seragam untuk semua rute publik. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) } }
  );
}
