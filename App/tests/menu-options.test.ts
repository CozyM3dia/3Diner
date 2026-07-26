import { describe, expect, it } from "vitest";
import { optionGroupsValidationError, type OptionGroupDraft } from "@/lib/menu-option-drafts";
import { cartLineKey } from "@/types";

function group(overrides: Partial<OptionGroupDraft> = {}): OptionGroupDraft {
  return {
    name: "Ukuran",
    min_select: 1,
    max_select: 1,
    values: [
      { name: "Regular", price_delta: 0, is_active: true, recipes: [] },
      { name: "Large", price_delta: 5000, is_active: true, recipes: [] },
    ],
    ...overrides,
  };
}

describe("cartLineKey", () => {
  it("treats the same menu with different variants as different lines", () => {
    expect(cartLineKey("menu-1", ["opt-a"])).not.toBe(cartLineKey("menu-1", ["opt-b"]));
  });

  it("is stable regardless of the order the customer picked options in", () => {
    expect(cartLineKey("menu-1", ["opt-b", "opt-a"])).toBe(cartLineKey("menu-1", ["opt-a", "opt-b"]));
  });

  it("collapses a duplicated option id", () => {
    expect(cartLineKey("menu-1", ["opt-a", "opt-a"])).toBe(cartLineKey("menu-1", ["opt-a"]));
  });

  it("keeps a plain menu distinct from the same menu with an option", () => {
    expect(cartLineKey("menu-1", [])).not.toBe(cartLineKey("menu-1", ["opt-a"]));
  });
});

describe("optionGroupsValidationError", () => {
  it("accepts a well-formed single-choice group", () => {
    expect(optionGroupsValidationError([group()])).toBeUndefined();
  });

  it("accepts no groups at all", () => {
    expect(optionGroupsValidationError([])).toBeUndefined();
  });

  it("rejects a group with no choices", () => {
    expect(optionGroupsValidationError([group({ values: [] })])).toMatch(/belum punya pilihan/);
  });

  it("rejects an unnamed group", () => {
    expect(optionGroupsValidationError([group({ name: "   " })])).toMatch(/harus punya nama/);
  });

  it("rejects duplicate choice names inside one group", () => {
    const duplicated = group({
      values: [
        { name: "Large", price_delta: 0, is_active: true, recipes: [] },
        { name: " large ", price_delta: 1000, is_active: true, recipes: [] },
      ],
    });
    expect(optionGroupsValidationError([duplicated])).toMatch(/muncul dua kali/);
  });

  it("rejects a group demanding more choices than it offers", () => {
    expect(optionGroupsValidationError([group({ max_select: 5 })])).toMatch(
      /lebih banyak pilihan daripada/
    );
  });

  it("rejects a minimum above the maximum", () => {
    expect(optionGroupsValidationError([group({ min_select: 2, max_select: 1 })])).toMatch(
      /tidak masuk akal/
    );
  });

  it("accepts an optional multi-choice group", () => {
    expect(
      optionGroupsValidationError([group({ name: "Topping", min_select: 0, max_select: 2 })])
    ).toBeUndefined();
  });

  it("rejects a non-positive quantity on a variant recipe", () => {
    const withRecipe = group({
      values: [
        {
          name: "Large",
          price_delta: 5000,
          is_active: true,
          recipes: [{ inventory_item_id: "inv-1", qty_per_menu: 0 }],
        },
      ],
      max_select: 1,
    });
    expect(optionGroupsValidationError([withRecipe])).toMatch(/harus lebih dari 0/);
  });

  it("rejects the same ingredient twice on one variant", () => {
    const withRecipe = group({
      values: [
        {
          name: "Large",
          price_delta: 5000,
          is_active: true,
          recipes: [
            { inventory_item_id: "inv-1", qty_per_menu: 20 },
            { inventory_item_id: "inv-1", qty_per_menu: 30 },
          ],
        },
      ],
      max_select: 1,
    });
    expect(optionGroupsValidationError([withRecipe])).toMatch(/dua kali/);
  });

  it("rejects a fractional price delta, since rupiah has no cents here", () => {
    const fractional = group({
      values: [{ name: "Large", price_delta: 1500.5, is_active: true, recipes: [] }],
      max_select: 1,
    });
    expect(optionGroupsValidationError([fractional])).toMatch(/angka bulat/);
  });
});
