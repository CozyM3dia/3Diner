import { NextResponse } from "next/server";
import { getAuthCafeId } from "@/lib/dashboard-actions";
import { createConvertUsdzTask } from "@/lib/tripo";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const cafeId = await getAuthCafeId();
    if (!cafeId) return NextResponse.json({ error: "Sesi tidak valid. Masuk ulang." }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { task_id?: string };
    const taskId = String(body.task_id ?? "").trim();
    if (!taskId) return NextResponse.json({ error: "task_id wajib diisi." }, { status: 400 });

    const convertTaskId = await createConvertUsdzTask(taskId);
    return NextResponse.json({ task_id: convertTaskId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
