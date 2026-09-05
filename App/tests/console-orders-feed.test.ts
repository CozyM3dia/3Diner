import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/staff-context", () => ({ getStaffContext: mocks.context, canOpenOwnerConsole: (r: string) => ["owner", "manager"].includes(r) }));
vi.mock("@/lib/console-orders-query", () => ({ loadConsoleOrders: mocks.load }));
import { GET } from "@/app/api/console/orders/route";
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue({ role: "owner", cafe_id: "own-cafe", is_active: true }); mocks.load.mockResolvedValue([]); });
it.each([null, "kitchen", "cashier", "staff"])("rejects role %s", async role => {
  mocks.context.mockResolvedValue({ role, cafe_id: "own-cafe" });
  expect((await GET()).status).toBe(403);
  expect(mocks.load).not.toHaveBeenCalled();
});
it("rejects inactive membership", async () => { mocks.context.mockResolvedValue({ role: "owner", cafe_id: "own-cafe", is_active: false }); expect((await GET()).status).toBe(403); });
it("uses session tenant and a private uncacheable response", async () => { const r = await GET(); expect(r.status).toBe(200); expect(mocks.load).toHaveBeenCalledWith("own-cafe"); expect(r.headers.get("Cache-Control")).toBe("private, no-store"); });
it("does not disguise database failure as zero orders", async () => { mocks.load.mockRejectedValue(new Error("db")); const r = await GET(); expect(r.status).toBe(503); expect(await r.json()).not.toHaveProperty("orders"); });
