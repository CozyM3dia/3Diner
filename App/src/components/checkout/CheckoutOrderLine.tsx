import { Minus, Plus } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { CartItem, OrderItem } from "@/types";

type EditableOrderLineProps = {
  item: CartItem;
  onQuantityChange: (lineKey: string, quantity: number) => void;
};

export function EditableOrderLine({ item, onQuantityChange }: EditableOrderLineProps) {
  return (
    <article className="checkout-order-line">
      <div className="checkout-item-thumb" aria-hidden="true">{item.nama_menu.slice(0, 1)}</div>
      <div className="checkout-line-copy">
        <h3>{item.nama_menu}</h3>
        {item.options?.length ? <p>{item.options.map((option) => option.name).join(" · ")}</p> : null}
        {item.notes ? <p>Catatan: {item.notes}</p> : null}
        <strong>{formatRupiah(item.harga_menu)}</strong>
      </div>
      <div className="checkout-quantity" aria-label={`Jumlah ${item.nama_menu}`}>
        <button type="button" onClick={() => onQuantityChange(item.line_key, item.qty - 1)} aria-label={`Kurangi ${item.nama_menu}`}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <span aria-label={`${item.qty} ${item.nama_menu}`}>{item.qty}</span>
        <button type="button" onClick={() => onQuantityChange(item.line_key, item.qty + 1)} aria-label={`Tambah ${item.nama_menu}`}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export function QuotedOrderLine({ item }: { item: OrderItem }) {
  return (
    <div className="checkout-quoted-line">
      <div>
        <p>{item.qty}× {item.nama_menu}</p>
        {item.options?.length ? <span>{item.options.map((option) => option.name).join(" · ")}</span> : null}
      </div>
      <strong>{formatRupiah(item.harga_menu * item.qty)}</strong>
    </div>
  );
}
