import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  tooManyRequests: (s: number) =>
    Response.json({ error: "rate" }, { status: 429, headers: { "Retry-After": String(s) } }),
}));

const TOKEN = "3f1c9d2e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/orders/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the order the database reports, not a client-supplied state", async () => {
    rpc.mockResolvedValue({
      data: {
        order: {
          id_order: "order-1",
          cafe_id: "cafe-1",
          table_number: "7",
          items: [],
          total: 40_000,
          status: "preparing",
          payment_method: "cash",
          payment_status: "unpaid",
          created_at: "2026-07-27T03:00:00.000Z",
        },
        reviewUrl: "https://g.page/r/demo/review",
      },
      error: null,
    });

    const { GET } = await import("@/app/api/orders/[id]/route");
    const res = await GET(
      new Request(`http://localhost/api/orders/order-1?token=${TOKEN}`),
      params("order-1")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order.payment_status).toBe("unpaid");
    expect(body.reviewUrl).toBe("https://g.page/r/demo/review");
    expect(rpc).toHaveBeenCalledWith("get_order_for_customer", {
      p_order_id: "order-1",
      p_token: TOKEN,
    });
  });

  it("rejects a malformed token without touching the database", async () => {
    const { GET } = await import("@/app/api/orders/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/orders/order-1?token=not-a-uuid"),
      params("order-1")
    );

    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not leak the difference between a wrong token and a missing order", async () => {
    rpc.mockResolvedValue({ data: { error: "order_not_found" }, error: null });

    const { GET } = await import("@/app/api/orders/[id]/route");
    const res = await GET(
      new Request(`http://localhost/api/orders/order-1?token=${TOKEN}`),
      params("order-1")
    );

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pesanan tidak ditemukan");
  });
});

describe("POST /api/orders/[id]/payment", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("records a cash choice against the order", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    const { POST } = await import("@/app/api/orders/[id]/payment/route");
    const res = await POST(
      new Request("http://localhost/api/orders/order-1/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderToken: TOKEN, method: "cash" }),
      }),
      params("order-1")
    );

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("set_order_payment_method", {
      p_order_id: "order-1",
      p_token: TOKEN,
      p_method: "cash",
    });
  });

  it("refuses to let the customer declare the order paid", async () => {
    const { POST } = await import("@/app/api/orders/[id]/payment/route");

    for (const method of ["paid", "qris", "settled", ""]) {
      const res = await POST(
        new Request("http://localhost/api/orders/order-1/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderToken: TOKEN, method }),
        }),
        params("order-1")
      );
      expect(res.status).toBe(400);
    }

    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces a locked payment as a conflict instead of a silent success", async () => {
    rpc.mockResolvedValue({ data: { error: "payment_locked" }, error: null });

    const { POST } = await import("@/app/api/orders/[id]/payment/route");
    const res = await POST(
      new Request("http://localhost/api/orders/order-1/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderToken: TOKEN, method: "cash" }),
      }),
      params("order-1")
    );

    expect(res.status).toBe(409);
  });
});

describe("POST /api/payment/webhook", () => {
  const rpc2 = vi.fn();
  const update = vi.fn();
  const eq2 = vi.fn();
  const from2 = vi.fn();
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = "server-key";
    eq2.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    update.mockReturnValue({ eq: eq2 });
    from2.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { total: 40000, payment_status: "pending" } }) }) }),
      update,
    });
    rpc2.mockResolvedValue({ data: { ok: true }, error: null });
    vi.doMock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: from2, rpc: rpc2 } }));
  });

  async function post(payload: Record<string, unknown>) {
    const { POST } = await import("@/app/api/payment/webhook/route");
    return POST(new Request("http://localhost/api/payment/webhook", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
  }

  function sig(order_id: string, status_code: string, gross_amount: string) {
    return createHash("sha512").update(`${order_id}${status_code}${gross_amount}server-key`).digest("hex");
  }

  it("confirms and stores the real payment method on settlement", async () => {
    const res = await post({
      order_id: "order-1", status_code: "200", gross_amount: "40000.00",
      signature_key: sig("order-1", "200", "40000.00"),
      transaction_status: "settlement", payment_type: "gopay",
    });
    expect(res.status).toBe(200);
    expect(rpc2).toHaveBeenCalledWith("confirm_order", { p_order_id: "order-1" });
    const setPaid = update.mock.calls.find((c) => c[0].payment_status === "paid");
    expect(setPaid?.[0].payment_method).toBe("gopay");
  });

  it("rejects a forged signature without touching the order", async () => {
    const res = await post({
      order_id: "order-1", status_code: "200", gross_amount: "40000.00",
      signature_key: "forged", transaction_status: "settlement", payment_type: "qris" });
    expect(res.status).toBe(401);
    expect(rpc2).not.toHaveBeenCalled();
  });

  it("still marks the order paid but forces it visible to the kitchen when stock ran out", async () => {
    rpc2.mockResolvedValue({
      data: { error: "insufficient_inventory", unavailableMenus: ["Nasi"] },
      error: null,
    });

    const res = await post({
      order_id: "order-1", status_code: "200", gross_amount: "40000.00",
      signature_key: sig("order-1", "200", "40000.00"),
      transaction_status: "settlement", payment_type: "gopay",
    });

    expect(res.status).toBe(200);
    const setPaid = update.mock.calls.find((c) => c[0].payment_status === "paid");
    expect(setPaid).toBeTruthy();
    const forceReceived = update.mock.calls.find((c) => c[0].status === "received");
    expect(forceReceived).toBeTruthy();
  });

  it("does not mark the order paid and returns 502 when confirm_order transport fails", async () => {
    rpc2.mockResolvedValue({ data: null, error: { message: "db down" } });

    const res = await post({
      order_id: "order-1", status_code: "200", gross_amount: "40000.00",
      signature_key: sig("order-1", "200", "40000.00"),
      transaction_status: "settlement", payment_type: "gopay",
    });

    expect(res.status).toBe(502);
    const setPaid = update.mock.calls.find((c) => c[0].payment_status === "paid");
    expect(setPaid).toBeUndefined();
  });
});
