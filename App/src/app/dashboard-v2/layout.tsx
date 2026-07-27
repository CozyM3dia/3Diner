import { redirect } from "next/navigation";
import { canOpenOwnerConsole, getStaffContext } from "@/lib/staff-context";

export const metadata = {
  title: "Konsol Owner · 3Diner",
};

/** Konsol Owner v2 — dibangun BERDAMPINGAN dengan /dashboard, bukan menimpanya.
 *
 *  Dashboard lama tetap hidup dan tidak disentuh sampai tiap rute di sini
 *  terbukti memuat seluruh kontrak 564 fitur. Dua URL hidup bersamaan supaya
 *  perbandingannya bisa dilakukan dengan membuka dua tab, bukan dari ingatan. */
export default async function OwnerConsoleLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();

  if (!ctx.role) redirect("/login");
  if (!canOpenOwnerConsole(ctx.role)) redirect("/kasir");

  return <>{children}</>;
}
