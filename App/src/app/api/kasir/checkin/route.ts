import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getStaffCafeId } from "@/lib/staff-context";

const CHECKIN_PER_IP = { limit: 30, windowSeconds: 60 };
const CODE_RE = /^[A-Z0-9]{8}$/;

export async function POST(req: Request) {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { checkinCode?: unknown } | null;
  const checkinCode = typeof body?.checkinCode === "string" ? body.checkinCode.trim().toUpperCase() : "";
  if (!CODE_RE.test(checkinCode)) {
    return NextResponse.json({ error: "Kode check-in tidak valid" }, { status: 404 });
  }

  const limit = await consumeRateLimit(`checkin:ip:${clientIp(req)}`, CHECKIN_PER_IP.limit, CHECKIN_PER_IP.windowSeconds);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const { data, error } = await supabaseAdmin.rpc("checkin_order", {
    p_cafe_id: cafeId, p_checkin_code: checkinCode,
  });
  if (error) return NextResponse.json({ error: "Gagal check-in pesanan" }, { status: 502 });

  const result = data as { ok?: unknown; error?: unknown; unavailableMenus?: unknown } | null;
  if (result?.error === "checkin_invalid") {
    return NextResponse.json({ error: "Pesanan atau kode tidak ditemukan" }, { status: 404 });
  }
  if (result?.error === "insufficient_inventory") {
    const menus = Array.isArray(result.unavailableMenus)
      ? result.unavailableMenus.filter((m): m is string => typeof m === "string") : [];
    return NextResponse.json(
      { code: "insufficient_inventory", error: "Stok tidak cukup",
        message: menus.length ? `Stok habis untuk: ${menus.join(", ")}.` : "Stok tidak cukup.", unavailableMenus: menus },
      { status: 409 });
  }
  if (!result?.ok) return NextResponse.json({ error: "Gagal check-in pesanan" }, { status: 502 });

  return NextResponse.json({ ok: true });
}
