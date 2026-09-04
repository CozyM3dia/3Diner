import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";
import { redirect } from "next/navigation";
import OrdersBoard, { type BoardOrder, type BoardCafe } from "@/components/dp/OrdersBoard";
import "../../pesanan.css";

export const metadata = { title: "Pesanan · 3Diner" };

export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const cafeId = ctx.cafe_id ?? "";
  const since30 = new Date(new Date(startOfTodayWIB()).getTime() - 29 * 864e5).toISOString();

  const [{ data }, cafeRes] = await Promise.all([
    supabaseAdmin
      .from("Orders")
      // Rincian harga ikut dibaca: panel detail memecah Subtotal / Service /
      // Pajak apa adanya dari potret pesanan, bukan menghitung ulang di
      // browser — tarif bisa sudah berubah sejak pesanan dibuat.
      .select("id_order,total,subtotal,tax_pct,tax_amount,service_pct,service_amount,prices_include_tax,status,payment_status,payment_method,table_number,items,notes,cancelled_reason,created_at")
      .eq("cafe_id", cafeId)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("Cafes")
      .select("nama_cafe,alamat_cafe,logo_url,tax_configured_at,receipt_settings")
      .eq("id_cafe", cafeId)
      .single(),
  ]);

  const orders: BoardOrder[] = (data ?? []).map(o => ({
    id_order: o.id_order,
    created_at: o.created_at,
    status: o.status ?? "awaiting",
    payment_status: o.payment_status ?? "unpaid",
    payment_method: o.payment_method ?? null,
    table_number: o.table_number,
    total: o.total,
    subtotal: o.subtotal ?? null,
    tax_pct: o.tax_pct ?? null,
    tax_amount: o.tax_amount ?? null,
    service_pct: o.service_pct ?? null,
    service_amount: o.service_amount ?? null,
    prices_include_tax: o.prices_include_tax ?? null,
    items: o.items ?? [],
    notes: o.notes ?? null,
    cancelled_reason: o.cancelled_reason ?? null,
  }));

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
