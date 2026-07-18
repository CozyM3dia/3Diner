import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import SchedulerClient from "@/components/dashboard/SchedulerClient";
import type { Menu } from "@/types";

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null };

  const { data: menus } = cafe
    ? await supabaseAdmin.from("Menus").select("*").eq("cafe_id", cafe.id_cafe).order("nama_menu", { ascending: true })
    : { data: [] };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-5 dash-reveal">
        <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--dash-text)" }}>Jadwal & Diskon</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>
          Atur jam tayang dan diskon otomatis tiap menu. Menu di luar jadwal otomatis tersembunyi.
        </p>
      </div>
      <SchedulerClient menus={(menus ?? []) as Menu[]} />
    </div>
  );
}
