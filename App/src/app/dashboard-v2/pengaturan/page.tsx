import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import StoreSettingsForm from "@/components/dp/StoreSettingsForm";

export const metadata = { title: "Store Settings · 3Diner" };
export const dynamic = "force-dynamic";

/** Store Settings — recreation `store-settings.html` Dream POS.
 *  Menulis lewat `updateCafeSettings` yang sudah ada (HANDOFF §4.5). */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("nama_cafe,alamat_cafe,greeting,google_maps_review_url,logo_url,cover_url")
    .eq("id_cafe", ctx.cafe_id ?? "")
    .single();

  return (
    <>
      <div className="dp-page-head">
        <h1>Store Settings</h1>
      </div>
      <StoreSettingsForm
        cafe={{
          nama_cafe: data?.nama_cafe ?? "",
          alamat_cafe: data?.alamat_cafe ?? null,
          greeting: data?.greeting ?? null,
          google_maps_review_url: data?.google_maps_review_url ?? null,
          logo_url: data?.logo_url ?? null,
          cover_url: data?.cover_url ?? null,
        }}
      />
    </>
  );
}
