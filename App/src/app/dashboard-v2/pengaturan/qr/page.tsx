import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { canonicalOrigin, menuUrlFor } from "@/lib/site-url";
import QrSmartMenuDp from "@/components/dp/QrSmartMenuDp";

export const metadata = { title: "QR Smart Menu · 3Diner" };
export const dynamic = "force-dynamic";

/** QR Smart Menu — dihasilkan dari URL menu publik kafe (Cafes.slug_url).
 *  Origin dari env production (VERCEL_PROJECT_PRODUCTION_URL) dengan fallback
 *  localhost, perilaku sama dengan settings legacy. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const cafeId = ctx.cafe_id ?? "";
  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("nama_cafe,slug_url")
    .eq("id_cafe", cafeId)
    .single();

  const slug = (data?.slug_url as string | null) ?? null;
  const cafeName = data?.nama_cafe ?? "Kafe";
  const menuUrl = slug ? menuUrlFor(canonicalOrigin(), slug) : null;

  return (
    <>
      <div className="dp-page-head">
        <h1>QR Smart Menu</h1>
      </div>
      <QrSmartMenuDp menuUrl={menuUrl} cafeName={cafeName} slug={slug} />
    </>
  );
}
