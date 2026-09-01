import { NextResponse } from "next/server";
import { getStaffCafeId } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeNotifSettings } from "@/lib/notification-settings";

export const dynamic = "force-dynamic";

/** Preferensi notifikasi kafe untuk perangkat yang sedang membuka dashboard.
 *  Dipakai klien (OrdersClient) saat alarm diaktifkan supaya perubahan di
 *  Pengaturan → Notifications berlaku tanpa reload halaman. */
export async function GET() {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("notification_settings")
    .eq("id_cafe", cafeId)
    .maybeSingle();

  return NextResponse.json({ settings: normalizeNotifSettings(data?.notification_settings) });
}
