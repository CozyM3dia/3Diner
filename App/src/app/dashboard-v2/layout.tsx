import { getStaffContext } from "@/lib/staff-context";
import { canOpenOwnerConsole } from "@/lib/staff-context";
import { getNotifications } from "@/lib/notifications";
import DpShell from "@/components/dp/Shell";
import "../dp.css";
import "@/components/pos/pos-item.css";
import "@/app/menu-editor.css";
import "../role-pill.css";
// Terakhir: lapisan konsol menuntun token --dp-* warisan ke palet baru,
// jadi ia harus menang atas dp.css dalam urutan kaskade.
import "../console.css";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard — 3Diner",
};

export const dynamic = "force-dynamic";

/** Konsol owner (recreation Dream POS). Gate identik pola sebelumnya:
 *  belum login → /login, bukan owner → /kasir. */
export default async function DashboardV2Layout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();
  // Terautentikasi tapi bukan staf kafe mana pun. `?alasan=` menahan proxy
  // melempar sesi ini balik ke konsol — tanpa itu /login dan /dashboard-v2
  // saling mengoper dan halamannya tidak pernah berhenti.
  if (!ctx.role) redirect("/login?alasan=bukan-staf");
  if (!canOpenOwnerConsole(ctx.role)) redirect("/kasir");

  const notif = ctx.cafe_id ? await getNotifications(ctx.cafe_id) : { rows: [], unread: 0, unreadByType: { order: 0, kitchen: 0, inbox: 0 } };

  return (
    <DpShell
      cafeName={ctx.cafe_name ?? "Kafe kamu"}
      userInitial={(ctx.full_name ?? "O").slice(0, 1).toUpperCase()}
      userName={ctx.full_name ?? ""}
      userRole={ctx.role === "owner" ? "Owner" : "Kasir"}
      notifRows={notif.rows}
    >
      {children}
    </DpShell>
  );
}
