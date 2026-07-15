"use client";

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { INVENTORY_UNITS, type InventoryItem } from "@/types";
import type { ActionResult } from "@/lib/dashboard-actions";

const inputStyle: CSSProperties = {
  background: "#132136",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E9EEF6",
};

export default function InventoryItemForm({
  item,
  onSave,
  onDone,
}: {
  item?: InventoryItem;
  onSave: (fd: FormData) => Promise<ActionResult>;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    setError("");
    startTransition(async () => {
      const result = await onSave(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form action={submit} className="space-y-4" aria-busy={pending}>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      <Field label="Nama Bahan">
        <input
          name="name"
          required
          autoFocus
          defaultValue={item?.name ?? ""}
          className="dash-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
          style={inputStyle}
          placeholder="Sirup Lemon"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Satuan">
          <select name="unit" required defaultValue={item?.unit ?? "gram"} className="dash-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle}>
            {INVENTORY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Harga / Unit">
          <input name="estimated_unit_cost" type="number" min="0" step="1" inputMode="numeric" defaultValue={item?.estimated_unit_cost ?? 0} className="dash-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stok Saat Ini">
          <input name="current_qty" type="number" min="0" step="0.001" inputMode="decimal" defaultValue={item?.current_qty ?? 0} className="dash-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle} />
        </Field>
        <Field label="Batas Menipis">
          <input name="minimum_qty" type="number" min="0" step="0.001" inputMode="decimal" defaultValue={item?.minimum_qty ?? 0} className="dash-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle} />
        </Field>
      </div>
      <Field label="Catatan">
        <textarea name="notes" defaultValue={item?.notes ?? ""} rows={3} className="dash-input w-full resize-none rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle} />
      </Field>
      <button disabled={pending} className="dash-btn inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed" style={{ background: "#FD5002", opacity: pending ? 0.7 : 1 }}>
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
        {pending ? "Menyimpan" : "Simpan Bahan"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
