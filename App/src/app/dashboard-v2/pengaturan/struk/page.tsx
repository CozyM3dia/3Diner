import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeReceiptSettings } from "@/lib/receipt-settings";
import StrukSettingsDp from "@/components/dp/StrukSettingsDp";
import "../../../rsp.css";

export const metadata = { title: "Pengaturan Struk · 3Diner" };
export const dynamic = "force-dynamic";

/** Pengaturan Struk — recreation "Atur Tampilan Struk" Dream POS.
 *  Preferensi tersimpan di Cafes.receipt_settings dan mengubah struk
 *  termal yang benar-benar dicetak POS/kasir (satu builder yang sama). */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("nama_cafe,alamat_cafe,logo_url,tax_configured_at,receipt_settings")
    .eq("id_cafe", ctx.cafe_id ?? "")
    .single();

  return (
    <>
      <div className="dp-page-head">
        <h1>Atur Tampilan Struk</h1>
      </div>
      <StrukSettingsDp
        cafeName={(data?.nama_cafe as string | null) ?? ""}
        cafeAddress={(data?.alamat_cafe as string | null) ?? null}
        logoUrl={(data?.logo_url as string | null) ?? null}
        taxConfigured={Boolean(data?.tax_configured_at)}
        initial={normalizeReceiptSettings(data?.receipt_settings)}
      />
    </>
  );
}
