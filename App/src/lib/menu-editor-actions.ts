"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStaffCafeId } from "@/lib/staff-context";

export interface EditorResult {
  error?: string;
}

export interface MenuBasics {
  nama_menu: string;
  category: string | null;
  harga_menu: number;
  description_menu: string | null;
}

export interface MenuSchedule {
  is_active: boolean;
  discount_pct: number | null;
  /** ISO weekday numbers, koma. "1,2,3" = Senin–Rabu. Kosong = tiap hari. */
  schedule_days: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function revalidate(menuId: string) {
  revalidatePath("/dashboard-v2/menu");
  revalidatePath(`/dashboard-v2/menu/${menuId}`);
  revalidatePath("/dashboard-v2");
}

/** Menyimpan bidang dasar satu menu.
 *
 *  Harga divalidasi di sini DAN dibatasi non-negatif: harga negatif akan
 *  membuat total pesanan berkurang saat item ditambahkan, dan itu bukan diskon
 *  melainkan kebocoran. */
export async function saveMenuBasics(menuId: string, basics: MenuBasics): Promise<EditorResult> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };

  const nama = basics.nama_menu.trim();
  if (!nama) return { error: "Nama menu wajib diisi." };
  if (nama.length > 120) return { error: "Nama menu terlalu panjang." };

  if (!Number.isFinite(basics.harga_menu) || basics.harga_menu < 0) {
    return { error: "Harga tidak valid." };
  }

  const { error } = await supabaseAdmin
    .from("Menus")
    .update({
      nama_menu: nama,
      category: basics.category?.trim() || null,
      harga_menu: Math.round(basics.harga_menu),
      description_menu: basics.description_menu?.trim() || null,
    })
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId);

  if (error) return { error: error.message };
  revalidate(menuId);
  return {};
}

/** Menyimpan jadwal tayang dan diskon.
 *
 *  Jam mulai dan jam selesai harus dua-duanya ada atau dua-duanya kosong.
 *  Mengisi salah satu saja menghasilkan jadwal yang tidak bisa dievaluasi, dan
 *  menu akan hilang dari menu tamu tanpa ada yang tahu sebabnya. */
export async function saveMenuSchedule(
  menuId: string,
  schedule: MenuSchedule
): Promise<EditorResult> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };

  const start = schedule.schedule_start?.trim() || null;
  const end = schedule.schedule_end?.trim() || null;

  if ((start && !end) || (end && !start)) {
    return { error: "Isi jam mulai dan jam selesai dua-duanya, atau kosongkan keduanya." };
  }
  if (start && !HHMM.test(start)) return { error: "Jam mulai harus berformat HH:MM." };
  if (end && !HHMM.test(end)) return { error: "Jam selesai harus berformat HH:MM." };

  const discount = schedule.discount_pct;
  if (discount !== null && (!Number.isFinite(discount) || discount < 0 || discount > 100)) {
    return { error: "Diskon harus antara 0 dan 100." };
  }

  const days = (schedule.schedule_days ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  if (days.some((d) => !/^[1-7]$/.test(d))) return { error: "Hari tayang tidak valid." };

  const { error } = await supabaseAdmin
    .from("Menus")
    .update({
      is_active: schedule.is_active,
      discount_pct: discount === null || discount === 0 ? null : Math.round(discount),
      schedule_days: days.length > 0 && days.length < 7 ? days.join(",") : null,
      schedule_start: start,
      schedule_end: end,
    })
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId);

  if (error) return { error: error.message };
  revalidate(menuId);
  return {};
}
