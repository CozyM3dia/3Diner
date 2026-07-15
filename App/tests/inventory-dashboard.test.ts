import { describe, expect, it } from "vitest";
import { movementTypeLabel } from "../src/components/dashboard/InventoryTable";

describe("inventory dashboard movement labels", () => {
  it("translates each inventory movement type for the operations log", () => {
    expect(movementTypeLabel("manual_add")).toBe("Tambah stok");
    expect(movementTypeLabel("manual_subtract")).toBe("Kurangi stok");
    expect(movementTypeLabel("manual_set")).toBe("Set stok");
    expect(movementTypeLabel("order_deduction")).toBe("Pengurangan pesanan");
  });
});
