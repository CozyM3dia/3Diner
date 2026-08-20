import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const successfulOrder = {
  id_order: "order-1",
  cafe_id: "cafe-1",
  table_number: "12",
  items: [{ id_menu: "menu-1", nama_menu: "Nasi Goreng", harga_menu: 20_000, qty: 2 }],
  total: 40_000,
  status: "received",
};

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { rpc },
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    rpc.mockResolvedValue({
      data: {
        order: successfulOrder,
        orderToken: "token-1",
      },
      error: null,
    });
  });

  it("delegates canonical prices and totals to the inventory RPC", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "idem-1234567890123456",
        },
        body: JSON.stringify({
          cafeId: "cafe-1",
          table: "12",
          items: [{ id_menu: "menu-1", qty: 2 }],
          notes: "Tanpa acar",
          quoteId: "44444444-4444-4444-8444-444444444444",
          total: 1,
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      order: successfulOrder,
      orderToken: "token-1",
      checkinCode: null,
    });
    expect(rpc).toHaveBeenCalledWith("commit_order_atomic", {
      p_cafe_id: "cafe-1",
      p_table_number: "12",
      p_items: [{ id_menu: "menu-1", qty: 2, options: [] }],
      p_notes: "Tanpa acar",
      p_channel: "online",
      p_quote_id: "44444444-4444-4444-8444-444444444444",
      p_idempotency_key: "idem-1234567890123456",
    });
    expect(rpc.mock.calls.filter(([fn]) => fn === "commit_order_atomic")).toHaveLength(1);
  });

  // Ini yang dulu bocor: rute menyusun ulang tiap item menjadi { id_menu, qty }
  // sehingga varian yang dipilih tamu tidak pernah sampai ke RPC.
  it("forwards the selected variant ids to the inventory RPC", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const options = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "idem-variant-123456",
        },
        body: JSON.stringify({
          cafeId: "cafe-1",
          table: "12",
          items: [{ id_menu: "menu-1", qty: 1, options }],
          quoteId: "44444444-4444-4444-8444-444444444444",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("commit_order_atomic", {
      p_cafe_id: "cafe-1",
      p_table_number: "12",
      p_items: [{ id_menu: "menu-1", qty: 1, options }],
      p_notes: null,
      p_channel: "online",
      p_quote_id: "44444444-4444-4444-8444-444444444444",
      p_idempotency_key: "idem-variant-123456",
    });
  });

  it("uses the atomic commit RPC when quote and idempotency identity are supplied", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "idem-1234567890123456",
        },
        body: JSON.stringify({
          cafeId: "cafe-1",
          table: "12",
          items: [{ id_menu: "menu-1", qty: 1 }],
          quoteId: "44444444-4444-4444-8444-444444444444",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("commit_order_atomic", {
      p_cafe_id: "cafe-1",
      p_table_number: "12",
      p_items: [{ id_menu: "menu-1", qty: 1, options: [] }],
      p_notes: null,
      p_channel: "online",
      p_quote_id: "44444444-4444-4444-8444-444444444444",
      p_idempotency_key: "idem-1234567890123456",
    });
  });

  it("rejects a valid-looking checkout without quote and idempotency metadata", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cafeId: "cafe-1",
        table: "12",
        items: [{ id_menu: "menu-1", qty: 1 }],
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "checkout_metadata_required",
      error: "Ringkasan pesanan perlu dimuat ulang sebelum dikirim",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["a blank cafe ID", { cafeId: " ", table: "12", items: [{ id_menu: "menu-1", qty: 1 }] }],
    ["a blank table", { cafeId: "cafe-1", table: " ", items: [{ id_menu: "menu-1", qty: 1 }] }],
    ["an empty item list", { cafeId: "cafe-1", table: "12", items: [] }],
    [
      "more than 50 items",
      {
        cafeId: "cafe-1",
        table: "12",
        items: Array.from({ length: 51 }, () => ({ id_menu: "menu-1", qty: 1 })),
      },
    ],
    ["an out-of-range quantity", { cafeId: "cafe-1", table: "12", items: [{ id_menu: "menu-1", qty: 51 }] }],
    [
      "an option id that is not a uuid",
      { cafeId: "cafe-1", table: "12", items: [{ id_menu: "menu-1", qty: 1, options: ["nope"] }] },
    ],
  ])("rejects %s without calling the inventory RPC", async (_description, body) => {
    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Data pesanan tidak valid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
