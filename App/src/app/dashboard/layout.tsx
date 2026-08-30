import { redirect } from "next/navigation";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { canOpenOwnerConsole, getStaffContext } from "@/lib/staff-context";
import { homeRouteForRole } from "@/types";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getDashboardCafeContext();
  if (!ctx.userId) redirect("/login");

  // Bukan owner dibawa ke konsol wajarnya masing-masing (kasir → /kasir,
  // kitchen → /dapur) — redirect ke homeRouteForRole, bukan rute hardcoded,
  // supaya tidak ada pasangan guard yang saling melempar tanpa henti.
  // Peran yang null dibiarkan lewat: itu pemilik lama yang belum punya baris
  // Staff, dan pemeriksaan kepemilikan di bawah sudah menjaganya.
  const staff = await getStaffContext();
  if (staff.role && !canOpenOwnerConsole(staff.role)) {
    redirect(homeRouteForRole(staff.role) ?? "/login?alasan=bukan-staf");
  }

  const cafe =
    ctx.slug && ctx.cafeName
      ? { nama_cafe: ctx.cafeName, logo_url: ctx.logoUrl, slug_url: ctx.slug }
      : null;

  return <DashboardShell cafe={cafe}>{children}</DashboardShell>;
}
