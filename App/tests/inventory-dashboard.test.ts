import { describe, expect, it } from "vitest";
import { inventoryActionMessage, movementTypeLabel, tableHorizontalScrollDelta } from "../src/components/dashboard/InventoryTable";
import { quantityMinForMode } from "../src/components/dashboard/StockAdjustmentModal";

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
