import { describe, expect, it } from "vitest";
import { inventoryActionMessage, movementTypeLabel, tableHorizontalScrollDelta } from "../src/components/dashboard/InventoryTable";
import { quantityMinForMode } from "../src/components/dashboard/StockAdjustmentModal";
import { criticalInventoryItems, summarizeInventory } from "../src/lib/dashboard-inventory";
import type { InventoryItem } from "../src/types";

describe("inventory dashboard movement labels", () => {
  it("translates each inventory movement type for the operations log", () => {
    expect(movementTypeLabel("manual_add")).toBe("Tambah stok");
    expect(movementTypeLabel("manual_subtract")).toBe("Kurangi stok");
    expect(movementTypeLabel("manual_set")).toBe("Set stok");
    expect(movementTypeLabel("order_deduction")).toBe("Pengurangan pesanan");
  });
});

describe("inventory table keyboard scrolling", () => {
  it("maps horizontal arrow keys to predictable scroll distances", () => {
    expect(tableHorizontalScrollDelta("ArrowLeft")).toBe(-240);
    expect(tableHorizontalScrollDelta("ArrowRight")).toBe(240);
    expect(tableHorizontalScrollDelta("ArrowUp")).toBe(0);
  });
});

describe("inventory action feedback", () => {
  it("builds clear live-region messages for inventory actions", () => {
    expect(inventoryActionMessage("create", "Tomat Roma")).toBe("Tomat Roma berhasil ditambahkan ke inventory.");
    expect(inventoryActionMessage("edit", "Tomat Roma")).toBe("Tomat Roma berhasil diperbarui.");
    expect(inventoryActionMessage("adjust", "Tomat Roma")).toBe("Stok Tomat Roma berhasil disesuaikan.");
  });
});

describe("stock adjustment quantity rules", () => {
  it("requires positive add and subtract quantities while permitting set zero", () => {
    expect(quantityMinForMode("add")).toBe("0.001");
    expect(quantityMinForMode("subtract")).toBe("0.001");
    expect(quantityMinForMode("set")).toBe("0");
  });
});

describe("dashboard inventory summary", () => {
  it("summarizes stock health for the embedded dashboard workspace", () => {
    expect(
      summarizeInventory([
        { current_qty: 0, minimum_qty: 2, estimated_unit_cost: 5000 },
        { current_qty: 1, minimum_qty: 3, estimated_unit_cost: 10000 },
        { current_qty: 8, minimum_qty: 3, estimated_unit_cost: 2000 },
      ])
    ).toEqual({
      total: 3,
      low: 1,
      empty: 1,
      value: 26_000,
    });
  });

  it("prioritizes empty and below-minimum items for dashboard attention", () => {
    const items = [
      inventoryItem("safe", 10, 2),
      inventoryItem("low-close", 3, 4),
      inventoryItem("empty", 0, 8),
      inventoryItem("low-far", 1, 7),
      inventoryItem("low-limited-out", 2, 5),
    ];

    expect(criticalInventoryItems(items, 3).map((item) => item.name)).toEqual([
      "empty",
      "low-far",
      "low-limited-out",
    ]);
  });
});

function inventoryItem(name: string, currentQty: number, minimumQty: number): InventoryItem {
  return {
    id_inventory_item: name,
    cafe_id: "cafe-1",
    name,
    unit: "pcs",
    current_qty: currentQty,
    minimum_qty: minimumQty,
    estimated_unit_cost: 1000,
    notes: null,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
  };
}
