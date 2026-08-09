
/** Channels shown inside the Midtrans Snap popup. DANA/OVO are reachable through
 *  the QRIS option — Snap has no direct OVO channel. */
export const ONLINE_ENABLED_PAYMENTS = [
  "qris", "gopay", "shopeepay", "bca_va", "bni_va", "bri_va", "permata_va", "echannel",
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
