// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Kontrak CSS papan POS (bug 5 Sep 2026: "item kedua hilang dari keranjang").
 *
 *  .pos-cart di-cap max-height viewport; .pos-cart-body adalah flex column
 *  yang menggulir (overflow-y:auto). .pos-items memakai overflow:hidden demi
 *  rounded corner — dan flex item yang overflow-nya bukan visible boleh
 *  menyusut sampai 0. Tanpa flex-shrink:0 pada anak-anak .pos-cart-body,
 *  flexbox menyusutkan .pos-items di bawah tinggi kontennya saat keranjang
 *  panjang, dan overflow:hidden memotong baris terakhir TANPA scrollbar —
 *  badge "N item" dan total tetap benar, barisnya yang lenyap. */

const css = readFileSync(path.resolve("src/app/pos.css"), "utf8");

describe("pos.css — kontrak anti-pemotongan baris keranjang", () => {
  it("anak .pos-cart-body dikecualikan dari penyusutan flex (flex-shrink: 0)", () => {
    expect(css).toMatch(/\.pos-cart-body\s*>\s*\*\s*\{\s*flex-shrink:\s*0;\s*\}/);
  });

  it(".pos-cart-body sendiri yang menggulir, bukan kartu-kartunya", () => {
    const body = css.match(/\.pos-cart-body\s*\{[^}]*\}/)?.[0] ?? "";
    expect(body).toContain("overflow-y: auto");
    expect(body).toContain("min-height: 0");
  });
});
