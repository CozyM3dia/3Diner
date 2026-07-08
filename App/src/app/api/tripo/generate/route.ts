import { NextResponse } from "next/server";
import { getAuthCafeId } from "@/lib/dashboard-actions";
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

    const taskId = await createImageToModelTask(imageUrl);
    return NextResponse.json({ task_id: taskId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
