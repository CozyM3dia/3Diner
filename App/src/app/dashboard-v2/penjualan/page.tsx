import { getStaffContext } from "@/lib/staff-context";
import PenjualanView from "@/components/dp/PenjualanView";
import GagalMuat from "@/components/dp/GagalMuat";
import { muatPesanan, resolveRentang } from "@/lib/dashboard-query";
import { hitungMetrik } from "@/lib/dashboard-metrics";

export const dynamic = "force-dynamic";

export const metadata = { title: "Penjualan · 3Diner" };

/** Lembar Penjualan. Rentang dan pembanding berasal dari modul yang sama
 *  dengan Ringkasan, jadi kedua lembar selalu membicarakan periode yang sama. */
export default async function PenjualanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getStaffContext();
  const cafeId = ctx.cafe_id ?? "";
  const r = resolveRentang(params);

  let data;
  try {
    data = await muatPesanan(cafeId, r);
  } catch {
    return <GagalMuat />;
  }

  return (
    <PenjualanView
      m={hitungMetrik({ kini: data.kini, lalu: data.lalu, menus: data.menus, fromIso: r.fromIso, spanDays: r.spanDays })}
      fromIso={r.fromIso}
      toIso={r.toIso}
      preset={r.preset}
      spanDays={r.spanDays}
    />
  );
}
