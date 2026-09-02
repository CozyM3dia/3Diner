import { redirect } from "next/navigation";
import { canOpenKitchenConsole, getStaffContext } from "@/lib/staff-context";
import { homeRouteForRole } from "@/types";
import { SKRIP_TEMA_DAPUR } from "@/lib/kitchen-theme";
import "../kitchen.css";

export const metadata = {
  title: "Dapur · 3Diner",
};

export const dynamic = "force-dynamic";

/** Papan Dapur (KDS) adalah permukaan tersendiri, sejajar Konsol Kasir:
 *  tanpa nav pemilik, tanpa gembok yang menyembunyikan menu. Staf berperan
 *  kitchen dibawa ke sini langsung setelah login (homeRouteForRole).
 *
 *  Guard: kitchen & owner boleh; cashier & lainnya dibawa ke tujuan wajarnya
 *  masing-masing — redirect ke homeRouteForRole, BUKAN /dashboard, supaya
 *  cashier yang salah alamat tidak berputar tanpa henti (layout owner
 *  melemparnya balik ke /kasir). */
export default async function DapurLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();

  if (!ctx.role) {
    redirect("/login?alasan=bukan-staf");
  }

  if (!canOpenKitchenConsole(ctx.role)) {
    redirect(homeRouteForRole(ctx.role) ?? "/login?alasan=bukan-staf");
  }

  return (
    <>
      {/* Tema papan harus terpasang sebelum paint pertama. Layar dapur menyala
          gelap secara bawaan; kilatan putih setengah detik di ruangan yang
          remang bukan cuma jelek, ia menyilaukan orang yang sedang memegang
          wajan panas. */}
      <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA_DAPUR }} />
      {children}
    </>
  );
}
