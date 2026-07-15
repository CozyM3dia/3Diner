"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties, type RefObject } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { adjustInventoryStock } from "@/lib/dashboard-actions";
import { formatQty } from "@/lib/inventory";
import type { InventoryItem } from "@/types";

const inputStyle: CSSProperties = {
  background: "#132136",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E9EEF6",
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.tabIndex >= 0 && element.getAttribute("aria-hidden") !== "true"
  );
}

export function useModalFocus(
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusSelector: string
) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    const focusInitial = () => {
      const preferred = dialog.querySelector<HTMLElement>(initialFocusSelector);
      (preferred ?? focusableElements(dialog)[0])?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusableElements(dialog);
      if (elements.length === 0) return;
      const activeIndex = elements.indexOf(document.activeElement as HTMLElement);
      const wrapsBackward = event.shiftKey && (activeIndex <= 0);
      const wrapsForward = !event.shiftKey && (activeIndex === -1 || activeIndex === elements.length - 1);
      if (!wrapsBackward && !wrapsForward) return;

      event.preventDefault();
      elements[event.shiftKey ? elements.length - 1 : 0].focus();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusInitial();
    };

    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(focusInitial);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [dialogRef, initialFocusSelector, onClose]);
}

export default function StockAdjustmentModal({
  item,
  onClose,
  onDone,
}: {
  item: InventoryItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLElement | null>(null);

  useModalFocus(dialogRef, onClose, "input[name='quantity']");

  function submit(fd: FormData) {
    setError("");
    startTransition(async () => {
      const result = await adjustInventoryStock(item.id_inventory_item, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" style={{ background: "rgba(0,0,0,0.7)" }} onMouseDown={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-adjustment-title"
        aria-describedby="stock-adjustment-description"
        className="my-auto w-full max-w-md rounded-2xl p-5"
        style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.1)" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="stock-adjustment-title" className="font-display text-lg font-bold" style={{ color: "#E9EEF6" }}>
              Atur Stok
            </h2>
            <p id="stock-adjustment-description" className="mt-1 text-sm" style={{ color: "#5A7898" }}>
              {item.name}. Stok sekarang {formatQty(item.current_qty, item.unit)}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="dash-icon-btn shrink-0 rounded-lg p-1.5" style={{ color: "#5A7898" }} aria-label="Tutup pengaturan stok" title="Tutup">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <form action={submit} className="space-y-4" aria-busy={pending}>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Jenis Penyesuaian</span>
            <select name="mode" defaultValue="add" className="dash-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle}>
              <option value="add">Tambah stok</option>
              <option value="subtract">Kurangi stok</option>
              <option value="set">Set jumlah persis</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Jumlah</span>
            <input name="quantity" required autoFocus type="number" min="0" step="0.001" inputMode="decimal" className="dash-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle} placeholder={`Jumlah (${item.unit})`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Catatan</span>
            <textarea name="note" rows={3} className="dash-input w-full resize-none rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle} placeholder="Catatan penyesuaian" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="dash-press rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ color: "#9FB6D1", border: "1px solid rgba(255,255,255,0.1)" }}>
              Batal
            </button>
            <button disabled={pending} className="dash-btn inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed" style={{ background: "#FD5002", opacity: pending ? 0.7 : 1 }}>
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {pending ? "Menyimpan" : "Simpan"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
