import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  let cafe: { nama_cafe: string; logo_url: string | null; slug_url: string } | null = null;
  if (slug) {
    const { data } = await supabaseAdmin
      .from("Cafes")
      .select("nama_cafe, logo_url, slug_url")
      .eq("slug_url", slug)
      .single();
    cafe = (data as typeof cafe) ?? null;
  }

  return <DashboardShell cafe={cafe}>{children}</DashboardShell>;
}
