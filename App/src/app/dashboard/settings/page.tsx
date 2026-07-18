import { redirect } from "next/navigation";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import SettingsForm from "@/components/dashboard/SettingsForm";
import type { Cafe } from "@/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId, slug } = await getDashboardCafeContext();
  if (!userId) redirect("/login");

  // Settings butuh seluruh kolom Cafes — satu query khusus tetap diperlukan.
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("*").eq("slug_url", slug).single()
    : { data: null };

  if (!cafe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2 text-center px-6">
        <p className="font-semibold" style={{ color: "#E9EEF6" }}>Kafe tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5 dash-reveal">
        <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--dash-text)" }}>Pengaturan Kafe</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>Profil yang tampil di halaman menu pelanggan</p>
      </div>
      <SettingsForm cafe={cafe as Cafe} />
    </div>
  );
}
