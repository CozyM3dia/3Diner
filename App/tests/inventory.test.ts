import { describe, expect, it } from "vitest";
import {
  formatQty,
  inventoryStatus,
  requiredInventoryForOrder,
} from "../src/lib/inventory";

describe("inventoryStatus", () => {
  it("classifies empty, low, and safe stock", () => {
    expect(inventoryStatus({ current_qty: 0, minimum_qty: 5 })).toBe("empty");
    expect(inventoryStatus({ current_qty: 3, minimum_qty: 5 })).toBe("low");
    expect(inventoryStatus({ current_qty: 6, minimum_qty: 5 })).toBe("safe");
  });
});

describe("formatQty", () => {
  it("formats integer and decimal quantities without noisy trailing zeros", () => {
    expect(formatQty(200, "ml")).toBe("200 ml");
    expect(formatQty(1.5, "kg")).toBe("1.5 kg");
    expect(formatQty(2.25, "liter")).toBe("2.25 liter");
  });
});

describe("requiredInventoryForOrder", () => {
  it("aggregates repeated recipe usage across multiple menu items", () => {
    const required = requiredInventoryForOrder(
      [
        { menu_id: "menu-1", inventory_item_id: "sirup", qty_per_menu: 200 },
        { menu_id: "menu-2", inventory_item_id: "sirup", qty_per_menu: 50 },
        { menu_id: "menu-2", inventory_item_id: "gula", qty_per_menu: 10 },
      ],
      [
        { id_menu: "menu-1", qty: 2 },
        { id_menu: "menu-2", qty: 3 },
      ]
    );

    expect(required).toEqual([
      { inventory_item_id: "sirup", required_qty: 550 },
      { inventory_item_id: "gula", required_qty: 30 },
    ]);
  });
});
