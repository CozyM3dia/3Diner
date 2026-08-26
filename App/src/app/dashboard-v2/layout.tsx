import { getStaffContext } from "@/lib/staff-context";
import { canOpenOwnerConsole } from "@/lib/staff-context";
import DpShell from "@/components/dp/Shell";
import "../dp.css";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard — 3Diner",
};

/** Konsol owner (recreation Dream POS). Gate identik pola sebelumnya:
 *  belum login → /login, bukan owner → /kasir. */
export default async function DashboardV2Layout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();
  if (!ctx.role) redirect("/login");
  if (!canOpenOwnerConsole(ctx.role)) redirect("/kasir");

  return (
    <DpShell
      cafeName={ctx.cafe_name ?? "Kafe kamu"}
      userInitial={(ctx.full_name ?? "O").slice(0, 1).toUpperCase()}
      userName={ctx.full_name ?? ""}
    >
      {children}
    </DpShell>
  );
}
