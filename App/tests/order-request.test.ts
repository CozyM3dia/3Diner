import { describe, expect, it } from "vitest";
import { parseItems } from "@/lib/order-request";

const MENU = "11111111-1111-4111-8111-111111111111";
const OPT_A = "22222222-2222-4222-8222-222222222222";
const OPT_B = "33333333-3333-4333-8333-333333333333";

describe("parseItems", () => {
  // Regresi: penguraian sebelumnya menyusun ulang tiap item menjadi
  // { id_menu, qty } dan membuang `options`. Akibatnya varian tidak pernah
  // sampai ke create_order_with_inventory: harga varian hilang, resep varian
  // tidak memotong stok, dan menu dengan grup wajib selalu ditolak
  // `menu_unavailable` karena server melihat nol pilihan.
  it("carries the selected option ids through to the RPC payload", () => {
    expect(parseItems([{ id_menu: MENU, qty: 2, options: [OPT_A, OPT_B] }])).toEqual([
      { id_menu: MENU, qty: 2, options: [OPT_A, OPT_B] },
    ]);
  });

  it("treats a missing options field as an item without variants", () => {
    expect(parseItems([{ id_menu: MENU, qty: 1 }])).toEqual([
      { id_menu: MENU, qty: 1, options: [] },
    ]);
  });

  it("collapses a duplicated option id so max_select is not tripped by the client", () => {
    expect(parseItems([{ id_menu: MENU, qty: 1, options: [OPT_A, OPT_A] }])).toEqual([
      { id_menu: MENU, qty: 1, options: [OPT_A] },
    ]);
  });

  it("rejects option ids that are not uuids", () => {
    expect(parseItems([{ id_menu: MENU, qty: 1, options: ["not-a-uuid"] }])).toBeNull();
    expect(parseItems([{ id_menu: MENU, qty: 1, options: [123] }])).toBeNull();
  });

  it("rejects an options field that is not an array", () => {
    expect(parseItems([{ id_menu: MENU, qty: 1, options: OPT_A }])).toBeNull();
  });

  it("rejects more than 20 options on one line, matching the RPC guard", () => {
    const many = Array.from({ length: 21 }, (_, i) =>
      `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`
    );
    expect(parseItems([{ id_menu: MENU, qty: 1, options: many }])).toBeNull();
  });

  it("still rejects the quantity and shape violations it always did", () => {
    expect(parseItems([])).toBeNull();
    expect(parseItems("nope")).toBeNull();
    expect(parseItems([{ id_menu: MENU, qty: 0 }])).toBeNull();
    expect(parseItems([{ id_menu: MENU, qty: 51 }])).toBeNull();
    expect(parseItems([{ id_menu: MENU, qty: 1.5 }])).toBeNull();
    expect(parseItems([{ id_menu: "", qty: 1 }])).toBeNull();
    expect(parseItems([null])).toBeNull();
  });
});
