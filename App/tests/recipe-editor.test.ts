import { describe, expect, it } from "vitest";
import { nextRecipeRow, recipeRowsValidationError } from "../src/components/dashboard/RecipeEditor";

describe("recipe editor row selection", () => {
  it("selects the first inventory item not already used by a recipe row", () => {
    expect(
      nextRecipeRow(
        [
          { id_inventory_item: "item-1" },
          { id_inventory_item: "item-2" },
        ],
        [{ inventory_item_id: "item-1", qty_per_menu: 1 }]
      )
    ).toEqual({ inventory_item_id: "item-2", qty_per_menu: 1 });
  });

  it("does not add a duplicate when every inventory item is already used", () => {
    expect(
      nextRecipeRow(
        [{ id_inventory_item: "item-1" }],
        [{ inventory_item_id: "item-1", qty_per_menu: 1 }]
      )
    ).toBeUndefined();
  });
});

describe("recipe editor quantity validation", () => {
  it("blocks a save when a retained recipe row has a non-positive or non-finite quantity", () => {
    expect(recipeRowsValidationError([{ inventory_item_id: "item-1", qty_per_menu: 0 }])).toBe(
      "Jumlah setiap bahan harus lebih dari 0."
    );
    expect(recipeRowsValidationError([{ inventory_item_id: "item-1", qty_per_menu: Number.NaN }])).toBe(
      "Jumlah setiap bahan harus lebih dari 0."
    );
  });

  it("allows an intentional empty recipe or positive retained rows", () => {
    expect(recipeRowsValidationError([])).toBeUndefined();
    expect(recipeRowsValidationError([{ inventory_item_id: "item-1", qty_per_menu: 0.001 }])).toBeUndefined();
  });
});
