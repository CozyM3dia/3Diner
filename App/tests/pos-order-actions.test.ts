import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ requireStaffPermission: mocks.auth }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
import { addLineToExistingOrder } from "@/lib/pos-order-actions";
const line = { id_menu: "82a22e34-d530-489a-8212-73eef5343dc2", nama_menu: "Coffee", harga_menu: 1, qty: 1, options: [], note: "Tanpa gula" };
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ cafeId: "cafe", userId: "actor" }); mocks.rpc.mockResolvedValue({ error: null }); });
describe("atomic POS amendment", () => {
  it("enforces permission and tenant before any mutation", async () => {
    expect((await addLineToExistingOrder("other", "order", [line])).error).toBeTruthy();
    expect(mocks.auth).toHaveBeenCalledWith("operate_orders");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes preparation notes and ignores client prices", async () => {
    expect(await addLineToExistingOrder("cafe", "order", [line])).toEqual({});
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("amend_pending_order", { p_cafe_id: "cafe", p_order_id: "order", p_actor: "actor", p_additions: [{ id_menu: line.id_menu, qty: 1, options: [], note: "Tanpa gula" }] });
  });
  it("rejects invalid quantities before mutation", async () => {
    expect((await addLineToExistingOrder("cafe", "order", [{ ...line, qty: -1 }])).error).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not offer an unsafe retry after a successful transaction and cache failure", async () => {
    mocks.invalidate.mockImplementation(() => { throw new Error("cache"); });
    expect(await addLineToExistingOrder("cafe", "order", [line])).toEqual({});
  });
  it("explains that a started order requires a new ticket", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "order_not_editable" } });
    expect((await addLineToExistingOrder("cafe", "order", [line])).error).toContain("Buat pesanan baru");
  });
});
