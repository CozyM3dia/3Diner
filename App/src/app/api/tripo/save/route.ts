import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthCafeId } from "@/lib/dashboard-actions";
import { getTripoTask, pickModelUrl } from "@/lib/tripo";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "menu-media";
const MAX_GLB_BYTES = 60 * 1024 * 1024;

/** Download the finished Tripo GLB and persist it to Supabase Storage so the
 *  menu keeps working after Tripo's temporary CDN link expires. */
export async function POST(req: Request) {
  try {
    const cafeId = await getAuthCafeId();
    if (!cafeId) return NextResponse.json({ error: "Sesi tidak valid. Masuk ulang." }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { task_id?: string; name?: string };
    const taskId = String(body.task_id ?? "").trim();
    if (!taskId) return NextResponse.json({ error: "task_id wajib diisi." }, { status: 400 });

    const task = await getTripoTask(taskId);
    if (task.status !== "success") {
      return NextResponse.json({ error: `Task belum selesai (status: ${task.status}).` }, { status: 409 });
    }
    const modelUrl = pickModelUrl(task);
    if (!modelUrl) return NextResponse.json({ error: "Tripo tidak mengembalikan model GLB." }, { status: 502 });

    const dl = await fetch(modelUrl);
    if (!dl.ok) return NextResponse.json({ error: `Gagal mengunduh model (${dl.status}).` }, { status: 502 });
    const buf = Buffer.from(await dl.arrayBuffer());
    if (buf.byteLength === 0) return NextResponse.json({ error: "File model kosong." }, { status: 502 });
    if (buf.byteLength > MAX_GLB_BYTES) {
      return NextResponse.json({ error: "Model melebihi batas 60MB." }, { status: 413 });
    }

    const safeName = String(body.name ?? "model").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40) || "model";
    const path = `${cafeId}/glb/${Date.now()}-tripo-${safeName}.glb`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: "model/gltf-binary", upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl, bytes: buf.byteLength });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
