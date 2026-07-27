import { redirect } from "next/navigation";
import { canOpenCashierConsole, getStaffContext } from "@/lib/staff-context";

export const metadata = {
  title: "Kasir · 3Diner",
};

/** Konsol Kasir adalah permukaan tersendiri, bukan rute di dalam dashboard.
 *
 *  Pemisahannya fisik: tidak ada nav pemilik di sini, jadi tidak perlu ada
 *  gembok yang menyembunyikan menu. Gembok di dalam satu shell justru mengundang
 *  percobaan; permukaan terpisah tidak. */
export default async function KasirLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();

  if (!ctx.role) {
    // Terautentikasi tapi bukan staf kafe mana pun. Itu bukan kegagalan sistem,
    // jadi bukan halaman error — orangnya cuma tidak punya tujuan di sini.
    redirect("/login?alasan=bukan-staf");
  }

  if (!canOpenCashierConsole(ctx.role)) redirect("/dashboard");

  return <div className="kasir-root">{children}</div>;
}
