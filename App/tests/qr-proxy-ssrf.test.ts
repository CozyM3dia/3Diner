import { beforeEach, describe, expect, it, vi } from "vitest";

/** /api/payment/qr-proxy mengambil URL dari query lalu mem-fetch-nya di server
 *  dan mengembalikan isinya. Tanpa daftar host yang diizinkan, siapa pun bisa
 *  memakai server sebagai proxy ke alamat internal (SSRF). URL sah selalu
 *  berasal dari respons charge Midtrans (actions[0].url). */
const fetchSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    })
  );
});

function get(url: string): Request {
  return new Request(
    `http://localhost/api/payment/qr-proxy?url=${encodeURIComponent(url)}&orderId=order-1`
  );
}

const BLOCKED = [
  ["the AWS/GCP metadata service", "http://169.254.169.254/latest/meta-data/"],
  ["localhost", "http://127.0.0.1:3000/api/internal"],
  ["a private RFC1918 address", "http://10.0.0.5/admin"],
  ["an arbitrary external host", "https://evil.example.com/collect"],
  ["a file URL", "file:///etc/passwd"],
  ["a lookalike host", "https://api.midtrans.com.evil.example.com/qr"],
  ["a plain-HTTP Midtrans host", "http://api.midtrans.com/v2/qris/abc/qr-code"],
  ["a non-default Midtrans port", "https://api.midtrans.com:8443/v2/qris/abc/qr-code"],
] as const;

describe("GET /api/payment/qr-proxy", () => {
  it.each(BLOCKED)("refuses to fetch %s", async (_label, url) => {
    const { GET } = await import("@/app/api/payment/qr-proxy/route");

    const response = await GET(get(url));

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    "https://api.midtrans.com/v2/qris/abc-123/qr-code",
    "https://api.sandbox.midtrans.com/v2/qris/abc-123/qr-code",
  ])("proxies the Midtrans QR image at %s", async (url) => {
    const { GET } = await import("@/app/api/payment/qr-proxy/route");

    const response = await GET(get(url));

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(url, { redirect: "manual" });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toContain("QRIS-order-1.png");
  });

  it("still rejects a missing url", async () => {
    const { GET } = await import("@/app/api/payment/qr-proxy/route");

    const response = await GET(new Request("http://localhost/api/payment/qr-proxy"));

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not follow a redirect from a Midtrans QR endpoint", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example.com/redirected-qr" },
      })
    );

    const { GET } = await import("@/app/api/payment/qr-proxy/route");
    const response = await GET(get("https://api.midtrans.com/v2/qris/abc-123/qr-code"));

    expect(response.status).toBe(502);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.midtrans.com/v2/qris/abc-123/qr-code",
      { redirect: "manual" }
    );
  });
});
