"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffPermission } from "@/lib/authorization";
import type { MenuFormValues } from "@/components/dp/MenuEditorForm";

export interface UpsertMenuResult {
  error?: string;
  id_menu?: string;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

/** Simpan menu dari MenuEditorForm — satu action untuk create & update.
 *
 *  Kolom yang TIDAK disentuh: model_3d_url, usdz_url, model_scale,
 *  schedule_*, redirect_link. */
export async function upsertMenuFromEditor(input: {
  id_menu?: string;
  values: MenuFormValues;
  photo: File | null;
}): Promise<UpsertMenuResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  // ── Validasi ───────────────────────────────────────────────────────────────
  const nama = (input.values.nama_menu ?? "").trim();
  if (!nama) return { error: "Nama menu wajib diisi." };
  if (nama.length > 120) return { error: "Nama menu terlalu panjang (maksimal 120 karakter)." };

  const harga = input.values.harga_menu;
  if (!Number.isFinite(harga) || harga < 0) return { error: "Harga tidak valid." };

  const discount = input.values.discount_pct;
  if (discount !== null && (!Number.isFinite(discount) || discount < 0 || discount > 90)) {
    return { error: "Diskon harus antara 0 dan 90." };
  }

  for (const [label, v] of [
    ["Waktu penyajian", input.values.serve_time_minutes],
    ["Kalori", input.values.calories],
  ] as const) {
    if (v !== null && (!Number.isFinite(v) || v < 0)) {
      return { error: `${label} tidak valid (harus angka >= 0).` };
    }
  }

  // ── Upload photo (opsional) ────────────────────────────────────────────────
  let imageUrl: string | undefined;
  if (input.photo) {
    if (input.photo.size > MAX_PHOTO_BYTES) return { error: "Ukuran foto maksimal 5MB." };
    if (input.photo.size === 0) return { error: "Foto tidak valid." };

    const buf = Buffer.from(await input.photo.arrayBuffer());
    // Konvensi path: key diawali "menu-media/" di dalam bucket "menu-media".
    const path = `menu-media/${cafeId}/${Date.now()}-card.jpg`;
    const { error } = await supabaseAdmin.storage
      .from("menu-media")
      .upload(path, buf, {
        contentType: input.photo.type || "image/jpeg",
        upsert: true,
      });
    if (error) return { error: error.message };
    imageUrl = supabaseAdmin.storage.from("menu-media").getPublicUrl(path).data.publicUrl;
  }

  const payload = {
    cafe_id: cafeId,
    nama_menu: nama,
    description_menu: (input.values.deskripsi ?? "").trim() || null,
    category: (input.values.category ?? "").trim() || null,
    harga_menu: Math.round(harga),
    discount_pct: discount === null || discount === 0 ? null : Math.round(discount),
    prep_time_minutes: input.values.serve_time_minutes,
    calories: input.values.calories,
    ingredients: (input.values.ingredients ?? "").trim() || null,
    ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
  };

  // ── Create ─────────────────────────────────────────────────────────────────
  if (!input.id_menu) {
    const { data, error } = await supabaseAdmin
      .from("Menus")
      .insert([payload])
      .select("id_menu")
      .single();
    if (error) return { error: error.message };
    revalidateAll();
    return { id_menu: data.id_menu as string };
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  const updatePayload: Omit<typeof payload, "cafe_id"> & { cafe_id?: string } = { ...payload };
  delete updatePayload.cafe_id;
  const { error } = await supabaseAdmin
    .from("Menus")
    .update(updatePayload)
    .eq("id_menu", input.id_menu)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };

  revalidateAll();
  return { id_menu: input.id_menu };
}

/** Revalidate konsol dashboard dan sisi pelanggan. */
function revalidateAll() {
  revalidatePath("/dashboard-v2/menu");
  revalidatePath("/dashboard-v2/items");
  revalidatePath("/dashboard-v2/pos");
  revalidatePath("/dashboard-v2", "layout");
  revalidatePath("/", "layout");
}
