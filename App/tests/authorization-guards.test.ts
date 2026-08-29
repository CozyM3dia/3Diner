import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffContext = vi.fn();

vi.mock("@/lib/staff-context", () => ({ getStaffContext }));

// requireStaffPermission kini membaca matriks efektif (bawaan kode + override
// per-kafe). Di unit test, matriksnya di-mock sama dengan bawaan kode.
vi.mock("@/lib/role-permissions", () => ({
  getEffectivePermissions: vi.fn(async () => ({
    matrix: {
      operate_orders: { owner: true, cashier: true, override: false },
      manage_menu: { owner: true, cashier: false, override: false },
      manage_inventory: { owner: true, cashier: false, override: false },
      manage_settings: { owner: true, cashier: false, override: false },
    },
    tableMissing: false,
  })),
}));

describe("authorization guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an active owner for owner cafe access", async () => {
    getStaffContext.mockResolvedValue({
      cafe_id: "cafe-1",
      role: "cashier",
      is_active: true,
      user_id: "user-1",
    });

    const { requireOwnerCafe } = await import("@/lib/authorization");
    await expect(requireOwnerCafe()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects inactive staff even when the session identity remains valid", async () => {
    getStaffContext.mockResolvedValue({
      cafe_id: "cafe-1",
      role: "owner",
      is_active: false,
      user_id: "user-1",
    });

    const { requireOwnerCafe } = await import("@/lib/authorization");
    await expect(requireOwnerCafe()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires a permission appropriate to the active staff role", async () => {
    getStaffContext.mockResolvedValue({
      cafe_id: "cafe-1",
      role: "cashier",
      is_active: true,
      user_id: "user-1",
    });

    const { requireStaffPermission } = await import("@/lib/authorization");
    await expect(requireStaffPermission("manage_menu")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireStaffPermission("operate_orders")).resolves.toMatchObject({ cafeId: "cafe-1" });
  });
});
