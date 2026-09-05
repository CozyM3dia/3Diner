import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { canonicalOrigin, menuUrlFor } from "@/lib/site-url";
import StoreSettingsForm from "@/components/dp/StoreSettingsForm";
import QrSmartMenuDp from "@/components/dp/QrSmartMenuDp";

export const metadata = { title: "Store Settings & QR Menu · 3Diner" };
export const dynamic = "force-dynamic";

/** Pengaturan Toko & QR Smart Menu — digabung dalam satu section konsol owner. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const cafeId = ctx.cafe_id ?? "";
  const { data, error } = await supabaseAdmin
    .from("Cafes")
    .select("nama_cafe,alamat_cafe,greeting,google_maps_review_url,logo_url,cover_url,slug_url")
    .eq("id_cafe", cafeId)
    .single();
  if (error) throw new Error("Data gagal dimuat. Coba lagi.");

  const slug = (data?.slug_url as string | null) ?? null;
  const cafeName = data?.nama_cafe ?? "Kafe";
  const menuUrl = slug ? menuUrlFor(canonicalOrigin(), slug) : null;

  return (
    <>
      <div className="dp-page-head">
        <h1>Pengaturan Toko &amp; QR Smart Menu</h1>
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
      <QrSmartMenuDp menuUrl={menuUrl} cafeName={cafeName} slug={slug} />
    </>
  );
}
