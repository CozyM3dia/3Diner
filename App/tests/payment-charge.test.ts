import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const eqToken = vi.fn();
const eqOrder = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from } }));

describe("POST /api/payment/charge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = "server-key";
    process.env.MIDTRANS_IS_PRODUCTION = "false";
    single.mockResolvedValue({
      data: {
        id_order: "order-1",
        customer_token: "token-1",
        total: 40_000,
        payment_status: "unpaid",
        items: [{ id_menu: "menu-1", nama_menu: "Nasi Goreng", harga_menu: 20_000, qty: 2 }],
      },
      error: null,
    });
    eqToken.mockReturnValue({ single });
    eqOrder.mockReturnValue({ eq: eqToken });
    select.mockReturnValue({ eq: eqOrder });
    from.mockReturnValue({
      select,
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status_code: "201", actions: [{ url: "https://api.sandbox.midtrans.com/qr" }] }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  it("uses stored order total and rejects a missing customer token", async () => {
    const { POST } = await import("@/app/api/payment/charge/route");
    const allowed = await POST(
      new Request("http://localhost/api/payment/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order-1", orderToken: "token-1", amount: 1 }),
      })
    );
    expect(allowed.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).transaction_details.gross_amount).toBe(
      40_000
    );

    const denied = await POST(
      new Request("http://localhost/api/payment/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order-1" }),
      })
    );
    expect(denied.status).toBe(400);
  });

  it("returns the existing QR when the order is pending and Midtrans still has it live", async () => {
    single.mockResolvedValue({
      data: { id_order: "order-1", customer_token: "token-1", total: 40_000, payment_status: "pending", items: [] },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ transaction_status: "pending", actions: [{ url: "https://api.sandbox.midtrans.com/qr-existing" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(
      new Request("http://localhost/api/payment/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actions[0].url).toBe("https://api.sandbox.midtrans.com/qr-existing");
    // Hanya panggil /status — tidak membuat transaksi baru.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("/status");
  });

  it("re-charges when the previous Midtrans transaction expired", async () => {
    single.mockResolvedValue({
      data: { id_order: "order-1", customer_token: "token-1", total: 40_000, payment_status: "pending", items: [] },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ transaction_status: "expire" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status_code: "201", actions: [{ url: "https://api.sandbox.midtrans.com/qr-new" }] }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          })
        )
    );

    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(
      new Request("http://localhost/api/payment/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
      })
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain("/charge");
  });
});
