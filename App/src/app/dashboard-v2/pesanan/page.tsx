import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadConsoleOrders } from "@/lib/console-orders-query";
import { redirect } from "next/navigation";
import OrdersBoard, { type BoardCafe } from "@/components/dp/OrdersBoard";
import "../../pesanan.css";

export const metadata = { title: "Pesanan · 3Diner" };

export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const cafeId = ctx.cafe_id ?? "";
  const [orders, cafeRes] = await Promise.all([
    loadConsoleOrders(cafeId),
    supabaseAdmin
      .from("Cafes")
      .select("nama_cafe,alamat_cafe,logo_url,tax_configured_at,receipt_settings")
      .eq("id_cafe", cafeId)
      .single(),
  ]);

  if (cafeRes.error) throw new Error("Profil kafe gagal dimuat.");

  const c = cafeRes.data;
  const cafe: BoardCafe = {
    name: (c?.nama_cafe as string | null) ?? "Kafe",
    address: (c?.alamat_cafe as string | null) ?? null,
    logoUrl: (c?.logo_url as string | null) ?? null,
    taxConfigured: Boolean(c?.tax_configured_at),
    cashierName: ctx.full_name ?? "Kasir",
    receipt: (c?.receipt_settings as Record<string, unknown> | null) ?? null,
  };

  return (
    <>
      <OrdersBoard orders={orders} cafe={cafe} cafeId={cafeId} />
    </>
  );
}
