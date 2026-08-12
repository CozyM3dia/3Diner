
/** Common QRIS payer apps shown on the customer payment screen. The QR itself
 *  remains one dynamic QRIS transaction, regardless of the app used to scan it. */
export const QRIS_SUPPORTED_APPS = [
  "GoPay", "OVO", "DANA", "ShopeePay", "m-banking",
] as const;

/** Every value the Orders.payment_method CHECK constraint accepts. */
export const PAYMENT_METHODS = [
  "cash", "qris", "gopay", "shopeepay", "bank_transfer",
] as const;

/** Midtrans reports the channel a customer actually used as `payment_type`.
 *  Several bank flavours collapse to one stored `bank_transfer`; anything we do
 *  not recognise is stored as `qris` (the universal default) rather than a value
 *  the CHECK constraint would reject. */
export function mapMidtransPaymentType(paymentType: string): string {
  switch (paymentType) {
    case "gopay": return "gopay";
    case "shopeepay": return "shopeepay";
    case "bank_transfer":
    case "echannel": return "bank_transfer";
    case "qris": return "qris";
    default: return "qris";
  }
}

/** Human-readable labels for Orders.payment_method, shared across kasir/dashboard UI. */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Tunai", qris: "QRIS", gopay: "GoPay", shopeepay: "ShopeePay", bank_transfer: "Transfer Bank",
};

export function paymentMethodLabel(method: string | null): string {
  return method ? (PAYMENT_METHOD_LABEL[method] ?? method) : "Belum dipilih";
}
