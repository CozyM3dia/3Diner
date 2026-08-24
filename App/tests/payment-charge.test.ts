import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const from = vi.fn();
const update = vi.fn();

type PaymentUpdatePatch = {
  payment_status?: string;
  payment_qr_url?: string | null;
  payment_transaction_id?: string | null;
  payment_idempotency_key?: string | null;
};

function updateChain(result: { data: unknown[] | null; error: unknown }) {
  const query: {
    eq: () => typeof query;
    in: () => typeof query;
    select: () => Promise<typeof result>;
  } = {
    eq: () => query,
    in: () => query,
    select: async () => result,
  };
  return query;
}

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
        status: "awaiting",
        payment_status: "awaiting_payment",
        payment_qr_url: null, payment_transaction_id: null, payment_idempotency_key: null,
        items: [{ id_menu: "m1", nama_menu: "Nasi", harga_menu: 20000, qty: 2 }],
      },
      error: null,
    });
    const eqToken = () => ({ maybeSingle: single });
    const eqOrder = () => ({ eq: eqToken });
    // The claim and QR persistence updates chain `.select()` so the route can
    // verify that the expected row was changed. The chain accepts any number
    // of compare-and-set filters used by the route.
    update.mockImplementation((patch: PaymentUpdatePatch) => updateChain({
      data: patch.payment_status === "pending"
        ? [{ id_order: "order-1", payment_idempotency_key: patch.payment_idempotency_key }]
        : [{
          id_order: "order-1",
          payment_qr_url: patch.payment_qr_url,
          payment_transaction_id: patch.payment_transaction_id,
        }],
      error: null,
    }));
    from.mockReturnValue({
      select: () => ({ eq: eqOrder }),
      update,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        status_code: "201",
        transaction_id: "tx-1",
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
    expect((call[1]?.headers as Record<string, string>)["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("includes stored service and tax lines so QRIS item details reconcile to gross amount", async () => {
    single.mockResolvedValue({
      data: {
        id_order: "order-1", customer_token: "token-1", total: 45000, subtotal: 40000,
        status: "awaiting",
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
        status: "awaiting",
        payment_status: "pending",
        payment_qr_url: "https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code",
        payment_transaction_id: "tx-1",
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

  it("returns a stored QRIS URL even when a new server key is unavailable", async () => {
    single.mockResolvedValue({
      data: {
        id_order: "order-1", customer_token: "token-1", total: 40000,
        status: "awaiting",
        payment_status: "pending",
        payment_qr_url: "https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code",
        payment_transaction_id: "tx-1",
        items: [],
      },
      error: null,
    });
    delete process.env.MIDTRANS_SERVER_KEY;
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

  it("retries an ambiguous charge with the same Midtrans idempotency key", async () => {
    const responseBody = JSON.stringify({
      status_code: "201",
      transaction_id: "tx-retried",
      payment_type: "qris",
      transaction_status: "pending",
      actions: [{
        name: "generate-qr-code-v2",
        url: "https://api.sandbox.midtrans.com/v4/qris/tx-retried/qr-code",
      }],
    });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(responseBody, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/payment/charge/route");
    const firstResponse = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(firstResponse.status).toBe(502);

    const firstKey = new Headers(fetchMock.mock.calls[0][1]?.headers as HeadersInit).get("Idempotency-Key");
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/);
    single.mockResolvedValue({
      data: {
        id_order: "order-1", customer_token: "token-1", total: 40000,
        status: "awaiting",
        payment_status: "pending", payment_qr_url: null,
        payment_transaction_id: null, payment_idempotency_key: firstKey,
        items: [{ id_menu: "m1", nama_menu: "Nasi", harga_menu: 20000, qty: 2 }],
      },
      error: null,
    });

    const retryResponse = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(retryResponse.status).toBe(200);
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers as HeadersInit).get("Idempotency-Key")).toBe(firstKey);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.sandbox.midtrans.com/v2/charge");
    expect(fetchMock.mock.calls[3][0]).toBe("https://api.sandbox.midtrans.com/v2/charge");
  });

  it("reconciles a pending QR when its stored URL has no transaction identity", async () => {
    single.mockResolvedValue({
      data: {
        id_order: "order-1", customer_token: "token-1", total: 40000,
        status: "awaiting",
        payment_status: "pending",
        payment_qr_url: "https://api.sandbox.midtrans.com/v4/qris/legacy/qr-code",
        payment_transaction_id: null, payment_idempotency_key: "attempt-1", items: [],
      },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status_code: "200", transaction_id: "tx-reconciled", payment_type: "qris",
      transaction_status: "pending",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/payment/charge/route");
    const response = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).qris_url).toBe(
      "https://api.sandbox.midtrans.com/v2/qris/tx-reconciled/qr-code"
    );
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.sandbox.midtrans.com/v2/order-1/status");
  });

  it("releases a definitively rejected 4xx attempt with a compare-and-set reset", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status_code: "400", status_message: "Invalid gross amount", payment_type: "qris",
    }), { status: 400, headers: { "Content-Type": "application/json" } })));

    const { POST } = await import("@/app/api/payment/charge/route");
    const response = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));

    expect(response.status).toBe(400);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      payment_status: "awaiting_payment",
      payment_idempotency_key: null,
    }));
  });

  it("rejects a missing customer token", async () => {
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1" }),
    }));
    expect(res.status).toBe(400);
  });

  it("keeps the pending claim when the Midtrans response is ambiguous", async () => {
    const updateMock = vi.fn((patch?: PaymentUpdatePatch) => updateChain({
      data: patch?.payment_status === "pending"
        ? [{ id_order: "order-1", payment_idempotency_key: patch.payment_idempotency_key }]
        : [],
      error: patch?.payment_status === "pending" ? null :
        patch?.payment_qr_url !== undefined ? { message: "not used" } : null,
    }));
    const eqToken = () => ({ maybeSingle: single });
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
    expect(revertCall).toBeUndefined();
  });

  it("recovers the active QRIS transaction after a lost charge response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              status_code: "200",
              transaction_id: "tx-recovered",
              payment_type: "qris",
              transaction_status: "pending",
            }),
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
    expect((await res.json()).qris_url).toBe(
      "https://api.sandbox.midtrans.com/v2/qris/tx-recovered/qr-code"
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_qr_url: "https://api.sandbox.midtrans.com/v2/qris/tx-recovered/qr-code",
        payment_transaction_id: "tx-recovered",
      })
    );
  });

  it("does not report success when the QRIS URL cannot be persisted", async () => {
    const updateMock = vi.fn((patch: PaymentUpdatePatch) => updateChain({
      data: patch.payment_status === "pending"
        ? [{ id_order: "order-1", payment_idempotency_key: patch.payment_idempotency_key }]
        : [],
      error: patch.payment_status === "pending" ? null : { message: "db down" },
    }));
    const eqToken = () => ({ maybeSingle: single });
    const eqOrder = () => ({ eq: eqToken });
    from.mockReturnValue({
      select: () => ({ eq: eqOrder }),
      update: updateMock,
    });

    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(
      new Request("http://localhost/api/payment/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
      })
    );

    expect(res.status).toBe(502);
    expect((await res.json()).qris_url).toBeUndefined();
  });

  it("refuses a concurrent/retry charge when the claim finds nothing to claim, without calling Midtrans", async () => {
    // Order is still "awaiting_payment" per the initial select, but another request already
    // won the atomic claim race — the claim update matches 0 rows. The route must detect this
    // via .select() and bail with 409 before ever calling Midtrans or reverting anything.
    const updateMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({ in: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
      }),
    }));
    const eqToken = () => ({ maybeSingle: single });
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

  it("refuses to charge a cancelled order before contacting Midtrans", async () => {
    single.mockResolvedValue({ data: {
      id_order: "order-1", customer_token: "token-1", total: 40000,
      status: "cancelled", payment_status: "awaiting_payment", items: [],
    }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));

    expect(res.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not charge when cancellation wins after the read but before the pending claim", async () => {
    const select = vi.fn(async () => ({ data: [], error: null }));
    const activeStatus = vi.fn(() => ({ select }));
    const claim = { eq: () => claim, in: activeStatus };
    update.mockReturnValue(claim);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));

    expect(res.status).toBe(409);
    expect(activeStatus).toHaveBeenCalledWith("status", ["awaiting", "received", "preparing"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
