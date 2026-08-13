import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { rpc },
}));

const MENU_ID = "11111111-1111-4111-8111-111111111111";
const OPTION_ID = "22222222-2222-4222-8222-222222222222";
const CAFE_ID = "33333333-3333-4333-8333-333333333333";

const canonicalQuote = {
  items: [
    {
      id_menu: MENU_ID,
      nama_menu: "Kopi Susu",
      harga_menu: 22_000,
      qty: 2,
      options: [
        {
          id_option_value: OPTION_ID,
          group_name: "Ukuran",
          name: "Large",
          price_delta: 2_000,
        },
      ],
    },
  ],
  subtotal: 44_000,
  tax_pct: 10,
  tax_amount: 4_840,
  service_pct: 10,
  service_amount: 4_400,
  prices_include_tax: false,
  total: 53_240,
};

async function loadPost() {
  try {
    return (await import("@/app/api/orders/quote/route")).POST;
  } catch {
    return null;
  }
}

function quoteRequest(items: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/orders/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ cafeId: CAFE_ID, items }),
  });
}

describe("POST /api/orders/quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    rpc.mockImplementation(async (name: string) => {
      if (name === "consume_rate_limits") {
        return { data: { allowed: true }, error: null };
      }
      if (name === "quote_order") {
        return { data: canonicalQuote, error: null };
      }
      return { data: null, error: { message: "unexpected rpc" } };
    });
  });

  it("returns the canonical server quote after normalizing option IDs and limiting IP plus cafe", async () => {
    const POST = await loadPost();
    expect(POST).toBeTypeOf("function");
    if (!POST) return;

    const response = await POST(
      quoteRequest(
        [{ id_menu: MENU_ID, qty: 2, options: [OPTION_ID, OPTION_ID] }],
        { "x-forwarded-for": "203.0.113.8, proxy" }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ quote: canonicalQuote });
    expect(rpc).toHaveBeenCalledWith("consume_rate_limits", {
      p_keys: ["order-quotes:ip:203.0.113.8", `order-quotes:cafe:${CAFE_ID}`],
      p_limits: [10, 120],
      p_window_seconds: 60,
    });
    expect(rpc).toHaveBeenCalledWith("quote_order", {
      p_cafe_id: CAFE_ID,
      p_items: [{ id_menu: MENU_ID, qty: 2, options: [OPTION_ID] }],
    });
  });

  it("rejects invalid items before invoking the rate limiter or quote RPC", async () => {
    const POST = await loadPost();
    expect(POST).toBeTypeOf("function");
    if (!POST) return;

    const response = await POST(quoteRequest([{ id_menu: MENU_ID, qty: 1, options: ["not-a-uuid"] }]));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Data pesanan tidak valid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps a rate-limited quote from reaching the canonical quote RPC", async () => {
    rpc.mockResolvedValueOnce({ data: { allowed: false, reset_at: new Date(Date.now() + 1_000).toISOString() }, error: null });
    const POST = await loadPost();
    expect(POST).toBeTypeOf("function");
    if (!POST) return;

    const response = await POST(quoteRequest([{ id_menu: MENU_ID, qty: 1, options: [] }]));

    expect(response.status).toBe(429);
    expect(rpc.mock.calls.some(([name]) => name === "quote_order")).toBe(false);
  });

  it("maps invalid and malformed quote RPC responses to safe public errors", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "consume_rate_limits") return { data: { allowed: true }, error: null };
      return { data: { subtotal: 44_000 }, error: null };
    });
    const POST = await loadPost();
    expect(POST).toBeTypeOf("function");
    if (!POST) return;

    const response = await POST(quoteRequest([{ id_menu: MENU_ID, qty: 1, options: [] }]));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Gagal memuat ringkasan pesanan" });
  });
});

describe("quoteOrder client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes the create-order item payload and returns only a valid canonical quote", async () => {
    const orders = await import("../src/lib/orders");
    expect(orders.quoteOrder).toBeTypeOf("function");
    if (!orders.quoteOrder) return;

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ quote: canonicalQuote }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      orders.quoteOrder({
        cafeId: CAFE_ID,
        items: [
          {
            line_key: `${MENU_ID}:${OPTION_ID}:`,
            id_menu: MENU_ID,
            nama_menu: "Forged local name",
            harga_menu: 1,
            qty: 2,
            options: [
              { id_option_value: OPTION_ID, group_name: "Forged", name: "Forged", price_delta: -99_999 },
            ],
          },
        ],
      })
    ).resolves.toEqual(canonicalQuote);
    expect(fetchMock).toHaveBeenCalledWith("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cafeId: CAFE_ID,
        items: [{ id_menu: MENU_ID, qty: 2, options: [OPTION_ID] }],
      }),
    });
  });

  it("throws a safe error when the quote endpoint rejects the request", async () => {
    const orders = await import("../src/lib/orders");
    expect(orders.quoteOrder).toBeTypeOf("function");
    if (!orders.quoteOrder) return;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "internal secret" }) }));

    await expect(orders.quoteOrder({ cafeId: CAFE_ID, items: [] })).rejects.toThrow(
      "Gagal memuat ringkasan pesanan"
    );
  });
});
