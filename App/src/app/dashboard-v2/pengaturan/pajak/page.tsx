import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import TaxSettingsForm, { type TaxConfig } from "@/components/dp/TaxSettingsForm";
import "../../../tax-settings.css";

export const metadata = { title: "Tax Settings · 3Diner" };
export const dynamic = "force-dynamic";

/** Tax Settings — recreation `tax-settings.html` Dream POS.
 *  Menulis lewat `saveTax` (RPC `set_cafe_tax`) yang sudah ada; action itu
 *  memang sudah me-revalidate route ini. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data } = await supabaseAdmin
    .from("Cafes")
    .select(
      "tax_rate_pct,service_charge_pct,prices_include_tax,tax_configured_at,tax_pending_rate_pct,tax_pending_service_pct,tax_pending_include,tax_pending_from",
    )
    .eq("id_cafe", ctx.cafe_id ?? "")
    .single();

  const config: TaxConfig = {
    taxPct: Number(data?.tax_rate_pct ?? 0),
    servicePct: Number(data?.service_charge_pct ?? 0),
    includedInPrice: data?.prices_include_tax === true,
    configuredAt: data?.tax_configured_at ?? null,
    pending: data?.tax_pending_from
      ? {
          taxPct: data.tax_pending_rate_pct === null ? null : Number(data.tax_pending_rate_pct),
          servicePct:
            data.tax_pending_service_pct === null ? null : Number(data.tax_pending_service_pct),
          include: data.tax_pending_include,
          from: data.tax_pending_from,
        }
      : null,
  };

  return (
    <>
      <div className="dp-page-head">
        <h1>Tax Settings</h1>
      </div>
      <TaxSettingsForm config={config} />
    </>
  );
}
