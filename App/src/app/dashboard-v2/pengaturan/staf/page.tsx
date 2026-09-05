import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import StaffManager from "@/components/dp/StaffManager";
import type { StaffRole } from "@/types";

export const metadata = { title: "Kelola Staf · 3Diner" };
export const dynamic = "force-dynamic";

/** Manage Staffs — recreation `users.html` Dream POS dengan kontrol nyata:
 *  tambah staf (buat akun auth bila perlu + baris Staff) dan kurangi
 *  (nonaktif/aktifkan). Owner tidak bisa dinonaktifkan lewat UI ini.
 *  Detail keamanan di src/lib/staff-actions.ts. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data, error } = await supabaseAdmin
    .from("Staff")
    .select("id_staff,full_name,role,is_active,created_at,user_id")
    .eq("cafe_id", ctx.cafe_id ?? "")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error("Data gagal dimuat. Coba lagi.");

  const staff = (data ?? []).map(s => ({
    id_staff: s.id_staff,
    user_id: s.user_id,
    full_name: s.full_name,
    role: s.role as StaffRole,
    is_active: s.is_active,
    created_at: s.created_at,
  }));

  return <StaffManager staff={staff} selfUserId={ctx.user_id ?? null} />;
}
