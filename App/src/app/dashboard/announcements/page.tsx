import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AnnouncementForm from "@/components/dashboard/AnnouncementForm";
import type { Announcement } from "@/types";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null };

  const { data: announcement } = cafe
    ? await supabaseAdmin
        .from("Announcements")
        .select("*")
        .eq("cafe_id", cafe.id_cafe)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5 dash-reveal">
        <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--dash-text)" }}>Pengumuman</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>Banner real-time di halaman menu pelanggan</p>
      </div>
      <AnnouncementForm announcement={(announcement as Announcement) ?? null} />
    </div>
  );
}
