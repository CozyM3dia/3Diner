import { getStaffContext } from "@/lib/staff-context";
import DashboardView from "@/components/dp/DashboardView";
import GagalMuat from "@/components/dp/GagalMuat";
import { muatPesanan, muatPeristiwa, resolveRentang } from "@/lib/dashboard-query";
import { hitungMetrik } from "@/lib/dashboard-metrics";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ringkasan · 3Diner" };

/** Lembar Ringkasan. Hanya mengambil data; tampilannya di `DashboardView`
 *  supaya susunan yang sama bisa dijalankan dengan fixture (`/dev-preview`). */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getStaffContext();
  const cafeId = ctx.cafe_id ?? "";
  const r = resolveRentang(params);

  let data;
  let tamu;
  try {
    const pesanan = muatPesanan(cafeId, r);
    [data, tamu] = await Promise.all([
      pesanan,
      muatPeristiwa(cafeId, r, pesanan.then((d) => d.menus)),
    ]);
  } catch {
    return <GagalMuat />;
  }

  return (
    <DashboardView
      m={hitungMetrik({ kini: data.kini, lalu: data.lalu, menus: data.menus, fromIso: r.fromIso, spanDays: r.spanDays })}
      tamu={tamu}
      fromIso={r.fromIso}
      toIso={r.toIso}
      preset={r.preset}
      spanDays={r.spanDays}
    />
  );
}
