"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CheckCircle2,
  Equal,
  PackagePlus,
  PackageSearch,
  Pencil,
  Plus,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import InventoryItemForm from "@/components/dashboard/InventoryItemForm";
import StockAdjustmentModal from "@/components/dashboard/StockAdjustmentModal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getDashPortal } from "@/components/dashboard/system";
import { createInventoryItem, updateInventoryItem } from "@/lib/dashboard-actions";
import { formatRupiah } from "@/lib/format";
import { formatQty, inventoryStatus } from "@/lib/inventory";
import type { InventoryItem, InventoryMovement, InventoryMovementType } from "@/types";

type ModalState =
  | { type: "create" }
  | { type: "edit"; item: InventoryItem }
  | { type: "adjust"; item: InventoryItem }
  | null;

type InventoryAction = "create" | "edit" | "adjust";

const STATUS = {
  safe: { label: "Aman", color: "#22D3A6", bg: "rgba(34,211,166,0.12)", icon: CheckCircle2 },
  low: { label: "Menipis", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: TriangleAlert },
  empty: { label: "Habis", color: "#EF4444", bg: "rgba(239,68,68,0.12)", icon: XCircle },
} as const;

const movementDate = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function movementTypeLabel(type: InventoryMovementType): string {
  switch (type) {
    case "manual_add":
      return "Tambah stok";
    case "manual_subtract":
      return "Kurangi stok";
    case "manual_set":
      return "Set stok";
    case "order_deduction":
      return "Pengurangan pesanan";
  }
}

export function tableHorizontalScrollDelta(key: string): number {
  if (key === "ArrowLeft") return -240;
  if (key === "ArrowRight") return 240;
  return 0;
}

export function inventoryActionMessage(action: InventoryAction, itemName: string): string {
  if (action === "create") return `${itemName} berhasil ditambahkan ke inventory.`;
  if (action === "edit") return `${itemName} berhasil diperbarui.`;
  return `Stok ${itemName} berhasil disesuaikan.`;
}

function movementIcon(type: InventoryMovementType) {
  if (type === "manual_add") return ArrowUpFromLine;
  if (type === "manual_set") return Equal;
  return ArrowDownToLine;
}

export default function InventoryTable({ items, movements }: { items: InventoryItem[]; movements: InventoryMovement[] }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState("");
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    restoreFocus();
  }, [restoreFocus]);

  const finishAction = useCallback((action: InventoryAction, itemName: string) => {
    closeModal();
    setNotice(inventoryActionMessage(action, itemName));
    router.refresh();
  }, [closeModal, router]);

  const openModal = useCallback((next: Exclude<ModalState, null>, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setModal(next);
  }, []);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {notice}
      </div>

      {notice && (
        <div className="fixed right-4 top-4 z-50 flex max-w-sm items-start gap-2 rounded-xl px-3.5 py-3 text-sm shadow-2xl" style={{ background: "#0D1829", border: "1px solid rgba(34,211,166,0.35)", color: "#E9EEF6" }}>
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "#22D3A6" }} aria-hidden="true" />
          <p className="min-w-0">{notice}</p>
          <button type="button" onClick={() => setNotice("")} className="dash-icon-btn -mr-1 rounded-lg p-1" style={{ color: "#9FB6D1" }} aria-label="Tutup pesan inventory" title="Tutup">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {modal?.type === "adjust" && <StockAdjustmentModal item={modal.item} onClose={closeModal} onDone={(itemName) => finishAction("adjust", itemName)} />}
      {modal && modal.type !== "adjust" && (
        <InventoryDialog title={modal.type === "create" ? "Tambah Bahan" : "Ubah Bahan"} onClose={closeModal}>
          <InventoryItemForm
            item={modal.type === "edit" ? modal.item : undefined}
            onSave={modal.type === "create" ? createInventoryItem : (fd) => updateInventoryItem(modal.item.id_inventory_item, fd)}
            onDone={(itemName) => finishAction(modal.type, itemName)}
          />
        </InventoryDialog>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="dash-reveal dash-d1 overflow-hidden rounded-2xl" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }} aria-labelledby="inventory-list-title">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="min-w-0">
              <h2 id="inventory-list-title" className="text-sm font-bold" style={{ color: "#E9EEF6" }}>Daftar Bahan</h2>
              <p className="mt-0.5 text-xs" style={{ color: "var(--dash-muted)" }}>{items.length} bahan terdaftar</p>
            </div>
            <button onClick={(event) => openModal({ type: "create" }, event.currentTarget)} className="dash-btn inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold text-white" style={{ background: "#FD5002" }}>
              <Plus size={15} aria-hidden="true" />
              Tambah Bahan
            </button>
          </div>

          {items.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-5 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "#132136", color: "var(--dash-muted)" }}>
                <PackageSearch size={23} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <p className="mt-4 font-semibold" style={{ color: "#E9EEF6" }}>Belum ada bahan</p>
              <p className="mt-1 max-w-xs text-sm" style={{ color: "var(--dash-muted)" }}>Tambahkan bahan pertama untuk mulai memantau stok kafe.</p>
              <button onClick={(event) => openModal({ type: "create" }, event.currentTarget)} className="dash-btn mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "#FD5002" }}>
                <Plus size={15} aria-hidden="true" />
                Tambah Bahan
              </button>
            </div>
          ) : (
            <>
              <div id="inventory-table-scroll-hint" className="flex items-center gap-2 px-4 py-2 text-xs" style={{ color: "#9FB6D1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <ArrowLeftRight size={14} aria-hidden="true" />
                Geser tabel atau gunakan tombol panah untuk melihat kolom lain.
              </div>
              <div
                className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FD5002]"
                role="region"
                tabIndex={0}
                aria-label="Tabel inventaris"
                aria-describedby="inventory-table-scroll-hint"
                onKeyDown={(event) => {
                  const delta = tableHorizontalScrollDelta(event.key);
                  if (delta === 0) return;
                  event.preventDefault();
                  event.currentTarget.scrollBy({ left: delta, behavior: "auto" });
                }}
              >
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {['Bahan', 'Stok', 'Minimum', 'Harga / Unit', 'Status', 'Aksi'].map((heading, index) => (
                      <th key={heading} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${index === 5 ? 'text-right' : 'text-left'}`} style={{ color: "var(--dash-muted)" }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const status = inventoryStatus(item);
                    const meta = STATUS[status];
                    const StatusIcon = meta.icon;
                    return (
                      <tr key={item.id_inventory_item} className="dash-row" style={{ borderBottom: index < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        <td className="max-w-[230px] px-4 py-3.5">
                          <p className="truncate text-sm font-semibold" style={{ color: "#E9EEF6" }} title={item.name}>{item.name}</p>
                          {item.notes && <p className="mt-0.5 truncate text-xs" style={{ color: "var(--dash-muted)" }} title={item.notes}>{item.notes}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-sm font-semibold tabular-nums" style={{ color: "#E9EEF6" }}>{formatQty(item.current_qty, item.unit)}</td>
                        <td className="px-4 py-3.5 text-sm tabular-nums" style={{ color: "#9FB6D1" }}>{formatQty(item.minimum_qty, item.unit)}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold tabular-nums" style={{ color: "#E9EEF6" }}>{formatRupiah(item.estimated_unit_cost)}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>
                            <StatusIcon size={13} aria-hidden="true" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button onClick={(event) => openModal({ type: "adjust", item }, event.currentTarget)} className="dash-icon-btn dash-press rounded-lg p-2" style={{ background: "#132136", color: "#9FB6D1" }} aria-label={`Atur stok ${item.name}`} title="Atur stok">
                              <PackagePlus size={15} aria-hidden="true" />
                            </button>
                            <button onClick={(event) => openModal({ type: "edit", item }, event.currentTarget)} className="dash-icon-btn dash-press rounded-lg p-2" style={{ background: "#132136", color: "#9FB6D1" }} aria-label={`Ubah bahan ${item.name}`} title="Ubah bahan">
                              <Pencil size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </section>

        <aside className="dash-reveal dash-d2 overflow-hidden rounded-2xl" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }} aria-labelledby="movement-title">
          <div className="px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 id="movement-title" className="text-sm font-bold" style={{ color: "#E9EEF6" }}>Mutasi Terbaru</h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--dash-muted)" }}>12 aktivitas terakhir</p>
          </div>
          {movements.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 py-8 text-center">
              <PackageSearch size={22} style={{ color: "var(--dash-muted)" }} strokeWidth={1.5} aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold" style={{ color: "#E9EEF6" }}>Belum ada mutasi</p>
              <p className="mt-1 text-xs" style={{ color: "var(--dash-muted)" }}>Penyesuaian stok akan tercatat di sini.</p>
            </div>
          ) : (
            <ol className="divide-y divide-white/[0.05]">
              {movements.map((movement) => {
                const Icon = movementIcon(movement.movement_type);
                const amount = `${movement.delta_qty > 0 ? "+" : movement.delta_qty < 0 ? "-" : ""}${formatQty(Math.abs(movement.delta_qty), movement.unit)}`;
                return (
                  <li key={movement.id_inventory_movement} className="flex gap-3 px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "#132136", color: "#9FB6D1" }}>
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-xs font-semibold" style={{ color: "#E9EEF6" }} title={movement.inventory_item?.name}>{movement.inventory_item?.name ?? "Bahan dihapus"}</p>
                        <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: movement.delta_qty < 0 ? "#FCA5A5" : "#22D3A6" }}>{amount}</span>
                      </div>
                      <p className="mt-0.5 text-[11px]" style={{ color: "var(--dash-muted)" }}>
                        {movementTypeLabel(movement.movement_type)}, <time dateTime={movement.created_at}>{movementDate.format(new Date(movement.created_at))}</time>
                      </p>
                      {movement.note && <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: "#9FB6D1" }}>{movement.note}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </>
  );
}

function InventoryDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        ref={contentRef}
        container={getDashPortal() ?? undefined}
        showCloseButton={false}
        className="sm:max-w-lg"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.querySelector<HTMLElement>("input[name='name']")?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between gap-4">
          <DialogTitle className="font-display text-lg font-bold" style={{ color: "var(--dash-text)" }}>{title}</DialogTitle>
          <button type="button" onClick={onClose} className="dash-icon-btn shrink-0 rounded-lg p-1.5" style={{ color: "var(--dash-muted)" }} aria-label="Tutup formulir bahan" title="Tutup">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
