import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getAuthCafeId = vi.fn();
const createImageToModelTask = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@/lib/dashboard-actions", () => ({ getAuthCafeId }));
vi.mock("@/lib/tripo", () => ({ createImageToModelTask }));

function generateRequest() {
  return new Request("http://localhost/api/tripo/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: "https://cdn.example.com/dish.jpg" }),
  });
}

describe("AI credit metering on /api/tripo/generate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getAuthCafeId.mockResolvedValue("cafe-1");
    createImageToModelTask.mockResolvedValue("task-1");
  });

  it("claims a credit before calling Tripo", async () => {
    rpc.mockResolvedValue({ data: { ok: true, quota: 5, used: 1, remaining: 4 }, error: null });

    const { POST } = await import("@/app/api/tripo/generate/route");
    const res = await POST(generateRequest());

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_ai_credit", { p_cafe_id: "cafe-1", p_amount: 1 });
    expect(createImageToModelTask).toHaveBeenCalledTimes(1);
  });

  it("refuses to call Tripo once the monthly quota is spent", async () => {
    rpc.mockResolvedValue({
      data: { error: "quota_exceeded", quota: 5, used: 5, remaining: 0 },
      error: null,
    });

    const { POST } = await import("@/app/api/tripo/generate/route");
    const res = await POST(generateRequest());

    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("quota_exceeded");
    expect(createImageToModelTask).not.toHaveBeenCalled();
  });

  it("refuses to call Tripo when the subscription lapsed", async () => {
    rpc.mockResolvedValue({ data: { error: "subscription_inactive" }, error: null });

    const { POST } = await import("@/app/api/tripo/generate/route");
    const res = await POST(generateRequest());

    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("subscription_inactive");
    expect(createImageToModelTask).not.toHaveBeenCalled();
  });

  it("fails closed when the credit counter itself is unreachable", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });

    const { POST } = await import("@/app/api/tripo/generate/route");
    const res = await POST(generateRequest());

    // Berbeda dari rate limiter yang fail-open: limiter rusak menolak pelanggan,
    // penghitung credit rusak membakar uang.
    expect(res.status).toBe(503);
    expect(createImageToModelTask).not.toHaveBeenCalled();
  });

  it("returns the credit when Tripo rejects the job", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "consume_ai_credit"
        ? { data: { ok: true, quota: 5, used: 1, remaining: 4 }, error: null }
        : { data: { ok: true }, error: null }
    );
    createImageToModelTask.mockRejectedValue(new Error("tripo down"));

    const { POST } = await import("@/app/api/tripo/generate/route");
    const res = await POST(generateRequest());

    expect(res.status).toBe(502);
    expect(rpc).toHaveBeenCalledWith("refund_ai_credit", { p_cafe_id: "cafe-1", p_amount: 1 });
  });

  it("still rejects an unauthenticated caller before touching credits", async () => {
    getAuthCafeId.mockResolvedValue(null);

    const { POST } = await import("@/app/api/tripo/generate/route");
    const res = await POST(generateRequest());

    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});
