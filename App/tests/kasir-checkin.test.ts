import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  tooManyRequests: () => Response.json({ error: "rate" }, { status: 429 }),
}));
vi.mock("@/lib/staff-context", () => ({ getStaffCafeId: vi.fn(async () => "cafe-1") }));

describe("POST /api/kasir/checkin", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it("checks in a valid order", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    const { POST } = await import("@/app/api/kasir/checkin/route");
    const res = await POST(new Request("http://localhost/api/kasir/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", checkinCode: "ABCD2345" }) }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("checkin_order", {
      p_cafe_id: "cafe-1", p_order_id: "order-1", p_checkin_code: "ABCD2345" });
  });

  it("rejects an invalid code as 404 without leaking why", async () => {
    rpc.mockResolvedValue({ data: { error: "checkin_invalid" }, error: null });
    const { POST } = await import("@/app/api/kasir/checkin/route");
    const res = await POST(new Request("http://localhost/api/kasir/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", checkinCode: "WRONG000" }) }));
    expect(res.status).toBe(404);
  });

  it("surfaces stock shortage at check-in as a conflict", async () => {
    rpc.mockResolvedValue({ data: { error: "insufficient_inventory", unavailableMenus: ["Nasi"] }, error: null });
    const { POST } = await import("@/app/api/kasir/checkin/route");
    const res = await POST(new Request("http://localhost/api/kasir/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", checkinCode: "ABCD2345" }) }));
    expect(res.status).toBe(409);
  });
});
