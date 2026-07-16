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

  it("rejects malformed successful RPC payloads", async () => {
    rpc.mockResolvedValue({
      data: { order: "not-an-order", orderToken: "token-1" },
      error: null,
    });

    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(createOrderRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Gagal membuat pesanan" });
  });
});
