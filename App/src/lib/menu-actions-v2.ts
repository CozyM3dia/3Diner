"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffPermission } from "@/lib/authorization";

export interface MenuResult {
  error?: string;
  /** Berapa item yang benar-benar berubah. Dipakai untuk mengabarkan hasil
   *  seleksi massal dengan angka, bukan dengan "berhasil". */
  changed?: number;
}

function revalidate() {
  revalidatePath("/dashboard-v2/menu");
  revalidatePath("/dashboard-v2");
}

/** Menyalakan atau mematikan tayangnya satu menu.
 *
 *  Ini pekerjaan paling sering di layar menu — bahan habis di tengah hari, menu
 *  harus turun sekarang, tanpa membuka formulir apa pun. */
export async function setMenuLive(menuId: string, live: boolean): Promise<MenuResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  const { error } = await supabaseAdmin
    .from("Menus")
    .update({ is_active: live })
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId);

  if (error) return { error: error.message };
  revalidate();
  return { changed: 1 };
}

/** Mematikan atau menyalakan banyak menu sekaligus.
 *
 *  Satu-satunya layar yang punya seleksi massal, dan alasannya spesifik:
 *  kehabisan satu bahan bisa mematikan delapan menu sekaligus, dan itu
 *  pekerjaan nyata yang berulang. Sisanya tidak. */
export async function setManyMenusLive(menuIds: string[], live: boolean): Promise<MenuResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_menu")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  const ids = [...new Set(menuIds)].filter(Boolean);
  if (ids.length === 0) return { error: "Tidak ada item yang dipilih." };
  if (ids.length > 200) return { error: "Terlalu banyak item sekaligus." };

  const { data, error } = await supabaseAdmin
    .from("Menus")
    .update({ is_active: live })
    .eq("cafe_id", cafeId)
    .in("id_menu", ids)
    .select("id_menu");

  if (error) return { error: error.message };
  revalidate();
  return { changed: (data ?? []).length };
}
