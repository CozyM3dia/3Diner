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
  const payload = {
    cafe_id: cafeId,
    message,
    bg_color: str(fd, "bg_color") ?? "#FD5002",
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
