import { describe, expect, it } from "vitest";
import { buildSalesCsv, csvCell } from "../src/components/dashboard/ExportReport";
import type { SalesExportRow } from "@/lib/dashboard-actions";

/** CSV laporan dibuka pemilik kafe di Excel / Google Sheets. Sel teks yang
 *  diawali =, +, -, @, tab, atau CR dieksekusi sebagai formula di sana.
 *  table_number dan items_summary berasal dari POST /api/orders yang publik. */
function rowWith(overrides: Partial<SalesExportRow>): SalesExportRow {
  return {
    id_order: "11111111-2222-3333-4444-555555555555",
    created_at: "2026-07-21T10:00:00.000Z",
    table_number: "7",
    items_summary: "2x Kopi",
    item_count: 2,
    total: 40000,
    payment_method: "cash",
    payment_status: "paid",
    status: "ready",
    ...overrides,
  } as SalesExportRow;
}

describe("csvCell formula guard", () => {
  it.each(["=1+1", "+1+1", "-1+1", "@SUM(A1:A9)", "\t=1+1", "\r=1+1"])(
    "neutralises text starting with %j",
    (payload) => {
      expect(csvCell(payload)).toBe(`"'${payload}"`);
    }
  );

  it("neutralises the classic command-execution payload", () => {
    const payload = '=cmd|\' /C calc\'!A0';
    expect(csvCell(payload)).toBe(`"'=cmd|' /C calc'!A0"`);
  });

  it("leaves ordinary text untouched", () => {
    expect(csvCell("12")).toBe("12");
    expect(csvCell("2x Kopi")).toBe("2x Kopi");
  });

  it("still quotes and escapes separators and quotes", () => {
    expect(csvCell('Kopi, Roti')).toBe('"Kopi, Roti"');
    expect(csvCell('Meja "VIP"')).toBe('"Meja ""VIP"""');
    expect(csvCell("baris\nbaru")).toBe('"baris\nbaru"');
  });

  it("keeps numbers numeric so spreadsheet totals still work", () => {
    expect(csvCell(40000)).toBe("40000");
    expect(csvCell(-5000)).toBe("-5000");
    expect(csvCell(0)).toBe("0");
  });
});

describe("buildSalesCsv", () => {
  it("guards the table number coming from the public order endpoint", () => {
    const csv = buildSalesCsv([rowWith({ table_number: "=1+1" })], "Senja Kopi");
    expect(csv).not.toContain(",=1+1");
    expect(csv).toContain(`"'=1+1"`);
  });

  it("guards the item summary", () => {
    const csv = buildSalesCsv([rowWith({ items_summary: "@SUM(A1:A9)" })], "Senja Kopi");
    expect(csv).not.toContain(",@SUM(A1:A9)");
    expect(csv).toContain(`"'@SUM(A1:A9)"`);
  });

  it("guards the cafe name used in the metadata header", () => {
    const csv = buildSalesCsv([rowWith({})], "=HYPERLINK(\"http://evil\",\"klik\")");
    expect(csv).not.toContain("\n=HYPERLINK");
    expect(csv).toContain(`'=HYPERLINK`);
  });

  it("keeps an ordinary report readable", () => {
    const csv = buildSalesCsv([rowWith({ table_number: "12", items_summary: "2x Kopi" })], "Senja Kopi");
    expect(csv).toContain("Senja Kopi - Laporan Penjualan");
    expect(csv).toContain(",12,2x Kopi,2,40000,");
    expect(csv).not.toContain("'");
  });
});
