import { NextResponse } from "next/server";
import { getAuthCafeId } from "@/lib/dashboard-actions";
import { CREDIT_COST, claimAiCredit, refundAiCredit } from "@/lib/ai-credits";
import { createImageToModelTask } from "@/lib/tripo";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const cafeId = await getAuthCafeId();
    if (!cafeId) return NextResponse.json({ error: "Sesi tidak valid. Masuk ulang." }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { image_url?: string };
    const imageUrl = String(body.image_url ?? "").trim();
    if (!/^https?:\/\//.test(imageUrl)) {
      return NextResponse.json({ error: "URL foto tidak valid. Unggah foto menu dulu." }, { status: 400 });
    }

    // Credit diklaim setelah validasi murah lolos, tapi sebelum Tripo dipanggil.
    // Ini satu-satunya titik di mana biaya variabel dibatasi.
    const claim = await claimAiCredit(cafeId, CREDIT_COST.model3d);
    if (!claim.ok) return claim.response!;

    try {
      const taskId = await createImageToModelTask(imageUrl);
      return NextResponse.json({ task_id: taskId });
    } catch (err) {
      await refundAiCredit(cafeId, CREDIT_COST.model3d);
      throw err;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
