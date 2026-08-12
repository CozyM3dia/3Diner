import { NextResponse } from "next/server";

/** Rute ini mem-fetch URL dari query di sisi server lalu mengembalikan isinya,
 *  jadi tanpa daftar host yang diizinkan ia menjadi proxy SSRF terbuka —
 *  penyerang bisa membaca alamat internal (mis. 169.254.169.254) lewat server.
 *  URL sah selalu actions[0].url dari respons charge Midtrans. */
const ALLOWED_QR_HOSTS = new Set(["api.midtrans.com", "api.sandbox.midtrans.com"]);

function isAllowedQrUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  // Host dicocokkan persis, bukan endsWith, agar
  // "api.midtrans.com.evil.example.com" tetap ditolak.
  return parsed.protocol === "https:" && parsed.port === "" && ALLOWED_QR_HOSTS.has(parsed.hostname);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const orderId = searchParams.get("orderId") ?? "qris";

  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
  if (!isAllowedQrUrl(url)) {
    return NextResponse.json({ error: "URL QR tidak diizinkan" }, { status: 400 });
  }

  try {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      throw new Error("QR image redirect is not allowed");
    }
    if (!res.ok) throw new Error("Failed to fetch QR image");
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/png";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="QRIS-${orderId}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
