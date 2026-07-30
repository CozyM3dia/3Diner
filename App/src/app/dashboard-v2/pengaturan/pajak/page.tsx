import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";
import TaxForm from "@/components/dashboard-v2/TaxForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pajak · Konsol Owner",
};

/** Satu-satunya pengaturan yang sengaja TIDAK punya default diam-diam.
 *
 *  Struk hari ini mencetak nol tanpa mengatakannya, dan itu cacat produksi:
 *  nol yang belum diputuskan tidak bisa dibedakan dari nol yang dipilih. */
export default async function TaxSettingsPage() {
  const ctx = await getStaffContext();
  const cafeId = ctx.cafe_id ?? null;
  if (!cafeId) notFound();

  const [cafeResult, lastOrder] = await Promise.all([
    supabaseAdmin
      .from("Cafes")
      .select("tax_rate_pct,service_charge_pct,prices_include_tax,tax_configured_at")
      .eq("id_cafe", cafeId)
      .maybeSingle(),
    // Pratinjau memakai nilai pesanan NYATA terakhir, bukan angka bulat
    // karangan — supaya angkanya bisa dicocokkan dengan struk yang pernah
    // dicetak kafe ini.
    supabaseAdmin
      .from("Orders")
      .select("subtotal,total")
      .eq("cafe_id", cafeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!cafeResult.data) notFound();
  const cafe = cafeResult.data;
  const sample = lastOrder.data?.subtotal || lastOrder.data?.total || 50000;

  return (
    <OwnerShell
      title="Pajak & service charge"
      right={
        <Link className="dv2-btn" href="/dashboard-v2/pengaturan">
          Kembali ke Pengaturan
        </Link>
      }
    >
      <TaxForm
        taxPct={Number(cafe.tax_rate_pct ?? 0)}
        servicePct={Number(cafe.service_charge_pct ?? 0)}
        includedInPrice={Boolean(cafe.prices_include_tax)}
        configured={Boolean(cafe.tax_configured_at)}
        sampleSubtotal={Number(sample)}
      />
    </OwnerShell>
  );
}
