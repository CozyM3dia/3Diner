import { describe, expect, it } from "vitest";
import { buildSalesReportHtml } from "../src/components/dashboard/ExportReport";
import type { SalesExportRow } from "@/lib/dashboard-actions";

/** Laporan penjualan dirakit sebagai string HTML lalu ditulis via
 *  document.write ke iframe same-origin. table_number berasal dari
 *  POST /api/orders yang publik, items_summary memuat nama menu. */
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

const PAYLOAD = '<img src=x onerror="alert(1)">';

describe("buildSalesReportHtml escaping", () => {
  it("escapes the table number coming from the public order endpoint", () => {
    const html = buildSalesReportHtml([rowWith({ table_number: PAYLOAD })], "Senja Kopi");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("escapes the item summary and the cafe name", () => {
    const html = buildSalesReportHtml(
      [rowWith({ items_summary: PAYLOAD })],
      "<script>alert('cafe')</script>"
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert('cafe')</script>");
  });

  it("keeps ordinary rows readable", () => {
    const html = buildSalesReportHtml([rowWith({ table_number: "12", items_summary: "2x Kopi & Roti" })], "Senja Kopi");
    expect(html).toContain(">12<");
    expect(html).toContain("2x Kopi &amp; Roti");
    expect(html).toContain("Senja Kopi");
  });
});
