import { redirect } from "next/navigation";
import { AlertTriangle, Boxes, CircleAlert, PackageX, Wallet, type LucideIcon } from "lucide-react";
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
  const { data: cafe, error: cafeError } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null, error: null };

  const cafeId = cafe?.id_cafe as string | undefined;
  const [itemsResult, movementsResult] = cafeId
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
    : [{ data: [], error: null }, { data: [], error: null }];

  const failedLoads = [
    !slug || cafeError || !cafe ? "profil kafe" : null,
    itemsResult.error ? "data bahan" : null,
    movementsResult.error ? "riwayat mutasi" : null,
  ].filter((value): value is string => Boolean(value));

  if (failedLoads.length > 0) {
    return <InventoryLoadError failedLoads={failedLoads} />;
  }

  const list = (itemsResult.data ?? []) as InventoryItem[];
  const recent = (movementsResult.data ?? []) as InventoryMovement[];
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

function InventoryLoadError({ failedLoads }: { failedLoads: string[] }) {
  return (
    <div className="max-w-[1180px] mx-auto p-5 lg:p-8">
      <div className="mb-7 dash-reveal">
        <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>Inventory</h1>
        <p className="mt-1 text-sm" style={{ color: "#5A7898" }}>Kelola bahan, stok minimum, dan riwayat mutasi.</p>
      </div>
      <section className="dash-reveal dash-d1 flex min-h-72 flex-col items-center justify-center rounded-2xl px-5 py-12 text-center" style={{ background: "#0D1829", border: "1px solid rgba(239,68,68,0.28)" }} aria-labelledby="inventory-load-error-title">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
          <CircleAlert size={23} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h2 id="inventory-load-error-title" className="mt-4 font-semibold" style={{ color: "#E9EEF6" }}>Inventory belum dapat dimuat</h2>
        <p className="mt-1 max-w-md text-sm" style={{ color: "#9FB6D1" }}>
          Terjadi kendala saat memuat {failedLoads.join(" dan ")}. Coba muat ulang halaman.
        </p>
      </section>
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
