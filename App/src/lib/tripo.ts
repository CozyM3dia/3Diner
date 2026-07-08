/**
 * Server-only Tripo AI (tripo3d.ai) API helpers.
 * Docs: https://platform.tripo3d.ai/docs — v2 openapi, Bearer auth with tsk_* key.
 * NEVER import into client components.
 */

const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";

export interface TripoTaskOutput {
  model?: string;
  base_model?: string;
  pbr_model?: string;
  rendered_image?: string;
}

export interface TripoTask {
  task_id: string;
  type: string;
  status: "queued" | "running" | "success" | "failed" | "cancelled" | "banned" | "expired" | "unknown";
  progress: number;
  output?: TripoTaskOutput;
}

function apiKey(): string {
  const key = process.env.TRIPO_API_KEY;
  if (!key) throw new Error("TRIPO_API_KEY belum dikonfigurasi di server.");
  return key;
}

async function tripoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TRIPO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.code !== 0) {
    const msg = json?.message ?? json?.error ?? `Tripo API error (${res.status})`;
    throw new Error(msg);
  }
  return json.data as T;
}

/** Kick off image → 3D model generation. Returns the Tripo task id. */
export async function createImageToModelTask(imageUrl: string): Promise<string> {
  const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const type = ["png", "webp", "jpeg", "jpg"].includes(ext) ? (ext === "jpg" ? "jpeg" : ext) : "jpeg";
  const data = await tripoFetch<{ task_id: string }>("/task", {
    method: "POST",
    body: JSON.stringify({
      type: "image_to_model",
      file: { type, url: imageUrl },
      // Food photography → textured PBR model for realistic menu preview.
      texture: true,
      pbr: true,
    }),
  });
  return data.task_id;
}

/** Convert a finished image_to_model task's GLB into USDZ (AR on iOS). */
export async function createConvertUsdzTask(originalTaskId: string): Promise<string> {
  const data = await tripoFetch<{ task_id: string }>("/task", {
    method: "POST",
    body: JSON.stringify({
      type: "convert_model",
      format: "USDZ",
      original_model_task_id: originalTaskId,
    }),
  });
  return data.task_id;
}

export async function getTripoTask(taskId: string): Promise<TripoTask> {
  return tripoFetch<TripoTask>(`/task/${encodeURIComponent(taskId)}`);
}

/** Preferred downloadable GLB URL from a finished task. */
export function pickModelUrl(task: TripoTask): string | null {
  return task.output?.pbr_model || task.output?.model || task.output?.base_model || null;
}
