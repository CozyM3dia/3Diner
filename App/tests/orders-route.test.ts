import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const inFilter = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from },
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inFilter.mockResolvedValue({
      data: [
        {
          id_menu: "menu-1",
          cafe_id: "cafe-1",
          nama_menu: "Nasi Goreng",
          harga_menu: 25_000,
          discount_pct: 20,
          is_active: true,
        },
      ],
      error: null,
    });
    eq.mockReturnValue({ in: inFilter });
    select.mockReturnValue({ eq });
    insert.mockResolvedValue({ error: null });
    from.mockImplementation((table: string) =>
      table === "Menus" ? { select } : { insert }
    );
  });

  it("calculates and persists the total from menu rows, not a browser amount", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeId: "cafe-1",
          table: "12",
          items: [{ id_menu: "menu-1", qty: 2 }],
          total: 1,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cafe_id: "cafe-1",
        total: 40_000,
        payment_status: "unpaid",
      })
    );
  });
});
