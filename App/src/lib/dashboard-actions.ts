"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import { createClient } from "./supabase/server";
import { getOwnerCafeSlug } from "./analytics";

export interface ActionResult {
  error?: string;
}

/** Resolve the cafe_id owned by the authenticated user, or null. */
async function getAuthCafeId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const slug = await getOwnerCafeSlug(user.id);
  if (!slug) return null;
  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("id_cafe")
    .eq("slug_url", slug)
    .single();
  return (data?.id_cafe as string) ?? null;
}

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function num(fd: FormData, k: string): number | null {
  const s = str(fd, k);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ── Menu CRUD ────────────────────────────────────────────────────────────

function menuPayload(fd: FormData) {
  return {
    nama_menu: str(fd, "nama_menu") ?? "",
    harga_menu: num(fd, "harga_menu") ?? 0,
    description_menu: str(fd, "description_menu"),
    category: str(fd, "category"),
    prep_time_minutes: num(fd, "prep_time_minutes"),
    calories: num(fd, "calories"),
    ingredients: str(fd, "ingredients"),
    model_3d_url: str(fd, "model_3d_url") ?? "",
    usdz_url: str(fd, "usdz_url"),
    image_url: str(fd, "image_url"),
    redirect_link: str(fd, "redirect_link") ?? "",
    is_active: fd.get("is_active") !== "false",
    discount_pct: num(fd, "discount_pct") ?? 0,
    schedule_days: str(fd, "schedule_days"),
    schedule_start: str(fd, "schedule_start"),
    schedule_end: str(fd, "schedule_end"),
    model_scale: num(fd, "model_scale") ?? 1.0,
  };
}

export async function createMenu(fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const payload = menuPayload(fd);
  if (!payload.nama_menu) return { error: "Nama menu wajib diisi." };
  const { error } = await supabaseAdmin.from("Menus").insert([{ cafe_id: cafeId, ...payload }]);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return {};
}

export async function updateMenu(menuId: string, fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const payload = menuPayload(fd);
  if (!payload.nama_menu) return { error: "Nama menu wajib diisi." };
  const { error } = await supabaseAdmin
    .from("Menus")
    .update(payload)
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard/scheduler");
  return {};
}

export async function deleteMenu(menuId: string): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const { error } = await supabaseAdmin
    .from("Menus")
    .delete()
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return {};
}

export async function setMenuAvailability(
  menuId: string,
  patch: { is_active?: boolean; discount_pct?: number; schedule_days?: string | null; schedule_start?: string | null; schedule_end?: string | null }
): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const { error } = await supabaseAdmin
    .from("Menus")
    .update(patch)
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/scheduler");
  revalidatePath("/dashboard/menu");
  return {};
}

/** Persist a new display order. `orderedIds` is the full list of menu ids in
 *  the desired order; each gets sort_order = its index. Scoped to the cafe. */
export async function reorderMenus(orderedIds: string[]): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return {};
  const updates = orderedIds.map((id, i) =>
    supabaseAdmin.from("Menus").update({ sort_order: i }).eq("id_menu", id).eq("cafe_id", cafeId)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  revalidatePath("/dashboard/menu");
  revalidatePath("/[slug]", "page");
  return {};
}

// ── Cafe settings ────────────────────────────────────────────────────────

export async function updateCafeSettings(fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const payload = {
    nama_cafe: str(fd, "nama_cafe") ?? "",
    alamat_cafe: str(fd, "alamat_cafe") ?? "",
    greeting: str(fd, "greeting"),
    google_maps_review_url: str(fd, "google_maps_review_url"),
    logo_url: str(fd, "logo_url"),
    cover_url: str(fd, "cover_url"),
  };
  if (!payload.nama_cafe) return { error: "Nama kafe wajib diisi." };
  const { error } = await supabaseAdmin.from("Cafes").update(payload).eq("id_cafe", cafeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return {};
}

// ── Announcements ──────────────────────────────────────────────────────────

export async function saveAnnouncement(fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const id = str(fd, "id");
  const message = str(fd, "message");
  if (!message) return { error: "Pesan pengumuman wajib diisi." };
  const allowedTypes = ["info", "promo", "event", "warning"];
  const rawType = str(fd, "type") ?? "info";
  const payload = {
    cafe_id: cafeId,
    message,
    bg_color: str(fd, "bg_color") ?? "#FD5002",
    type: allowedTypes.includes(rawType) ? rawType : "info",
    is_active: fd.get("is_active") === "true",
    updated_at: new Date().toISOString(),
  };
  const { error } = id
    ? await supabaseAdmin.from("Announcements").update(payload).eq("id", id).eq("cafe_id", cafeId)
    : await supabaseAdmin.from("Announcements").insert([payload]);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/announcements");
  return {};
}

// ── Media upload ───────────────────────────────────────────────────────────

const BUCKET = "menu-media";

/** Issue a short-lived signed upload URL so the browser uploads the file
 *  DIRECTLY to Supabase Storage (no Vercel serverless hop) — much faster. */
export async function createMediaUploadUrl(
  kind: string,
  filename: string
): Promise<{ path?: string; token?: string; publicUrl?: string; error?: string }> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const k = (kind || "file").replace(/[^a-z0-9_-]/gi, "");
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${cafeId}/${k}/${Date.now()}-${safe}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Gagal membuat URL unggah." };
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return { path: data.path, token: data.token, publicUrl: pub.publicUrl };
}

/** Legacy server-side upload (kept as fallback). Slower: routes file through the server. */
export async function uploadMenuMedia(fd: FormData): Promise<{ url?: string; error?: string }> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };

  const file = fd.get("file");
  const kind = (str(fd, "kind") ?? "file").replace(/[^a-z0-9_-]/gi, "");
  if (!(file instanceof File) || file.size === 0) return { error: "File tidak ditemukan." };
  if (file.size > 30 * 1024 * 1024) return { error: "Ukuran maksimal 30MB." };

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${cafeId}/${kind}/${Date.now()}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return { error: error.message };

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

// ── Orders ───────────────────────────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  status: "received" | "preparing" | "ready"
): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const { error } = await supabaseAdmin
    .from("Orders")
    .update({ status })
    .eq("id_order", orderId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/orders");
  return {};
}
