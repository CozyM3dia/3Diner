import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from } }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  tooManyRequests: () => Response.json({ error: "rate" }, { status: 429 }),
}));

describe("POST /api/payment/charge (QRIS)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = "server-key";
    process.env.MIDTRANS_IS_PRODUCTION = "false";
    single.mockResolvedValue({
      data: {
        id_order: "order-1", customer_token: "token-1", total: 40000,
        payment_status: "awaiting_payment",
        items: [{ id_menu: "m1", nama_menu: "Nasi", harga_menu: 20000, qty: 2 }],
      },
      error: null,
    });
    const eqToken = () => ({ single });
    const eqOrder = () => ({ eq: eqToken });
    // The claim update (`payment_status: "pending"`) chains `.select("id_order")` so the
    // route can tell whether it actually claimed a row; the revert update
    // (`payment_status: "awaiting_payment"`) resolves directly without `.select()`.
    const update = vi.fn((patch: { payment_status?: string }) => ({
      eq: () => ({
        eq: () =>
          patch.payment_status === "pending"
            ? { select: () => Promise.resolve({ data: [{ id_order: "order-1" }], error: null }) }
            : Promise.resolve({ error: null }),
      }),
    }));
    from.mockReturnValue({
      select: () => ({ eq: eqOrder }),
      update,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        status_code: "201",
        payment_type: "qris",
        transaction_status: "pending",
        actions: [
          {
            name: "generate-qr-code",
            method: "GET",
            url: "https://api.sandbox.midtrans.com/v2/qris/tx-1/qr-code",
          },
          {
            name: "generate-qr-code-v2",
            method: "GET",
            url: "https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code",
          },
        ],
      }),
        { status: 201, headers: { "Content-Type": "application/json" } })));
  });

  it("creates one dynamic QRIS transaction that can be scanned by QRIS apps", async () => {
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).qris_url).toBe("https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code");
    const call = vi.mocked(fetch).mock.calls[0];
    expect(String(call[0])).toBe("https://api.sandbox.midtrans.com/v2/charge");
    const sent = JSON.parse(String(call[1]?.body));
    expect(sent.payment_type).toBe("qris");
    expect(sent.transaction_details.gross_amount).toBe(40000);
    expect(sent).not.toHaveProperty("enabled_payments");
  });

  it("includes stored service and tax lines so QRIS item details reconcile to gross amount", async () => {
    single.mockResolvedValue({
      data: {
        id_order: "order-1", customer_token: "token-1", total: 45000, subtotal: 40000,
        service_amount: 1000, tax_amount: 4000, prices_include_tax: false,
        payment_status: "awaiting_payment",
        items: [{ id_menu: "m1", nama_menu: "Nasi", harga_menu: 20000, qty: 2 }],
      },
      error: null,
    });
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(res.status).toBe(200);
    const sent = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(sent.item_details).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "service-charge", price: 1000, quantity: 1 }),
      expect.objectContaining({ id: "tax", price: 4000, quantity: 1 }),
    ]));
    expect(sent.item_details.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0)).toBe(45000);
  });

  it("returns the stored QRIS URL for a pending order instead of creating a second transaction", async () => {
    single.mockResolvedValue({
      data: {
        id_order: "order-1", customer_token: "token-1", total: 40000,
        payment_status: "pending",
        payment_qr_url: "https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code",
        items: [],
      },
      error: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));

    expect(res.status).toBe(200);
    expect((await res.json()).qris_url).toBe("https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing customer token", async () => {
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1" }),
    }));
    expect(res.status).toBe(400);
  });

  it("reverts the pending claim when the Midtrans fetch throws", async () => {
    const updateMock = vi.fn((patch?: { payment_status?: string }) => ({
      eq: () => ({
        eq: () =>
          patch?.payment_status === "pending"
            ? { select: () => Promise.resolve({ data: [{ id_order: "order-1" }], error: null }) }
            : Promise.resolve({ error: null }),
      }),
    }));
    const eqToken = () => ({ single });
    const eqOrder = () => ({ eq: eqToken });
    from.mockReturnValue({
      select: () => ({ eq: eqOrder }),
      update: updateMock,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(res.status).toBe(502);
    const revertCall = updateMock.mock.calls.find(
      (call) => call[0]?.payment_status === "awaiting_payment"
    );
    expect(revertCall).toBeTruthy();
  });

  it("refuses a concurrent/retry charge when the claim finds nothing to claim, without calling Midtrans", async () => {
    // Order is still "awaiting_payment" per the initial select, but another request already
    // won the atomic claim race — the claim update matches 0 rows. The route must detect this
    // via .select() and bail with 409 before ever calling Midtrans or reverting anything.
    const updateMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }));
    const eqToken = () => ({ single });
    const eqOrder = () => ({ eq: eqToken });
    from.mockReturnValue({
      select: () => ({ eq: eqOrder }),
      update: updateMock,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(res.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
    // Only the claim attempt happened — no revert update on top of it.
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("refuses to charge an already-paid order", async () => {
    single.mockResolvedValue({ data: {
      id_order: "order-1", customer_token: "token-1", total: 40000,
      payment_status: "paid", items: [] }, error: null });
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(res.status).toBe(409);
  });
});
