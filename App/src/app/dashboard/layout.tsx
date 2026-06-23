import { redirect } from "next/navigation";
import { getOwnerCafeSlug, getSessionUserId } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const slug = await getOwnerCafeSlug(userId);
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
