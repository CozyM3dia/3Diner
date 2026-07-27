import { redirect } from "next/navigation";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { canOpenOwnerConsole, getStaffContext } from "@/lib/staff-context";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getDashboardCafeContext();
  if (!ctx.userId) redirect("/login");

  // Kasir yang membuka /dashboard dibawa ke konsolnya sendiri, bukan ditolak.
  // Peran yang null dibiarkan lewat: itu pemilik lama yang belum punya baris
  // Staff, dan pemeriksaan kepemilikan di bawah sudah menjaganya.
  const staff = await getStaffContext();
  if (staff.role && !canOpenOwnerConsole(staff.role)) redirect("/kasir");

  const cafe =
    ctx.slug && ctx.cafeName
      ? { nama_cafe: ctx.cafeName, logo_url: ctx.logoUrl, slug_url: ctx.slug }
      : null;

  return <DashboardShell cafe={cafe}>{children}</DashboardShell>;
}
