import { redirect } from "next/navigation";
import { canOpenOwnerConsole, getStaffContext } from "@/lib/staff-context";
import { ambilTiketDapur } from "@/lib/kitchen-query";
import { SKRIP_TEMA_KONSOL } from "@/lib/kitchen-theme";
import PapanDapur from "@/components/kitchen/PapanDapur";
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
      {/* Papan mewarisi tema konsol lewat `data-kds`, disetel sebelum paint
          supaya panel gelap tidak berkedip di halaman yang terang. */}
      <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA_KONSOL }} />
      <PapanDapur
        awal={tiket}
        cafeId={ctx.cafe_id ?? ""}
        namaKafe={ctx.cafe_name ?? ""}
        bingkai="konsol"
      />
    </>
  );
}
