import { redirect } from "next/navigation";
import { canOpenKitchenConsole, getStaffContext } from "@/lib/staff-context";
import { homeRouteForRole } from "@/types";
import { ambilTiketDapur } from "@/lib/kitchen-query";
import PapanDapur from "@/components/kitchen/PapanDapur";

export const metadata = { title: "Dapur · 3Diner" };
export const dynamic = "force-dynamic";

/** Papan dapur di perangkat dapur.
 *
 *  Permukaan berdiri sendiri sejajar /kasir: tujuan login staf kitchen lewat
 *  homeRouteForRole, tanpa nav konsol pemilik. Semua alat yang dibutuhkan
 *  perangkat ini — termasuk pintu keluar — ada di bar pass papan itu sendiri. */
export default async function Page() {
  const ctx = await getStaffContext();

  // Owner punya jalannya sendiri; kasir juga (anti-loop: keduanya dibawa ke
  // home masing-masing, bukan dilempar bolak-balik antar layout).
  if (ctx.role && !canOpenKitchenConsole(ctx.role)) {
    redirect(homeRouteForRole(ctx.role) ?? "/login?alasan=bukan-staf");
  }

  const tiket = await ambilTiketDapur(ctx.cafe_id ?? "");

  return (
    <PapanDapur
      awal={tiket}
      cafeId={ctx.cafe_id ?? ""}
      namaKafe={ctx.cafe_name ?? ""}
      bingkai="mandiri"
    />
  );
}
