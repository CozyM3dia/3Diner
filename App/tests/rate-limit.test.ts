import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { rpc } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function allowed(count = 1) {
  return {
    data: { allowed: true, count, limit: 10, reset_at: "2026-07-23T12:00:30.000Z" },
    error: null,
  };
}

function blocked(count = 11) {
  return {
    data: { allowed: false, count, limit: 10, reset_at: "2026-07-23T12:00:30.000Z" },
    error: null,
  };
}

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", async () => {
    const { clientIp } = await import("@/lib/rate-limit");
    const req = new Request("http://localhost/api/orders", {
      headers: { "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" },
    });

    expect(clientIp(req)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then to a constant bucket", async () => {
    const { clientIp } = await import("@/lib/rate-limit");

    expect(
      clientIp(new Request("http://localhost/", { headers: { "x-real-ip": "198.51.100.4" } }))
    ).toBe("198.51.100.4");
    expect(clientIp(new Request("http://localhost/"))).toBe("unknown");
  });
});

describe("consumeRateLimit", () => {
  it("passes the bucket, limit and window to the RPC", async () => {
    rpc.mockResolvedValue(allowed());
    const { consumeRateLimit } = await import("@/lib/rate-limit");

    const result = await consumeRateLimit("orders:ip:203.0.113.9", 10, 60);

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "orders:ip:203.0.113.9",
      p_limit: 10,
      p_window_seconds: 60,
    });
    expect(result.allowed).toBe(true);
  });

  it("reports a blocked request with a retry hint", async () => {
    rpc.mockResolvedValue(blocked());
    const { consumeRateLimit } = await import("@/lib/rate-limit");

    const result = await consumeRateLimit("orders:ip:203.0.113.9", 10, 60);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails open when the limiter itself is unavailable", async () => {
    // Memblokir pesanan pelanggan karena tabel limiter bermasalah lebih buruk
    // daripada melewatkan beberapa permintaan.
    rpc.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    const { consumeRateLimit } = await import("@/lib/rate-limit");

    await expect(consumeRateLimit("orders:ip:1.2.3.4", 10, 60)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("fails open when the RPC throws", async () => {
    rpc.mockRejectedValue(new Error("connection reset"));
    const { consumeRateLimit } = await import("@/lib/rate-limit");

    await expect(consumeRateLimit("orders:ip:1.2.3.4", 10, 60)).resolves.toMatchObject({
      allowed: true,
    });
  });
});

describe("consumeRateLimits", () => {
  it("checks several buckets in one RPC call", async () => {
    rpc.mockResolvedValue(allowed());
    const { consumeRateLimits } = await import("@/lib/rate-limit");

    const result = await consumeRateLimits(
      [
        { key: "orders:ip:203.0.113.9", limit: 10 },
        { key: "orders:cafe:cafe-1", limit: 120 },
      ],
      60
    );

    expect(rpc).toHaveBeenCalledWith("consume_rate_limits", {
      p_keys: ["orders:ip:203.0.113.9", "orders:cafe:cafe-1"],
      p_limits: [10, 120],
      p_window_seconds: 60,
    });
    expect(result.allowed).toBe(true);
  });

  it("reports the blocking bucket's retry hint", async () => {
    rpc.mockResolvedValue(blocked());
    const { consumeRateLimits } = await import("@/lib/rate-limit");

    const result = await consumeRateLimits([{ key: "orders:ip:203.0.113.9", limit: 10 }], 60);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails open when the limiter is unavailable", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    const { consumeRateLimits } = await import("@/lib/rate-limit");

    await expect(consumeRateLimits([{ key: "orders:ip:1.2.3.4", limit: 10 }], 60)).resolves.toMatchObject({
      allowed: true,
    });
  });
});

describe("POST /api/orders rate limiting", () => {
  const validBody = {
    cafeId: "cafe-1",
    table: "12",
    items: [{ id_menu: "menu-1", qty: 1 }],
  };

  function orderRequest(): Request {
    return new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify(validBody),
    });
  }

  it("returns 429 and never reaches the order RPC when over the limit", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "consume_rate_limits") return Promise.resolve(blocked());
      throw new Error(`unexpected RPC: ${fn}`);
    });
    const { POST } = await import("@/app/api/orders/route");

    const response = await POST(orderRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(rpc).not.toHaveBeenCalledWith("create_order_with_inventory", expect.anything());
  });

  it("creates the order when under the limit", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "consume_rate_limits") return Promise.resolve(allowed());
      return Promise.resolve({
        data: {
          order: {
            id_order: "order-1",
            cafe_id: "cafe-1",
            table_number: "12",
            items: [{ id_menu: "menu-1", nama_menu: "Kopi", harga_menu: 20000, qty: 1 }],
            total: 20000,
            status: "received",
          },
          orderToken: "token-1",
        },
        error: null,
      });
    });
    const { POST } = await import("@/app/api/orders/route");

    const response = await POST(orderRequest());

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_order_with_inventory", expect.anything());
  });

  it("rejects malformed input before spending a rate-limit slot", async () => {
    rpc.mockResolvedValue(allowed());
    const { POST } = await import("@/app/api/orders/route");

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId: " ", table: " ", items: [] }),
      })
    );

    expect(response.status).toBe(400);
  });
});
