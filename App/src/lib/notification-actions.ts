"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStaffCafeId } from "@/lib/staff-context";
import { normalizeNotifSettings } from "@/lib/notification-settings";

export interface NotifAction {
  error?: string;
}

/** Simpan preferensi notifikasi kafe (modul Pengaturan → Notifications).
 *
 *  FormData berisi `settings` JSON yang SUDAH dinormalisasi komponen lewat
 *  `normalizeNotifSettings` — di sini dinormalisasi SEKALI LAGI di server
 *  (whitelist kunci + paksaan tipe), jadi payload yang dirusak di jalan
 *  tidak bisa menyuntik kunci asing ke kolom jsonb. Pola sama dengan
 *  `updateReceiptSettings`. */
export async function saveNotificationSettings(fd: FormData): Promise<NotifAction> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(fd.get("settings") ?? ""));
  } catch {
    return { error: "Data pengaturan notifikasi tidak valid." };
  }
  const payload = normalizeNotifSettings(parsed);

  const { error } = await supabaseAdmin
    .from("Cafes")
    .update({ notification_settings: payload })
    .eq("id_cafe", cafeId);
  if (error) return { error: "Gagal menyimpan pengaturan notifikasi." };

  revalidatePath("/dashboard-v2/pengaturan/notifikasi");
  revalidatePath("/dashboard-v2", "layout");
  return {};
}

/** Tandai satu notifikasi dibaca. */
export async function markNotificationRead(id: string): Promise<NotifAction> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku." };
  const { error } = await supabaseAdmin
    .from("Notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("cafe_id", cafeId)
    .is("read_at", null);
  if (error) return { error: "Gagal menandai dibaca." };
  revalidatePath("/dashboard-v2", "layout");
  return {};
}

/** Tandai SEMUA notifikasi kafe ini dibaca. */
export async function markAllNotificationsRead(): Promise<NotifAction> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku." };
  const { error } = await supabaseAdmin
    .from("Notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("cafe_id", cafeId)
    .is("read_at", null);
  if (error) return { error: "Gagal menandai semua dibaca." };
  revalidatePath("/dashboard-v2", "layout");
  return {};
}
