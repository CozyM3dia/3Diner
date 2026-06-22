import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import SettingsForm from "@/components/dashboard/SettingsForm";
import type { Cafe } from "@/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
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
    <div className="p-5 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>Pengaturan Kafe</h1>
        <p className="text-sm mt-1" style={{ color: "#5A7898" }}>Profil yang tampil di halaman menu pelanggan</p>
      </div>
      <SettingsForm cafe={cafe as Cafe} />
    </div>
  );
}
