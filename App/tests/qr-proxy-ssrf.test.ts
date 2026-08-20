import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal("fetch", fetchSpy);
});

describe("GET /api/payment/qr-proxy", () => {
  it("rejects client-supplied provider URLs without fetching them", async () => {
    const { GET } = await import("@/app/api/payment/qr-proxy/route");
    const response = await GET(new Request(
      "http://localhost/api/payment/qr-proxy?url=https%3A%2F%2Fapi.midtrans.com%2Fqr&orderId=order-1"
    ));

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires an order-bound capability instead of a URL", async () => {
    const { GET } = await import("@/app/api/payment/qr-proxy/route");
    const response = await GET(new Request(
      "http://localhost/api/payment/qr-proxy?orderId=order-1"
    ));

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not expose upstream error details", async () => {
    const { GET } = await import("@/app/api/payment/qr-proxy/route");
    const response = await GET(new Request(
      "http://localhost/api/payment/qr-proxy?url=https%3A%2F%2Fapi.midtrans.com%2Fqr&orderId=order-1"
    ));

    expect(await response.json()).toEqual({ error: "QRIS tidak tersedia" });
  });
});
