import { redirect } from "next/navigation";
import { AlertTriangle, Boxes, PackageX, Wallet, type LucideIcon } from "lucide-react";
import InventoryTable from "@/components/dashboard/InventoryTable";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InventoryItem, InventoryMovement } from "@/types";

export const dynamic = "force-dynamic";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null };

  const cafeId = cafe?.id_cafe as string | undefined;
  const [{ data: items }, { data: movements }] = cafeId
    ? await Promise.all([
        supabaseAdmin
          .from("Inventory_Items")
          .select("*")
          .eq("cafe_id", cafeId)
          .order("name", { ascending: true }),
        supabaseAdmin
          .from("Inventory_Movements")
          .select("*, inventory_item:Inventory_Items(name, unit)")
          .eq("cafe_id", cafeId)
          .order("created_at", { ascending: false })
          .limit(12),
      ])
    : [{ data: [] }, { data: [] }];

  const list = (items ?? []) as InventoryItem[];
  const recent = (movements ?? []) as InventoryMovement[];
  const low = list.filter((item) => item.current_qty > 0 && item.current_qty <= item.minimum_qty).length;
  const empty = list.filter((item) => item.current_qty <= 0).length;
  const value = list.reduce((sum, item) => sum + item.current_qty * item.estimated_unit_cost, 0);

  return (
    <div className="max-w-[1180px] mx-auto p-5 lg:p-8">
      <div className="mb-7 dash-reveal">
        <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>
          Inventory
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#5A7898" }}>
          Kelola bahan, stok minimum, dan riwayat mutasi.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
        <Summary icon={Boxes} label="Total Bahan" value={String(list.length)} />
        <Summary icon={AlertTriangle} label="Stok Menipis" value={String(low)} tone="#F59E0B" />
        <Summary icon={PackageX} label="Stok Habis" value={String(empty)} tone="#EF4444" />
        <Summary icon={Wallet} label="Nilai Stok" value={rupiah.format(value)} tone="#22D3A6" />
      </div>

      <InventoryTable items={list} movements={recent} />
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  tone = "#FD5002",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div
      className="dash-card rounded-2xl p-4"
      style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>
        <Icon size={14} style={{ color: tone }} aria-hidden="true" />
        {label}
      </div>
      <p className="mt-3 font-display text-xl font-bold tabular-nums truncate" style={{ color: "#E9EEF6" }} title={value}>
        {value}
      </p>
    </div>
  );
}
