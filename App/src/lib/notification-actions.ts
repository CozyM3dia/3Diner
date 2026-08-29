"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStaffCafeId } from "@/lib/staff-context";

export interface NotifAction {
  error?: string;
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
