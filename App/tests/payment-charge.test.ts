import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from } }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  tooManyRequests: (s: number) => Response.json({ error: "rate" }, { status: 429 }),
}));

describe("POST /api/payment/charge (Snap)", () => {
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
    from.mockReturnValue({
      select: () => ({ eq: eqOrder }),
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "snap-abc", redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-abc" }),
        { status: 201, headers: { "Content-Type": "application/json" } })));
  });

  it("creates a Snap transaction with the stored total and enabled channels", async () => {
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).snap_token).toBe("snap-abc");
    const call = vi.mocked(fetch).mock.calls[0];
    expect(String(call[0])).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions");
    const sent = JSON.parse(String(call[1]?.body));
    expect(sent.transaction_details.gross_amount).toBe(40000);
    expect(sent.enabled_payments).toContain("qris");
    expect(sent.enabled_payments).toContain("gopay");
  });

  it("rejects a missing customer token", async () => {
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1" }),
    }));
    expect(res.status).toBe(400);
  });

  it("reverts the pending claim when the Snap fetch throws", async () => {
    const updateMock = vi.fn((_arg?: { payment_status?: string }) => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }));
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
