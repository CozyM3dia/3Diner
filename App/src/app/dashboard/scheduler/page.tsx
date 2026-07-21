import { redirect } from "next/navigation";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import SchedulerClient from "@/components/dashboard/SchedulerClient";
import { DashboardPageHeader } from "@/components/dashboard/system";
import type { Menu } from "@/types";

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  const { userId, cafeId } = await getDashboardCafeContext();
  if (!userId) redirect("/login");

  const { data: menus } = cafeId
    ? await supabaseAdmin.from("Menus").select("*").eq("cafe_id", cafeId).order("nama_menu", { ascending: true })
    : { data: [] };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <DashboardPageHeader
        title="Jadwal & Diskon"
        subtitle="Atur jam tayang dan diskon otomatis tiap menu. Menu di luar jadwal otomatis tersembunyi."
      />
      <SchedulerClient menus={(menus ?? []) as Menu[]} />
    </div>
  );
}
