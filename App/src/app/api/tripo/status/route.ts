import { NextResponse } from "next/server";
import { getAuthCafeId } from "@/lib/dashboard-actions";
import { getTripoTask } from "@/lib/tripo";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const cafeId = await getAuthCafeId();
    if (!cafeId) return NextResponse.json({ error: "Sesi tidak valid. Masuk ulang." }, { status: 401 });

    const taskId = new URL(req.url).searchParams.get("task_id") ?? "";
    if (!taskId) return NextResponse.json({ error: "task_id wajib diisi." }, { status: 400 });

    const task = await getTripoTask(taskId);
    return NextResponse.json({
      status: task.status,
      progress: task.progress ?? 0,
      preview: task.output?.rendered_image ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
