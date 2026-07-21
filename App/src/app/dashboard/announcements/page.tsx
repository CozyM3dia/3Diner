import { redirect } from "next/navigation";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AnnouncementForm from "@/components/dashboard/AnnouncementForm";
import { DashboardPageHeader } from "@/components/dashboard/system";
import type { Announcement } from "@/types";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const { userId, cafeId } = await getDashboardCafeContext();
  if (!userId) redirect("/login");

  const { data: announcement } = cafeId
    ? await supabaseAdmin
        .from("Announcements")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <DashboardPageHeader title="Pengumuman" subtitle="Banner real-time di halaman menu pelanggan" />
      <AnnouncementForm announcement={(announcement as Announcement) ?? null} />
    </div>
  );
}
