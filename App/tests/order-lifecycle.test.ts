import { describe, expect, it } from "vitest";
import {
  QRIS_SUPPORTED_APPS,
  PAYMENT_METHODS,
  mapMidtransPaymentType,
} from "@/lib/payment-methods";
import { needsCash, belongsInQueue } from "@/lib/kasir-queue-rules";

describe("payment-methods", () => {
  it("documents the payer apps supported by the QRIS screen", () => {
    expect(QRIS_SUPPORTED_APPS).toEqual(["GoPay", "OVO", "DANA", "ShopeePay", "m-banking"]);
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

describe("queue rules", () => {
  it("only asks the cashier for money on cash orders", () => {
    expect(needsCash({ payment_status: "unpaid", payment_method: "cash" })).toBe(true);
    expect(needsCash({ payment_status: "unpaid", payment_method: "gopay" })).toBe(false);
    expect(needsCash({ payment_status: "unpaid", payment_method: "qris" })).toBe(false);
    expect(needsCash({ payment_status: "paid", payment_method: "cash" })).toBe(false);
  });
  it("keeps awaiting orders out of the queue", () => {
    expect(belongsInQueue("awaiting")).toBe(false);
    expect(belongsInQueue("received")).toBe(true);
  });
});
