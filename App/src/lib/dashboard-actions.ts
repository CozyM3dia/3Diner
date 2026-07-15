"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import { createClient } from "./supabase/server";
import { getOwnerCafeSlug } from "./analytics";

export interface ActionResult {
  error?: string;
}

export interface RecipeDraftInput {
  inventory_item_id: string;
  qty_per_menu: number;
}

const INVENTORY_UNIT_VALUES = ["gram", "kg", "ml", "liter", "pcs", "pack", "botol"];

function cleanInventoryUnit(value: FormDataEntryValue | null): string {
  const unit = String(value ?? "").trim();
  return INVENTORY_UNIT_VALUES.includes(unit) ? unit : "";
}

function nonnegativeNumber(fd: FormData, key: string): number | null {
  const value = num(fd, key);
  if (value === null || value < 0) return null;
  return value;
}

/** Resolve the cafe_id owned by the authenticated user, or null. */
export async function getAuthCafeId(): Promise<string | null> {
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

export interface DraftMenuInput {
  nama_menu: string;
  harga_menu: number;
  description_menu?: string | null;
  category?: string | null;
}

/** Bulk-insert AI-extracted draft menus the admin approved. */
export async function bulkCreateMenus(
  menus: DraftMenuInput[]
): Promise<{ inserted?: number; error?: string }> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  if (!Array.isArray(menus) || menus.length === 0) return { error: "Tidak ada menu untuk disimpan." };
  if (menus.length > 100) return { error: "Maksimal 100 menu sekali simpan." };

  const rows = menus
    .map((m) => ({
      cafe_id: cafeId,
      nama_menu: String(m.nama_menu ?? "").trim().slice(0, 120),
      harga_menu: Number.isFinite(m.harga_menu) ? Math.max(0, Math.round(m.harga_menu)) : 0,
      description_menu: m.description_menu ? String(m.description_menu).trim().slice(0, 400) : null,
      category: m.category ? String(m.category).trim().slice(0, 60) : null,
      model_3d_url: "",
      redirect_link: "",
      is_active: true,
      discount_pct: 0,
    }))
    .filter((r) => r.nama_menu.length > 0);

  if (rows.length === 0) return { error: "Semua item kosong / tidak valid." };

  const { error } = await supabaseAdmin.from("Menus").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return { inserted: rows.length };
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

// ── Sales export ───────────────────────────────────────────────────────────

export interface SalesExportRow {
  id_order: string;
  created_at: string;
  table_number: string;
  items_summary: string;
  item_count: number;
  total: number;
  payment_method: string;
  payment_status: string;
  status: string;
}

/** Fetch orders in a date range (scoped to the owner's cafe) for CSV/PDF export. */
export async function getSalesExport(
  start?: string,
  end?: string
): Promise<{ rows?: SalesExportRow[]; cafeName?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi tidak valid. Masuk ulang." };
  const slug = await getOwnerCafeSlug(user.id);
  if (!slug) return { error: "Kafe tidak ditemukan." };

  const { data: cafe } = await supabaseAdmin
    .from("Cafes").select("id_cafe, nama_cafe").eq("slug_url", slug).single();
  if (!cafe) return { error: "Kafe tidak ditemukan." };

  let q = supabaseAdmin
    .from("Orders")
    .select("id_order, created_at, table_number, items, total, payment_method, payment_status, status")
    .eq("cafe_id", cafe.id_cafe)
    .order("created_at", { ascending: false });
  if (start) q = q.gte("created_at", new Date(start).toISOString());
  if (end) {
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    q = q.lte("created_at", e.toISOString());
  }

  const { data, error } = await q.limit(2000);
  if (error) return { error: error.message };

  const rows: SalesExportRow[] = (data ?? []).map((o) => {
    const items = Array.isArray(o.items) ? (o.items as { nama_menu: string; qty: number }[]) : [];
    return {
      id_order: o.id_order as string,
      created_at: o.created_at as string,
      table_number: String(o.table_number ?? ""),
      items_summary: items.map((it) => `${it.qty}x ${it.nama_menu}`).join("; "),
      item_count: items.reduce((n, it) => n + (it.qty ?? 0), 0),
      total: Number(o.total) || 0,
      payment_method: (o.payment_method as string) ?? "-",
      payment_status: (o.payment_status as string) ?? "-",
      status: (o.status as string) ?? "-",
    };
  });

  return { rows, cafeName: (cafe.nama_cafe as string) ?? "3Diner" };
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

function inventoryPayload(fd: FormData) {
  return {
    name: str(fd, "name") ?? "",
    unit: cleanInventoryUnit(fd.get("unit")),
    current_qty: nonnegativeNumber(fd, "current_qty") ?? 0,
    minimum_qty: nonnegativeNumber(fd, "minimum_qty") ?? 0,
    estimated_unit_cost: Math.round(nonnegativeNumber(fd, "estimated_unit_cost") ?? 0),
    notes: str(fd, "notes"),
  };
}

export async function createInventoryItem(fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const payload = inventoryPayload(fd);
  if (!payload.name) return { error: "Nama bahan wajib diisi." };
  if (!payload.unit) return { error: "Satuan bahan tidak valid." };

  const { error } = await supabaseAdmin
    .from("Inventory_Items")
    .insert([{ cafe_id: cafeId, ...payload }]);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/menu");
  return {};
}

export async function updateInventoryItem(id: string, fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const payload = inventoryPayload(fd);
  if (!payload.name) return { error: "Nama bahan wajib diisi." };
  if (!payload.unit) return { error: "Satuan bahan tidak valid." };

  const { error } = await supabaseAdmin
    .from("Inventory_Items")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id_inventory_item", id)
    .eq("cafe_id", cafeId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/menu");
  return {};
}

export async function adjustInventoryStock(id: string, fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };

  const mode = str(fd, "mode");
  const rawQty = nonnegativeNumber(fd, "quantity");
  const note = str(fd, "note");
  if (!["add", "subtract", "set"].includes(mode ?? "")) return { error: "Jenis penyesuaian tidak valid." };
  if (rawQty === null) return { error: "Jumlah penyesuaian tidak valid." };

  const { data, error } = await supabaseAdmin.rpc("adjust_inventory_stock", {
    p_cafe_id: cafeId,
    p_inventory_item_id: id,
    p_mode: mode,
    p_quantity: rawQty,
    p_note: note,
  });
  if (error) return { error: error.message };

  const rpcError = (data as { error?: string } | null)?.error;
  if (rpcError === "inventory_not_found") return { error: "Bahan tidak ditemukan." };
  if (rpcError === "negative_stock") return { error: "Stok tidak boleh kurang dari 0." };
  if (rpcError === "invalid_adjustment") return { error: "Jumlah penyesuaian tidak valid." };

  revalidatePath("/dashboard/inventory");
  return {};
}

export async function saveMenuRecipes(menuId: string, rows: RecipeDraftInput[]): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };

  const cleanRows = rows
    .map((row) => ({
      cafe_id: cafeId,
      menu_id: menuId,
      inventory_item_id: String(row.inventory_item_id ?? "").trim(),
      qty_per_menu: Number(row.qty_per_menu),
    }))
    .filter((row) => row.inventory_item_id && Number.isFinite(row.qty_per_menu) && row.qty_per_menu > 0);

  const ids = new Set<string>();
  for (const row of cleanRows) {
    if (ids.has(row.inventory_item_id)) return { error: "Satu bahan tidak boleh muncul dua kali di resep yang sama." };
    ids.add(row.inventory_item_id);
  }

  const { data, error } = await supabaseAdmin.rpc("replace_menu_recipes", {
    p_cafe_id: cafeId,
    p_menu_id: menuId,
    p_rows: cleanRows.map(({ inventory_item_id, qty_per_menu }) => ({
      inventory_item_id,
      qty_per_menu,
    })),
  });
  if (error) return { error: error.message };

  const rpcError = (data as { error?: string } | null)?.error;
  if (rpcError === "menu_not_found") return { error: "Menu tidak ditemukan." };
  if (rpcError === "inventory_item_not_found") return { error: "Bahan tidak ditemukan." };
  if (rpcError === "duplicate_recipe_item") {
    return { error: "Satu bahan tidak boleh muncul dua kali di resep yang sama." };
  }
  if (rpcError === "invalid_recipe_rows") return { error: "Data resep tidak valid." };

  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard/menu/" + menuId + "/edit");
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
