import { redirect } from "next/navigation";
import { canOpenKitchenConsole, getStaffContext } from "@/lib/staff-context";
import { homeRouteForRole } from "@/types";
import KitchenThemeSync from "@/components/kitchen/KitchenThemeSync";
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
      <KitchenThemeSync mode="standalone" />
      {children}
    </>
  );
}
