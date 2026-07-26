"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adjustInventoryStock } from "@/lib/dashboard-actions";
import { formatQty } from "@/lib/inventory";
import { dashInputClass, dashInputStyle, getDashPortal } from "@/components/dashboard/system";
import type { InventoryItem } from "@/types";

type AdjustmentMode = "add" | "subtract" | "set";

export function quantityMinForMode(mode: AdjustmentMode): "0" | "0.001" {
  return mode === "set" ? "0" : "0.001";
}

export default function StockAdjustmentModal({
  item,
  onClose,
  onDone,
}: {
  item: InventoryItem;
  onClose: () => void;
  onDone: (itemName: string) => void;
}) {
  const [error, setError] = useState("");
  const [mode, setMode] = useState<AdjustmentMode>("add");
  const [pending, startTransition] = useTransition();
  const contentRef = useRef<HTMLDivElement>(null);

  function submit(fd: FormData) {
    setError("");
    startTransition(async () => {
      const result = await adjustInventoryStock(item.id_inventory_item, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone(item.name);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        ref={contentRef}
        container={getDashPortal() ?? undefined}
        showCloseButton={false}
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.querySelector<HTMLElement>("input[name='quantity']")?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-start justify-between gap-4">
          <DialogHeader className="min-w-0">
            <DialogTitle className="font-display text-lg font-bold" style={{ color: "var(--dash-text)" }}>
              Atur Stok
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: "var(--dash-muted)" }}>
              {item.name}. Stok sekarang {formatQty(item.current_qty, item.unit)}.
            </DialogDescription>
          </DialogHeader>
          <button type="button" onClick={onClose} className="dash-icon-btn shrink-0 rounded-lg p-1.5" style={{ color: "var(--dash-muted)" }} aria-label="Tutup pengaturan stok" title="Tutup">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <form action={submit} className="space-y-4" aria-busy={pending}>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--dash-muted)" }}>Jenis Penyesuaian</span>
            <select
              name="mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as AdjustmentMode)}
              className={dashInputClass}
              style={dashInputStyle}
            >
              <option value="add">Tambah stok</option>
              <option value="subtract">Kurangi stok</option>
              <option value="set">Set jumlah persis</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--dash-muted)" }}>Jumlah</span>
            <input name="quantity" required type="number" min={quantityMinForMode(mode)} step="0.001" inputMode="decimal" className={dashInputClass} style={dashInputStyle} placeholder={`Jumlah (${item.unit})`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--dash-muted)" }}>Catatan</span>
            <textarea name="note" rows={3} className={`${dashInputClass} resize-none`} style={dashInputStyle} placeholder="Catatan penyesuaian" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="dash-press rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ color: "var(--dash-secondary)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Batal
            </button>
            <button disabled={pending} className="dash-btn inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold dash-on-accent disabled:cursor-not-allowed" style={{ background: "#FD5002", opacity: pending ? 0.7 : 1 }}>
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {pending ? "Menyimpan" : "Simpan"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
