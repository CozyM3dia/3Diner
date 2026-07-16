import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { rpc },
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    rpc.mockResolvedValue({
      data: {
        order: {
          id_order: "order-1",
          cafe_id: "cafe-1",
          table_number: "12",
          items: [{ id_menu: "menu-1", nama_menu: "Nasi Goreng", harga_menu: 20_000, qty: 2 }],
          total: 40_000,
        },
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeId: "cafe-1",
          table: "12",
          items: [{ id_menu: "menu-1", qty: 2 }],
          notes: "Tanpa acar",
          total: 1,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_order_with_inventory", {
      p_cafe_id: "cafe-1",
      p_table_number: "12",
      p_items: [{ id_menu: "menu-1", qty: 2 }],
      p_notes: "Tanpa acar",
    });
  });
});
