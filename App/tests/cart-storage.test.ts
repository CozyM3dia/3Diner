import { describe, expect, it } from "vitest";
import { GUEST_CART_TTL_MS, cartStorageKey, readGuestCart, writeGuestCart } from "../src/lib/cart-storage";
import type { CartItem } from "../src/types";

const steak: CartItem = {
  line_key: "steak",
  id_menu: "menu-steak",
  nama_menu: "Steak Generate 2",
  harga_menu: 50_000,
  image_url: "https://images.example.test/steak.jpg",
  qty: 1,
  options: [],
};

describe("guest cart persistence", () => {
  it("scopes storage to the cafe slug", () => {
    expect(cartStorageKey("senja-kopi")).toBe("3diner.cart.senja-kopi");
  });

  it("restores a cart updated during the same visit", () => {
    const now = 1_700_000_000_000;
    const raw = writeGuestCart({ items: [steak], table: "7", notes: "tanpa bawang" }, now);

    expect(readGuestCart(raw, now + 15 * 60 * 1000)).toEqual({
      items: [steak],
      table: "7",
      notes: "tanpa bawang",
      updatedAt: now,
    });
  });

  it("discards a cart older than the guest TTL", () => {
    const now = 1_700_000_000_000;
    const raw = writeGuestCart({ items: [steak], table: "7", notes: "" }, now);

    expect(readGuestCart(raw, now + GUEST_CART_TTL_MS + 1)).toBeNull();
  });

  it("discards legacy snapshots that have no updatedAt", () => {
    const raw = JSON.stringify({
      items: [steak],
      table: "7",
      notes: "",
    });

    expect(readGuestCart(raw, Date.now())).toBeNull();
  });

  it("discards corrupt storage instead of throwing", () => {
    expect(readGuestCart("{not-json")).toBeNull();
    expect(readGuestCart(null)).toBeNull();
  });

  it("rebuilds line_key for pre-variant rows and drops invalid items", () => {
    const now = 1_700_000_000_000;
    const raw = JSON.stringify({
      updatedAt: now,
      table: "",
      notes: "",
      items: [
        {
          id_menu: "menu-steak",
          nama_menu: "Steak",
          harga_menu: 50_000,
          qty: 2,
        },
        { id_menu: "broken" },
      ],
    });

    const snapshot = readGuestCart(raw, now);
    expect(snapshot?.items).toHaveLength(1);
    expect(snapshot?.items[0]?.line_key).toBe("menu-steak::");
    expect(snapshot?.items[0]?.qty).toBe(2);
    expect(snapshot?.items[0]?.options).toEqual([]);
  });
});
