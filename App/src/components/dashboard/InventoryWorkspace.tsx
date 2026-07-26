import Link from "next/link";
import { AlertTriangle, Boxes, CircleAlert, PackageX, Wallet } from "lucide-react";
import InventoryTable from "@/components/dashboard/InventoryTable";
import { DashboardMetric } from "@/components/dashboard/system";
import { criticalInventoryItems, type InventorySummary as InventorySummaryType } from "@/lib/dashboard-inventory";
import { formatQty } from "@/lib/inventory";
import type { InventoryItem, InventoryMovement } from "@/types";

interface InventoryWorkspaceProps {
  items: InventoryItem[];
  movements: InventoryMovement[];
  summary: InventorySummaryType;
  failedLoads?: string[];
  embedded?: boolean;
}

export default function InventoryWorkspace({
  items,
  movements,
  summary,
  failedLoads = [],
  embedded = false,
}: InventoryWorkspaceProps) {
  if (failedLoads.length > 0) {
    return <InventoryLoadError failedLoads={failedLoads} embedded={embedded} />;
  }

  const critical = criticalInventoryItems(items);

  return (
    <section className={embedded ? "dash-reveal dash-d5" : undefined} aria-labelledby="inventory-workspace-title">
      <div className={embedded ? "mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between" : "mb-7 dash-reveal"}>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dash-muted)" }}>
            Operasional Stok
          </p>
          <h1
            id="inventory-workspace-title"
            className={embedded ? "font-display text-xl font-bold" : "font-display text-2xl font-bold"}
            style={{ color: "#E9EEF6" }}
          >
            Inventory
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#9FB6D1" }}>
            Kelola bahan, stok minimum, dan riwayat mutasi dari dashboard yang sama.
          </p>
        </div>

        {embedded && (
          <Link
            href="/dashboard/inventory"
            className="dash-btn inline-flex w-fit items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold"
            style={{ background: "#132136", color: "#E9EEF6", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            Buka fokus inventory
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4">
        <DashboardMetric value={summary.total} label="Total Bahan" icon={<Boxes size={15} strokeWidth={2} />} accent="#FD5002" accentBg="rgba(253,80,2,0.12)" />
        <DashboardMetric value={summary.low} label="Stok Menipis" icon={<AlertTriangle size={15} strokeWidth={2} />} accent="#F59E0B" accentBg="rgba(245,158,11,0.12)" />
        <DashboardMetric value={summary.empty} label="Stok Habis" icon={<PackageX size={15} strokeWidth={2} />} accent="#EF4444" accentBg="rgba(239,68,68,0.12)" />
        <DashboardMetric value={summary.value} prefix="Rp " label="Nilai Stok" icon={<Wallet size={15} strokeWidth={2} />} accent="#22D3A6" accentBg="rgba(34,211,166,0.12)" />
      </div>

      {embedded && critical.length > 0 && (
        <div
          className="mb-5 rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg, rgba(253,80,2,0.14), rgba(13,24,41,0.92))", border: "1px solid rgba(253,80,2,0.22)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" style={{ color: "#F59E0B" }} />
            <h2 className="text-sm font-bold" style={{ color: "#E9EEF6" }}>
              Bahan perlu dicek hari ini
            </h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {critical.map((item) => (
              <div key={item.id_inventory_item} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(6,14,27,0.5)" }}>
                <p className="truncate text-sm font-semibold" style={{ color: "#E9EEF6" }} title={item.name}>
                  {item.name}
                </p>
                <p className="mt-1 text-xs tabular-nums" style={{ color: item.current_qty <= 0 ? "#FCA5A5" : "#F59E0B" }}>
                  {formatQty(item.current_qty, item.unit)} tersisa, minimum {formatQty(item.minimum_qty, item.unit)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <InventoryTable items={items} movements={movements} />
    </section>
  );
}

function InventoryLoadError({ failedLoads, embedded }: { failedLoads: string[]; embedded: boolean }) {
  return (
    <section className={embedded ? "dash-reveal dash-d5" : "max-w-[1180px] mx-auto p-5 lg:p-8"} aria-labelledby="inventory-load-error-title">
      {!embedded && (
        <div className="mb-7 dash-reveal">
          <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>Inventory</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--dash-muted)" }}>Kelola bahan, stok minimum, dan riwayat mutasi.</p>
        </div>
      )}
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl px-5 py-12 text-center" style={{ background: "#0D1829", border: "1px solid rgba(239,68,68,0.28)" }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
          <CircleAlert size={23} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h2 id="inventory-load-error-title" className="mt-4 font-semibold" style={{ color: "#E9EEF6" }}>Inventory belum dapat dimuat</h2>
        <p className="mt-1 max-w-md text-sm" style={{ color: "#9FB6D1" }}>
          Terjadi kendala saat memuat {failedLoads.join(" dan ")}. Coba muat ulang halaman.
        </p>
      </div>
    </section>
  );
}
