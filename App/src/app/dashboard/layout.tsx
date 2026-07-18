import { redirect } from "next/navigation";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getDashboardCafeContext();
  if (!ctx.userId) redirect("/login");

  const cafe =
    ctx.slug && ctx.cafeName
      ? { nama_cafe: ctx.cafeName, logo_url: ctx.logoUrl, slug_url: ctx.slug }
      : null;

  return <DashboardShell cafe={cafe}>{children}</DashboardShell>;
}
