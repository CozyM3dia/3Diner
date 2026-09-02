/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CartProvider, useCart } from "../src/lib/cart";
import { cartStorageKey, writeGuestCart } from "../src/lib/cart-storage";
import type { CartItem } from "../src/types";

const steak: CartItem = {
  line_key: "steak",
  id_menu: "menu-steak",
  nama_menu: "Steak Generate 2",
  harga_menu: 50_000,
  image_url: null,
  qty: 1,
  options: [],
};

function CartProbe() {
  const { count, total, items } = useCart();
  return (
    <div>
      <span>count:{count}</span>
      <span>total:{total}</span>
      <span>name:{items[0]?.nama_menu ?? ""}</span>
    </div>
  );
}

describe("CartProvider guest persistence", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("does not restore a stale unpaid cart on a later visit", async () => {
    localStorage.setItem(
      cartStorageKey("senja-kopi"),
      writeGuestCart({ items: [steak], table: "", notes: "" }, Date.now() - 5 * 60 * 60 * 1000),
    );

    render(
      <CartProvider slug="senja-kopi">
        <CartProbe />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(localStorage.getItem(cartStorageKey("senja-kopi")) ?? "").not.toContain("Steak Generate 2");
    });
    expect(screen.getByText("count:0")).toBeTruthy();
    expect(screen.getByText("total:0")).toBeTruthy();
    expect(screen.getByText("name:")).toBeTruthy();
  });

  it("restores a cart saved during the same visit", async () => {
    localStorage.setItem(
      cartStorageKey("senja-kopi"),
      writeGuestCart({ items: [steak], table: "4", notes: "" }, Date.now()),
    );

    render(
      <CartProvider slug="senja-kopi">
        <CartProbe />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("count:1")).toBeTruthy();
    });
    expect(screen.getByText("total:50000")).toBeTruthy();
    expect(screen.getByText("name:Steak Generate 2")).toBeTruthy();
  });

  it("stamps updatedAt when the guest adds an item so a refresh keeps the cart", async () => {
    function AddSteak() {
      const { add, count } = useCart();
      return (
        <button
          type="button"
          onClick={() =>
            add(
              {
                id_menu: "menu-steak",
                cafe_id: "cafe-1",
                nama_menu: "Steak Generate 2",
                harga_menu: 50_000,
                description_menu: null,
                model_3d_url: "",
                redirect_link: "",
                created_at: "",
              },
              1,
            )
          }
        >
          add {count}
        </button>
      );
    }

    render(
      <CartProvider slug="senja-kopi">
        <AddSteak />
      </CartProvider>,
    );

    screen.getByRole("button").click();

    await waitFor(() => {
      expect(screen.getByText("add 1")).toBeTruthy();
    });
    const stored = JSON.parse(localStorage.getItem(cartStorageKey("senja-kopi")) ?? "{}") as {
      updatedAt?: number;
      items?: Array<{ nama_menu?: string }>;
    };
    expect(stored.items?.[0]?.nama_menu).toBe("Steak Generate 2");
    expect(typeof stored.updatedAt).toBe("number");
    expect(stored.updatedAt).toBeGreaterThan(Date.now() - 5_000);
  });
});
