import { redirect } from "next/navigation";
import { canOpenCashierConsole, getStaffContext } from "@/lib/staff-context";
import { homeRouteForRole } from "@/types";

export const metadata = {
  title: "Kasir · 3Diner",
};

export const dynamic = "force-dynamic";

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

  if (!canOpenCashierConsole(ctx.role)) {
    // Kitchen ditolak di sini: bawa dia ke /dapur (home-nya), bukan ke
    // /dashboard yang akan melempar balik — pola itulah yang memicu loop.
    redirect(homeRouteForRole(ctx.role) ?? "/login?alasan=bukan-staf");
  }

  return <div className="kasir-root">{children}</div>;
}
