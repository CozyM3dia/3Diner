import { describe, expect, it } from "vitest";
import {
  ONLINE_ENABLED_PAYMENTS,
  PAYMENT_METHODS,
  mapMidtransPaymentType,
} from "@/lib/payment-methods";

describe("payment-methods", () => {
  it("enables the approved Snap channels", () => {
    expect(ONLINE_ENABLED_PAYMENTS).toEqual([
      "qris", "gopay", "shopeepay", "bca_va", "bni_va", "bri_va", "permata_va", "echannel",
    ]);
  });

  it("maps Midtrans payment_type to a stored method", () => {
    expect(mapMidtransPaymentType("qris")).toBe("qris");
    expect(mapMidtransPaymentType("gopay")).toBe("gopay");
    expect(mapMidtransPaymentType("shopeepay")).toBe("shopeepay");
    expect(mapMidtransPaymentType("bank_transfer")).toBe("bank_transfer");
    expect(mapMidtransPaymentType("echannel")).toBe("bank_transfer");
    expect(mapMidtransPaymentType("something_new")).toBe("qris");
  });

  it("only stores methods the DB constraint allows", () => {
    for (const t of ["qris", "gopay", "shopeepay", "bank_transfer", "echannel"]) {
      expect(PAYMENT_METHODS).toContain(mapMidtransPaymentType(t));
    }
    expect(PAYMENT_METHODS).toContain("cash");
  });
});
