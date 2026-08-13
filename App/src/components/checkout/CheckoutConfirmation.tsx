import type { OrderQuote } from "@/types";
import { formatRupiah } from "@/lib/format";
import { QuotedOrderLine } from "./CheckoutOrderLine";

type PaymentChannel = "online" | "cashier";

type CheckoutConfirmationProps = {
  quote: OrderQuote;
  channel: PaymentChannel;
  onChannelChange: (channel: PaymentChannel) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
};

export function CheckoutConfirmation({ quote, channel, onChannelChange, headingRef }: CheckoutConfirmationProps) {
  return (
    <section aria-labelledby="confirmation-heading" className="checkout-confirmation">
      <h2 id="confirmation-heading" ref={headingRef} tabIndex={-1}>Konfirmasi & bayar</h2>
      <p className="checkout-confirmation-copy">Total ini dihitung kembali dari menu dan pilihan yang tersedia saat ini.</p>

      <div className="checkout-confirmation-surface">
        <div className="checkout-quoted-list">
          {quote.items.map((item) => <QuotedOrderLine key={`${item.id_menu}:${item.options?.map((option) => option.id_option_value).join(",") ?? ""}`} item={item} />)}
        </div>
        <dl className="checkout-price-breakdown">
          <div><dt>Subtotal</dt><dd>{formatRupiah(quote.subtotal)}</dd></div>
          <div><dt>Layanan ({quote.service_pct}%)</dt><dd>{formatRupiah(quote.service_amount)}</dd></div>
          <div><dt>Pajak ({quote.tax_pct}%)</dt><dd>{formatRupiah(quote.tax_amount)}</dd></div>
          <div className="checkout-canonical-total"><dt>Total</dt><dd>{formatRupiah(quote.total)}</dd></div>
        </dl>

        <fieldset className="checkout-payment-options">
          <legend>Metode pembayaran</legend>
          <label>
            <input type="radio" name="payment-channel" value="online" checked={channel === "online"} onChange={() => onChannelChange("online")} />
            <span><b>QRIS</b><small>Bayar setelah QRIS ditampilkan</small></span>
          </label>
          <label>
            <input type="radio" name="payment-channel" value="cashier" checked={channel === "cashier"} onChange={() => onChannelChange("cashier")} />
            <span><b>Bayar di kasir</b><small>Tunjukkan kode pesanan ke kasir</small></span>
          </label>
        </fieldset>
      </div>
    </section>
  );
}
