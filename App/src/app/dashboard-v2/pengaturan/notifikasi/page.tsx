import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeNotifSettings } from "@/lib/notification-settings";
import NotifSettingsDp from "@/components/dp/NotifSettingsDp";
import "../../../nsw.css";

export const metadata = { title: "Notifications · 3Diner" };
export const dynamic = "force-dynamic";

/** Pengaturan Notifikasi — recreation modul "Notifications" Dream POS:
 *  matriks event × channel (Push/SMS/Email dsb) + perangkat + jam tenang.
 *  Preferensi tersimpan di Cafes.notification_settings dan difilter oleh
 *  createNotifications (in-app) serta alert perangkat di halaman Pesanan. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("notification_settings")
    .eq("id_cafe", ctx.cafe_id ?? "")
    .single();

  return (
    <>
      <div className="dp-page-head">
        <h1>Notifications</h1>
      </div>
      <NotifSettingsDp initial={normalizeNotifSettings(data?.notification_settings)} />
    </>
  );
}
