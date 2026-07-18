import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  calculateOrderTotal,
  verifyMidtransSignature,
} from "../src/lib/order-validation";

describe("calculateOrderTotal", () => {
  it("uses the stored price and discount", () => {
    expect(
      calculateOrderTotal(
        [
          {
            id_menu: "menu-1",
            cafe_id: "cafe-1",
            nama_menu: "Nasi Goreng",
            harga_menu: 25_000,
            discount_pct: 20,
            is_active: true,
          },
        ],
        [{ id_menu: "menu-1", qty: 2 }]
      )
    ).toEqual([
      {
        id_menu: "menu-1",
        nama_menu: "Nasi Goreng",
        harga_menu: 20_000,
        qty: 2,
      },
    ]);
  });

  it("rejects unavailable menus and invalid quantities", () => {
    expect(() => calculateOrderTotal([], [{ id_menu: "missing", qty: 1 }])).toThrow(
      "Menu tidak tersedia"
    );
    expect(() =>
      calculateOrderTotal(
        [
          {
            id_menu: "menu-1",
            cafe_id: "cafe-1",
            nama_menu: "Nasi Goreng",
            harga_menu: 25_000,
            discount_pct: 0,
            is_active: true,
          },
        ],
        [{ id_menu: "menu-1", qty: 0 }]
      )
    ).toThrow("Menu tidak tersedia");
  });
});

describe("verifyMidtransSignature", () => {
  it("accepts only the exact Midtrans SHA-512 signature", () => {
    const notification = {
      order_id: "order-1",
      status_code: "200",
      gross_amount: "40000.00",
      signature_key: createHash("sha512")
        .update("order-120040000.00server-key")
        .digest("hex"),
    };

    expect(verifyMidtransSignature(notification, "server-key")).toBe(true);
    expect(verifyMidtransSignature({ ...notification, signature_key: "forged" }, "server-key")).toBe(
      false
    );
  });
});
