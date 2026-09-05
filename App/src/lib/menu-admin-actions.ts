"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AuthorizationError, requireStaffPermission } from "@/lib/authorization";
import { buildScheduleFields } from "@/lib/schedule-days";
import { revalidateGuestCafe } from "@/lib/guest-revalidate";
import { getMenuOptionsForOwner } from "@/lib/menu-options";
import { optionGroupsValidationError, type OptionGroupDraft } from "@/lib/menu-option-drafts";
import { pruneAddonDrafts, withKeys, type AddonGroupDraft } from "@/lib/menu-addon-drafts";
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
  let cafeSlug: string | null;
  try {
    const auth = await requireStaffPermission("manage_menu");
    cafeId = auth.cafeId;
    cafeSlug = auth.cafeSlug;
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

  // ── Tambahan (grup varian) ─────────────────────────────────────────────────
  // Divalidasi SEBELUM baris menu ditulis. Urutan ini disengaja: menolak lebih
  // dulu berarti pemilik tidak pernah berada di keadaan "menu tersimpan, tapi
  // varian ditolak" — keadaan yang tidak bisa dijelaskan dengan satu kalimat
  // dan tidak bisa dibatalkan dengan satu tombol.
  //
  // `undefined` = editor tidak mengirim tab Tambahan sama sekali; varian yang
  // sudah ada DIBIARKAN. Array kosong = pemilik memang mengosongkannya.
  let optionGroups: OptionGroupDraft[] | null = null;
  if (Array.isArray(input.values.option_groups)) {
    optionGroups = toOptionDrafts(input.values.option_groups);
    const optionError = optionGroupsValidationError(optionGroups);
    if (optionError) return { error: optionError };
  }

  // ── Create / Update ────────────────────────────────────────────────────────
  let menuId: string;
  if (!input.id_menu) {
    const { data, error } = await supabaseAdmin
      .from("Menus")
      .insert([payload])
      .select("id_menu")
      .single();
    if (error) return { error: error.message };
    menuId = data.id_menu as string;
  } else {
    const updatePayload: Omit<typeof payload, "cafe_id"> & { cafe_id?: string } = { ...payload };
    delete updatePayload.cafe_id;
    const { error } = await supabaseAdmin
      .from("Menus")
      .update(updatePayload)
      .eq("id_menu", input.id_menu)
      .eq("cafe_id", cafeId);
    if (error) return { error: error.message };
    menuId = input.id_menu;
  }

  if (optionGroups) {
    const optionError = await replaceOptions(cafeId, menuId, optionGroups);
    if (optionError) {
      revalidateAll(cafeSlug, cafeId);
      // Menunya SUDAH tersimpan di titik ini; menyebut keduanya adalah satu-
      // satunya laporan yang jujur.
      return { id_menu: menuId, error: `Menu tersimpan, tetapi tambahan gagal: ${optionError}` };
    }
  }

  revalidateAll(cafeSlug, cafeId);
  return { id_menu: menuId };
}

/** Draft editor → bentuk yang dimengerti `replace_menu_options`.
 *  `recipes` dibawa apa adanya: editor tambahan tidak menyuntingnya, dan RPC
 *  menulis ulang seluruh grup, jadi menjatuhkannya di sini akan diam-diam
 *  memutus potongan stok otomatis yang dipasang lewat editor menu lama. */
function toOptionDrafts(groups: AddonGroupDraft[]): OptionGroupDraft[] {
  return pruneAddonDrafts(groups).map(g => ({
    name: String(g.name ?? "").trim(),
    min_select: Number(g.min_select),
    max_select: Number(g.max_select),
    values: (g.values ?? []).map(v => ({
      name: String(v.name ?? "").trim(),
      price_delta: Math.trunc(Number(v.price_delta) || 0),
      is_active: v.is_active !== false,
      recipes: (v.recipes ?? [])
        .map(r => ({
          inventory_item_id: String(r.inventory_item_id ?? "").trim(),
          qty_per_menu: Number(r.qty_per_menu),
        }))
        .filter(r => r.inventory_item_id !== ""),
    })),
  }));
}

/** Tulis ulang seluruh grup varian satu menu dalam satu transaksi RPC.
 *  Mengembalikan pesan kesalahan, atau null bila berhasil. */
async function replaceOptions(
  cafeId: string,
  menuId: string,
  groups: OptionGroupDraft[],
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("replace_menu_options", {
    p_cafe_id: cafeId,
    p_menu_id: menuId,
    p_groups: groups,
  });
  if (error) return error.message;

  const rpcError = (data as { error?: string } | null)?.error;
  if (!rpcError) return null;
  if (rpcError === "menu_not_found") return "menu tidak ditemukan.";
  if (rpcError === "inventory_item_not_found") return "bahan inventory tidak ditemukan.";
  if (rpcError === "too_many_groups") return "maksimal 10 grup per menu.";
  if (rpcError === "invalid_option_recipe") return "data bahan varian tidak valid.";
  return "data varian tidak valid.";
}

/** Revalidate konsol dashboard dan sisi pelanggan satu kafe (bukan seluruh `/`). */
function revalidateAll(slug: string | null, cafeId: string) {
  revalidatePath("/dashboard-v2/menu");
  revalidatePath("/dashboard-v2/items");
  revalidatePath("/dashboard-v2/pos");
  revalidatePath("/dashboard-v2", "layout");
  revalidateGuestCafe(slug, cafeId);
}

/** Data awal untuk editor floating (dipanggil Items saat membuka panel edit):
 *  satu query menu + daftar kategori unik kafe. Null bila menu bukan milik
 *  kafe ini. */
export async function getMenuEditorData(id: string): Promise<{
  error?: string;
  values?: Partial<MenuFormValues>;
  imageUrl?: string | null;
  categories?: string[];
  /** Terisi bila grup varian gagal dimuat. Saat itu `values.option_groups`
   *  sengaja DIBIARKAN undefined — form yang mengirim array kosong dari daftar
   *  yang gagal dimuat akan menghapus varian pemilik tanpa ia pernah
   *  melihatnya. */
  optionsError?: string;
}> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch (e) {
    return { error: pesanOtorisasi(e) };
  }

  const [menuRes, catRes, opsi] = await Promise.all([
    supabaseAdmin
      .from("Menus")
      .select(
        "id_menu,nama_menu,harga_menu,discount_pct,description_menu,category,image_url,prep_time_minutes,calories,ingredients,is_active,schedule_days,schedule_start,schedule_end,redirect_link,model_3d_url,model_scale"
      )
      .eq("id_menu", id)
      .eq("cafe_id", cafeId)
      .maybeSingle(),
    supabaseAdmin.from("Menus").select("category").eq("cafe_id", cafeId),
    // Varian nonaktif ikut ditarik (activeOnly=false): pemilik harus bisa
    // menyalakannya kembali saat topping yang habis kemarin datang lagi.
    getMenuOptionsForOwner(cafeId, id),
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
      // ── Tambahan ──
      option_groups: opsi.error ? undefined : withKeys(
        opsi.groups.map(g => ({
          name: g.name,
          min_select: g.min_select,
          max_select: g.max_select,
          values: (g.values ?? []).map(v => ({
            name: v.name,
            price_delta: v.price_delta,
            is_active: v.is_active,
            recipes: (v.recipes ?? []).map(r => ({
              inventory_item_id: r.inventory_item_id,
              qty_per_menu: r.qty_per_menu,
            })),
          })),
        })),
      ),
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
    optionsError: opsi.error ?? undefined,
  };
}
