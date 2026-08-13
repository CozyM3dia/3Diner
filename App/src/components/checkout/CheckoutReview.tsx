import Link from "next/link";
import { Plus } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { CartItem } from "@/types";
import { EditableOrderLine } from "./CheckoutOrderLine";

type CheckoutReviewProps = {
  items: CartItem[];
  table: string;
  notes: string;
  subtotal: number;
  tableInvalid: boolean;
  slug: string;
  onQuantityChange: (lineKey: string, quantity: number) => void;
  onTableChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onTableBlur: () => void;
};

export function CheckoutReview({
  items,
  table,
  notes,
  subtotal,
  tableInvalid,
  slug,
  onQuantityChange,
  onTableChange,
  onNotesChange,
  onTableBlur,
}: CheckoutReviewProps) {
  return (
    <section aria-labelledby="review-heading" className="checkout-review">
      <div className="checkout-intro">
        <p>Pesananmu</p>
        <h2 id="review-heading">Pesananmu</h2>
        <span>Atur jumlah, meja, dan catatan sebelum melanjutkan.</span>
      </div>

      <div className="checkout-line-list">
        {items.map((item) => <EditableOrderLine key={item.line_key} item={item} onQuantityChange={onQuantityChange} />)}
      </div>

      <Link href={`/${slug}`} className="checkout-add-more"><Plus size={16} aria-hidden="true" /> Tambah item lain</Link>

      <div className="checkout-fields">
        <div>
          <label htmlFor="meja">Nomor meja</label>
          <input
            id="meja"
            value={table}
            onChange={(event) => onTableChange(event.target.value)}
            onBlur={onTableBlur}
            inputMode="numeric"
            aria-invalid={tableInvalid}
            aria-describedby={tableInvalid ? "meja-error" : undefined}
            placeholder="Contoh: 12"
          />
          <p id={tableInvalid ? "meja-error" : undefined} role={tableInvalid ? "alert" : undefined}>
            {tableInvalid ? "Wajib diisi sebelum memesan" : "Wajib diisi"}
          </p>
        </div>
        <div>
          <label htmlFor="catatan">Catatan tambahan <span>(Opsional)</span></label>
          <textarea id="catatan" value={notes} onChange={(event) => onNotesChange(event.target.value)} rows={3} placeholder="Contoh: Sambal dipisah, tanpa es batu" />
        </div>
      </div>

      <div className="checkout-review-summary" aria-label="Ringkasan pesanan sementara">
        <span>Subtotal sementara</span>
        <strong>{formatRupiah(subtotal)}</strong>
        <p>Total akhir akan dikonfirmasi sebelum pesanan dikirim.</p>
      </div>
    </section>
  );
}
