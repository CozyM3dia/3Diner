import { describe, expect, it } from "vitest";
import { buildReceiptHtml, type OrderRow } from "../src/components/dashboard/OrdersClient";

/** Struk dirakit sebagai string HTML lalu ditulis via document.write ke iframe
 *  same-origin. table_number + notes datang dari POST /api/orders yang publik
 *  (tanpa auth), jadi keduanya wajib di-escape sebelum masuk template. */
function orderWith(overrides: Partial<OrderRow>): OrderRow {
  return {
    id_order: "11111111-2222-3333-4444-555555555555",
    cafe_id: "cafe-1",
    table_number: "7",
    items: [{ id_menu: "m1", nama_menu: "Kopi", harga_menu: 20000, image_url: "", qty: 2 }],
    total: 40000,
    status: "received",
    payment_method: "cash",
    payment_status: "paid",
    created_at: "2026-07-21T10:00:00.000Z",
    notes: null,
    ...overrides,
  };
}

const PAYLOAD = '<img src=x onerror="alert(1)">';

describe("buildReceiptHtml escaping", () => {
  it("escapes notes coming from the public order endpoint", () => {
    const html = buildReceiptHtml(orderWith({ notes: PAYLOAD }), "Senja Kopi");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain("&lt;img src=x");
  });

  it("escapes the table number coming from the public order endpoint", () => {
    const html = buildReceiptHtml(orderWith({ table_number: '7<script>alert(1)</script>' }), "Senja Kopi");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes menu names and the cafe name", () => {
    const html = buildReceiptHtml(
      orderWith({ items: [{ id_menu: "m1", nama_menu: PAYLOAD, harga_menu: 1000, image_url: "", qty: 1 }] }),
      "<script>alert('cafe')</script>"
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert('cafe')</script>");
  });

  it("keeps ordinary text readable", () => {
    const html = buildReceiptHtml(
      orderWith({ table_number: "12", notes: "Tanpa gula & es sedikit" }),
      "Senja Kopi"
    );
    expect(html).toContain("MEJA 12");
    expect(html).toContain("Tanpa gula &amp; es sedikit");
    expect(html).toContain("Senja Kopi");
  });
});
