import { LoaderCircle } from "lucide-react";
import { formatRupiah } from "@/lib/format";

type PaymentChannel = "online" | "cashier";

type CheckoutCommitBarProps = {
  stage: "review" | "confirmation";
  itemCount: number;
  subtotal: number;
  table: string;
  total?: number;
  channel: PaymentChannel;
  isSubmitting: boolean;
  continueLabel?: string;
  onContinue: () => void;
  onEdit: () => void;
  onSubmit: () => void;
};

export function CheckoutCommitBar({
  stage,
  itemCount,
  subtotal,
  table,
  total,
  channel,
  isSubmitting,
  continueLabel = "Lanjut",
  onContinue,
  onEdit,
  onSubmit,
}: CheckoutCommitBarProps) {
  if (stage === "review") {
    return (
      <aside className="checkout-commit-bar" aria-label="Lanjutkan checkout">
        <div><span>{itemCount} item · Subtotal</span><strong>{formatRupiah(subtotal)}</strong></div>
        <button type="button" className="checkout-primary-action" onClick={onContinue}>{continueLabel}</button>
      </aside>
    );
  }

  const label = channel === "online" ? "Kirim & tampilkan QRIS" : "Kirim & tampilkan kode kasir";
  return (
    <aside className="checkout-commit-bar" aria-label="Kirim pesanan">
      <div><span>Meja {table}</span><strong>{formatRupiah(total ?? 0)}</strong></div>
      <div className="checkout-commit-actions">
        <button type="button" className="checkout-edit-action" disabled={isSubmitting} onClick={onEdit}>Edit pesanan</button>
        <button type="button" className="checkout-primary-action" disabled={isSubmitting} onClick={onSubmit}>
          {isSubmitting ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? "Mengirim pesanan..." : label}
        </button>
      </div>
    </aside>
  );
}
