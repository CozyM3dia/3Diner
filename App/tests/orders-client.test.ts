import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrder, fetchOrder, quoteOrder } from "../src/lib/orders";

describe("createOrder client errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the response message for user-facing errors while preserving API error codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "Menu tidak tersedia",
          message: "Stok beberapa menu sedang tidak cukup. Silakan kurangi jumlah atau pilih menu lain.",
        }),
      })
    );

    await expect(
      createOrder({
        cafeId: "cafe-1",
        cafeSlug: "kopi",
        cafeName: "Kopi",
        table: "7",
        items: [],
      })
    ).rejects.toThrow("Stok beberapa menu sedang tidak cukup. Silakan kurangi jumlah atau pilih menu lain.");
  });
});

describe("quoteOrder client errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves the route's safe unavailable-menu message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ error: "Menu tidak tersedia" }, { status: 400 })
    ));

    await expect(quoteOrder({ cafeId: "cafe-1", items: [] })).rejects.toThrow("Menu tidak tersedia");
  });

  it.each([
    ["a malformed error body", () => Promise.resolve(new Response("not-json", { status: 502 }))],
    ["a network failure", () => Promise.reject(new TypeError("offline"))],
  ])("uses the generic quote error for %s", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn(response));

    await expect(quoteOrder({ cafeId: "cafe-1", items: [] })).rejects.toThrow("Gagal memuat ringkasan pesanan");
  });
});

describe("fetchOrder client recovery", () => {
  const getItem = vi.fn();
  const setItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", { getItem, setItem });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies a 404 as not-found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(fetchOrder("order-1", "token-1")).rejects.toMatchObject({ kind: "not-found" });
  });

  it.each([
    ["a server error", () => Promise.resolve(new Response(null, { status: 502 }))],
    ["a network failure", () => Promise.reject(new TypeError("offline"))],
    ["a malformed success response", () => Promise.resolve(Response.json({ order: {} }))],
  ])("classifies %s as transient", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn(response));

    await expect(fetchOrder("order-1", "token-1")).rejects.toMatchObject({ kind: "transient" });
  });

  it("returns a valid order and saves its token recovery stub", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({
        order: {
          id_order: "order-1",
          cafe_id: "cafe-1",
          cafe_slug: "senja-kopi",
          cafe_name: "Senja Kopi",
          table_number: "21",
          items: [],
          subtotal: 21_250,
          tax_pct: 0,
          tax_amount: 0,
          service_pct: 0,
          service_amount: 0,
          prices_include_tax: true,
          total: 21_250,
          status: "awaiting",
          payment_method: null,
          payment_status: "awaiting_payment",
          created_at: "2026-08-13T10:00:00.000Z",
        },
        reviewUrl: null,
      }))
    );
    getItem.mockReturnValue(null);

    await expect(fetchOrder("order-1", "token-1")).resolves.toMatchObject({
      order: { id_order: "order-1", customer_token: "token-1" },
    });
    expect(setItem).toHaveBeenCalledWith(
      "3diner.order.order-1",
      expect.stringContaining('"customer_token":"token-1"')
    );
  });
});
