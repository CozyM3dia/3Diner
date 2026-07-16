import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { rpc },
}));

function createOrderRequest() {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cafeId: "cafe-1",
      table: "12",
      items: [{ id_menu: "menu-1", qty: 2 }],
    }),
  });
}

function createValidOrder() {
  return {
    id_order: "order-1",
    cafe_id: "cafe-1",
    table_number: "12",
    items: [{ id_menu: "menu-1", nama_menu: "Nasi Goreng", harga_menu: 20_000, qty: 2 }],
    total: 40_000,
    status: "received",
  };
}

describe("POST /api/orders inventory integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns unavailable menu names, not ingredient names, when inventory is insufficient", async () => {
    rpc.mockResolvedValue({
      data: {
        error: "insufficient_inventory",
        unavailableMenus: ["Pasta Meatball"],
        ingredientName: "Daging",
      },
      error: null,
    });

    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(createOrderRequest());
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain("Pasta Meatball");
    expect(json.error).not.toContain("Daging");
  });

  it.each([
    [{ message: "menu_unavailable" }, null],
    [{ message: "invalid_order_items" }, null],
    [null, { error: "menu_unavailable" }],
    [null, { error: "invalid_order_request" }],
  ])("maps menu and invalid-order RPC failures to a safe 400", async (error, data) => {
    rpc.mockResolvedValue({ data, error });

    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(createOrderRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Menu tidak tersedia" });
  });

  it("hides unexpected RPC errors", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "connection password secret" },
    });

    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(createOrderRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Gagal membuat pesanan" });
  });

  it.each([
    ["a non-object order", "not-an-order", "token-1"],
    ["a missing order ID", { ...createValidOrder(), id_order: "" }, "token-1"],
    ["a blank order ID", { ...createValidOrder(), id_order: "   " }, "token-1"],
    ["a missing cafe ID", { ...createValidOrder(), cafe_id: "" }, "token-1"],
    ["a blank table number", { ...createValidOrder(), table_number: "   " }, "token-1"],
    ["non-array items", { ...createValidOrder(), items: "items" }, "token-1"],
    ["a non-finite total", { ...createValidOrder(), total: Number.NaN }, "token-1"],
    ["a negative total", { ...createValidOrder(), total: -1 }, "token-1"],
    ["a missing status", { ...createValidOrder(), status: "" }, "token-1"],
    ["a blank order token", createValidOrder(), "   "],
  ])("rejects a successful RPC payload with %s", async (_description, order, orderToken) => {
    rpc.mockResolvedValue({ data: { order, orderToken }, error: null });

    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(createOrderRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Gagal membuat pesanan" });
  });

  it.each([null, undefined, {}, "malformed envelope"])(
    "returns a safe 502 for a malformed RPC envelope: %j",
    async (rpcResponse) => {
      rpc.mockResolvedValue(rpcResponse);

      const { POST } = await import("@/app/api/orders/route");
      const response = await POST(createOrderRequest());

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ error: "Gagal membuat pesanan" });
    }
  );

  it("returns a safe 502 when the RPC promise rejects", async () => {
    rpc.mockRejectedValue(new Error("connection password secret"));

    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(createOrderRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Gagal membuat pesanan" });
  });
});
