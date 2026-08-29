"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffPermission } from "@/lib/authorization";

/** Write-action Addons (Menu_Option_Groups + Menu_Option_Values).
 *  Addon adalah konfigurasi menu — bukan status order — jadi tulis-nya sah
 *  di konsol owner (keputusan §4.2 melarang mutasi STATUS ORDER di sini).
 *  Gate: manage_menu (pemilik menu), pola sama dengan menu-editor-actions. */

export interface AddonResult {
  error?: string;
}

export interface NewAddonInput {
  menuId: string;
  /** Grup yang sudah ada; null berarti membuat grup baru dengan newGroupName. */
  groupId: string | null;
  newGroupName: string | null;
  name: string;
  priceDelta: number;
}

function revalidateAddons() {
  revalidatePath("/dashboard-v2/addons");
  revalidatePath("/dashboard-v2");
}

/** Buat nilai addon baru. Bila grup belum ada (menu pertama kali diberi addon),
 *  grup dibuat dengan default min 0 / max 5 — cukup untuk kasus umum dan
 *  tetap bisa disunting lewat editor menu. */
export async function createAddon(input: NewAddonInput): Promise<AddonResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Nama addon wajib diisi." };
  if (name.length > 120) return { error: "Nama addon terlalu panjang." };
  if (!Number.isFinite(input.priceDelta) || input.priceDelta < 0) {
    return { error: "Harga tambahan tidak valid." };
  }

  let groupId = input.groupId;
  if (!groupId) {
    const groupName = input.newGroupName?.trim();
    if (!groupName) return { error: "Pilih grup yang ada atau isi nama grup baru." };
    if (groupName.length > 120) return { error: "Nama grup terlalu panjang." };

    const { count } = await supabaseAdmin
      .from("Menu_Option_Groups")
      .select("id_option_group", { count: "exact", head: true })
      .eq("cafe_id", cafeId)
      .eq("menu_id", input.menuId);

    const { data: group, error: groupErr } = await supabaseAdmin
      .from("Menu_Option_Groups")
      .insert({
        cafe_id: cafeId,
        menu_id: input.menuId,
        name: groupName,
        min_select: 0,
        max_select: 5,
        sort_order: count ?? 0,
      })
      .select("id_option_group")
      .single();
    if (groupErr || !group) return { error: groupErr?.message ?? "Gagal membuat grup addon." };
    groupId = group.id_option_group;
  }

  // Cegah duplikat nama dalam satu grup — kasir/menu tamu akan membingungkan.
  const { data: dup } = await supabaseAdmin
    .from("Menu_Option_Values")
    .select("id_option_value")
    .eq("cafe_id", cafeId)
    .eq("option_group_id", groupId)
    .eq("name", name)
    .limit(1);
  if (dup && dup.length > 0) return { error: "Addon dengan nama itu sudah ada di grup ini." };

  const { count: valCount } = await supabaseAdmin
    .from("Menu_Option_Values")
    .select("id_option_value", { count: "exact", head: true })
    .eq("option_group_id", groupId);

  const { error } = await supabaseAdmin.from("Menu_Option_Values").insert({
    cafe_id: cafeId,
    option_group_id: groupId,
    name,
    price_delta: Math.round(input.priceDelta),
    is_active: true,
    sort_order: valCount ?? 0,
  });
  if (error) return { error: error.message };

  revalidateAddons();
  return {};
}

/** Sunting nama & harga tambahan sebuah addon. */
export async function updateAddon(
  valueId: string,
  patch: { name: string; priceDelta: number },
): Promise<AddonResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  const name = patch.name.trim();
  if (!name) return { error: "Nama addon wajib diisi." };
  if (!Number.isFinite(patch.priceDelta) || patch.priceDelta < 0) {
    return { error: "Harga tambahan tidak valid." };
  }

  // Scope ke cafe_id: pemilik hanya boleh menyunting milik kafenya sendiri.
  const { error } = await supabaseAdmin
    .from("Menu_Option_Values")
    .update({ name, price_delta: Math.round(patch.priceDelta) })
    .eq("id_option_value", valueId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };

  revalidateAddons();
  return {};
}

/** Aktif/nonaktifkan addon — nilai nonaktif tak muncul di menu tamu. */
export async function toggleAddon(valueId: string, isActive: boolean): Promise<AddonResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  const { error } = await supabaseAdmin
    .from("Menu_Option_Values")
    .update({ is_active: isActive })
    .eq("id_option_value", valueId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };

  revalidateAddons();
  return {};
}

/** Hapus addon. Grup dibiarkan (bisa jadi akan diisi lagi oleh pemilik). */
export async function deleteAddon(valueId: string): Promise<AddonResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  const { error } = await supabaseAdmin
    .from("Menu_Option_Values")
    .delete()
    .eq("id_option_value", valueId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };

  revalidateAddons();
  return {};
}
