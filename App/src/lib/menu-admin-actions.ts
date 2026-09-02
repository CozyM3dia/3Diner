"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AuthorizationError, requireStaffPermission } from "@/lib/authorization";
import { buildScheduleFields } from "@/lib/schedule-days";
import type { MenuFormValues } from "@/components/dp/MenuEditorForm";

export interface UpsertMenuResult {
  error?: string;
  id_menu?: string;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

function pesanOtorisasi(e: unknown): string {
  if (e instanceof AuthorizationError) {
    return "Anda tidak punya wewenang mengubah menu.";
  }
  return "Sesi tidak berlaku. Masuk ulang.";
}

/** Simpan menu dari MenuEditorForm — satu action untuk create & update.
 *
 *  MenuFormValues kini mencakup tab Digital Menu (tayang/jadwal/diskon/
 *  redirect) dan tab 3D & AR (URL model + skala). Kolom foto tetap lewat
 *  `photo`; kolom lain tidak disentuh. */
export async function upsertMenuFromEditor(input: {
  id_menu?: string;
  values: MenuFormValues;
  photo: File | null;
}): Promise<UpsertMenuResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch (e) {
    return { error: pesanOtorisasi(e) };
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

  // Jadwal tayang: satu utilitas dengan sisi pelanggan — jadwal setengah
  // terisi (hanya jam mulai, misalnya) ditolak, bukan disimpan diam-diam.
  const schedule = buildScheduleFields(
    input.values.schedule_days ?? null,
    input.values.schedule_start ?? null,
    input.values.schedule_end ?? null,
  );
  if (schedule.error) return { error: schedule.error };

  const redirect = (input.values.redirect_link ?? "").trim();
  if (redirect && !/^https?:\/\//i.test(redirect)) {
    return { error: "Link redirect harus dimulai dengan http:// atau https://." };
  }

  const scale = input.values.model_scale;
  if (scale !== undefined && scale !== null && (!Number.isFinite(scale) || scale <= 0 || scale > 10)) {
    return { error: "Skala model harus angka antara 0,1 dan 10." };
  }

  const modelUrl = (input.values.model_3d_url ?? "").trim();
  if (modelUrl && !/^https?:\/\//i.test(modelUrl)) {
    return { error: "URL model 3D harus dimulai dengan http:// atau https://." };
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
    // ── Tab Digital Menu ──
    is_active: input.values.is_active !== false,
    schedule_days: schedule.schedule_days,
    schedule_start: schedule.schedule_start,
    schedule_end: schedule.schedule_end,
    redirect_link: redirect || null,
    // ── Tab 3D & AR ──
    model_3d_url: modelUrl || null,
    model_scale: scale ?? 1.0,
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

/** Data awal untuk editor floating (dipanggil Items saat membuka panel edit):
 *  satu query menu + daftar kategori unik kafe. Null bila menu bukan milik
 *  kafe ini. */
export async function getMenuEditorData(id: string): Promise<{
  error?: string;
  values?: Partial<MenuFormValues>;
  imageUrl?: string | null;
  categories?: string[];
}> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch (e) {
    return { error: pesanOtorisasi(e) };
  }

  const [menuRes, catRes] = await Promise.all([
    supabaseAdmin
      .from("Menus")
      .select(
        "id_menu,nama_menu,harga_menu,discount_pct,description_menu,category,image_url,prep_time_minutes,calories,ingredients,is_active,schedule_days,schedule_start,schedule_end,redirect_link,model_3d_url,model_scale"
      )
      .eq("id_menu", id)
      .eq("cafe_id", cafeId)
      .maybeSingle(),
    supabaseAdmin.from("Menus").select("category").eq("cafe_id", cafeId),
  ]);
  if (menuRes.error) return { error: menuRes.error.message };
  if (!menuRes.data) return { error: "Menu tidak ditemukan." };

  const m = menuRes.data as {
    nama_menu: string | null; harga_menu: number | null; discount_pct: number | null;
    description_menu: string | null; category: string | null; image_url: string | null;
    prep_time_minutes: number | null; calories: number | null; ingredients: string | null;
    is_active: boolean | null; schedule_days: string | null; schedule_start: string | null;
    schedule_end: string | null; redirect_link: string | null;
    model_3d_url: string | null; model_scale: number | null;
  };
  const categories = Array.from(
    new Set((catRes.data ?? []).map(r => (r.category ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "id"));

  return {
    values: {
      nama_menu: m.nama_menu ?? "",
      deskripsi: m.description_menu ?? "",
      category: m.category ?? "",
      harga_menu: m.harga_menu ?? 0,
      discount_pct: m.discount_pct ?? null,
      serve_time_minutes: m.prep_time_minutes ?? null,
      calories: m.calories ?? null,
      ingredients: m.ingredients ?? "",
      // ── Digital Menu ──
      is_active: m.is_active !== false,
      schedule_days: m.schedule_days ?? "",
      schedule_start: m.schedule_start ?? "",
      schedule_end: m.schedule_end ?? "",
      redirect_link: m.redirect_link ?? "",
      // ── 3D & AR ──
      model_3d_url: m.model_3d_url ?? "",
      model_scale: m.model_scale ?? 1.0,
    },
    imageUrl: m.image_url,
    categories,
  };
}
