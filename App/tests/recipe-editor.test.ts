import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { nextRecipeRow, recipeRowsValidationError } from "../src/components/dashboard/RecipeEditor";
import RecipeEditor from "../src/components/dashboard/RecipeEditor";
import type { InventoryItem } from "../src/types";

const inventoryItems: InventoryItem[] = [
  {
    id_inventory_item: "tomato",
    cafe_id: "cafe-1",
    name: "Tomat",
    unit: "gram",
    current_qty: 0,
    minimum_qty: 500,
    estimated_unit_cost: 20,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

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

describe("recipe editor inventory context", () => {
  it("shows each ingredient's current stock, minimum, unit, and empty status with an Inventory link", () => {
    const html = renderToStaticMarkup(
      React.createElement(RecipeEditor, {
        inventoryItems,
        rows: [{ inventory_item_id: "tomato", qty_per_menu: 80 }],
        onRowsChange: () => undefined,
      })
    );

    expect(html).toContain("Stok 0 gram");
    expect(html).toContain("Minimum 500 gram");
    expect(html).toContain("Habis");
    expect(html).toContain('href="/dashboard/inventory"');
  });

  it("links directly to Inventory when no ingredients are available", () => {
    const html = renderToStaticMarkup(
      React.createElement(RecipeEditor, {
        inventoryItems: [],
        rows: [],
        onRowsChange: () => undefined,
      })
    );

    expect(html).toContain('href="/dashboard/inventory"');
    expect(html).toContain("Buka Inventory");
  });
});
