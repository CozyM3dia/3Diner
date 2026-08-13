import type { OrderQuote } from "@/types";
import { formatRupiah } from "@/lib/format";
import { Check, QrCode, Wallet } from "lucide-react";
import { QuotedOrderLine } from "./CheckoutOrderLine";

type PaymentChannel = "online" | "cashier";

type CheckoutConfirmationProps = {
  quote: OrderQuote;
  imageUrlsByMenuId: ReadonlyMap<string, string | null | undefined>;
  channel: PaymentChannel;
  onChannelChange: (channel: PaymentChannel) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
};

export function CheckoutConfirmation({ quote, imageUrlsByMenuId, channel, onChannelChange, headingRef }: CheckoutConfirmationProps) {
  return (
    <section aria-labelledby="confirmation-heading" className="checkout-confirmation">
      <h2 id="confirmation-heading" ref={headingRef} tabIndex={-1}>Konfirmasi & bayar</h2>
      <p className="checkout-confirmation-copy">Total ini dihitung kembali dari menu dan pilihan yang tersedia saat ini.</p>

      <div className="checkout-confirmation-surface">
        <div className="checkout-quoted-list">
          {quote.items.map((item) => <QuotedOrderLine key={`${item.id_menu}:${item.options?.map((option) => option.id_option_value).join(",") ?? ""}`} item={item} imageUrl={imageUrlsByMenuId.get(item.id_menu)} />)}
        </div>
        <dl className="checkout-price-breakdown">
          <div><dt>Subtotal</dt><dd>{formatRupiah(quote.subtotal)}</dd></div>
          <div><dt>Layanan ({quote.service_pct}%)</dt><dd>{formatRupiah(quote.service_amount)}</dd></div>
          <div><dt>Pajak ({quote.tax_pct}%)</dt><dd>{formatRupiah(quote.tax_amount)}</dd></div>
          <div className="checkout-canonical-total"><dt>Total</dt><dd>{formatRupiah(quote.total)}</dd></div>
        </dl>

        <fieldset className="checkout-payment-options">
          <legend>Metode pembayaran</legend>
          <label className={`checkout-payment-tile${channel === "online" ? " checkout-payment-tile--selected" : ""}`} data-selected={channel === "online"}>
            <input type="radio" name="payment-channel" value="online" checked={channel === "online"} onChange={() => onChannelChange("online")} />
            <span className="checkout-payment-tile-icon" aria-hidden="true"><QrCode size={28} strokeWidth={2.25} /></span>
            <span className="checkout-payment-tile-copy"><b>QRIS</b><small>Bayar setelah QRIS ditampilkan</small></span>
            <span className="checkout-payment-tile-check" aria-hidden="true"><Check size={15} strokeWidth={3} /></span>
          </label>
          <label className={`checkout-payment-tile${channel === "cashier" ? " checkout-payment-tile--selected" : ""}`} data-selected={channel === "cashier"}>
            <input type="radio" name="payment-channel" value="cashier" checked={channel === "cashier"} onChange={() => onChannelChange("cashier")} />
            <span className="checkout-payment-tile-icon" aria-hidden="true"><Wallet size={28} strokeWidth={2.25} /></span>
            <span className="checkout-payment-tile-copy"><b>Bayar di kasir</b><small>Tunjukkan kode pesanan ke kasir</small></span>
            <span className="checkout-payment-tile-check" aria-hidden="true"><Check size={15} strokeWidth={3} /></span>
          </label>
        </fieldset>
      </div>
    </section>
  );
}
