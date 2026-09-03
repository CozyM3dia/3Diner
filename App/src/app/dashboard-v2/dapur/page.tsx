import { redirect } from "next/navigation";
import { canOpenOwnerConsole, getStaffContext } from "@/lib/staff-context";
import { ambilTiketDapur } from "@/lib/kitchen-query";
import PapanDapur from "@/components/kitchen/PapanDapur";
import KitchenThemeSync from "@/components/kitchen/KitchenThemeSync";
import "../../kitchen.css";

export const metadata = { title: "Dapur · 3Diner" };
export const dynamic = "force-dynamic";

/** Papan dapur di dalam konsol pemilik.
 *
 *  Papan yang sama persis dengan /dapur, tapi berbingkai Shell dashboard-v2
 *  sehingga pemilik/manager bisa mengawasi antrean lalu pindah ke modul lain
 *  lewat sidebar. Bar pass melepas tombol keluar dan toggle tema di sini —
 *  keduanya sudah ada di Shell, dan dua pintu keluar bersebelahan hanya
 *  membuat orang ragu mana yang benar.
 *
 *  Guard: owner & manager. Staf kitchen tetap dilayani /dapur. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const tiket = await ambilTiketDapur(ctx.cafe_id ?? "");

  return (
    <>
      <KitchenThemeSync mode="console" />
      <PapanDapur
        awal={tiket}
        cafeId={ctx.cafe_id ?? ""}
        namaKafe={ctx.cafe_name ?? ""}
        bingkai="konsol"
      />
    </>
  );
}
