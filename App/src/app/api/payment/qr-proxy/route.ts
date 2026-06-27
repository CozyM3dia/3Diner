import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const orderId = searchParams.get("orderId") ?? "qris";

  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const res = await fetch(url);
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
