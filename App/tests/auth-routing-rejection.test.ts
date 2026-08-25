import { describe, expect, it, vi, beforeEach } from "vitest";

const getStaffContext = vi.fn();

vi.mock("@/lib/staff-context", () => ({ getStaffContext }));

describe("resolveHomeRoute: tiga alasan penolakan terpisah", () => {
  let resolveHomeRoute: typeof import("@/lib/auth-routing").resolveHomeRoute;

  beforeEach(async () => {
    vi.resetModules();
    ({ resolveHomeRoute } = await import("@/lib/auth-routing"));
    getStaffContext.mockReset();
  });

  it("owner aktif pulang ke konsolnya", async () => {
    getStaffContext.mockResolvedValue({ role: "owner", is_active: true });
    expect(await resolveHomeRoute()).toEqual({ home: "/dashboard", reason: null });
  });

  it("kasir aktif pulang ke /kasir", async () => {
    getStaffContext.mockResolvedValue({ role: "cashier", is_active: true });
    expect(await resolveHomeRoute()).toEqual({ home: "/kasir", reason: null });
  });

  it("bukan staf → alasan bukan-staf (bukan gagal-muat)", async () => {
    getStaffContext.mockResolvedValue({ role: null });
    expect(await resolveHomeRoute()).toEqual({ home: null, reason: "bukan-staf" });
  });

  it("staf nonaktif → alasan nonaktif", async () => {
    getStaffContext.mockResolvedValue({ role: "cashier", is_active: false });
    expect(await resolveHomeRoute()).toEqual({ home: null, reason: "nonaktif" });
  });

  it("RPC gagal → alasan gagal-muat, dan BUKAN dianggap bukan staf", async () => {
    // Inilah perbaikan kontrak §7 dkk.: kegagalan database tidak boleh
    // mengusir orang dengan pesan "kamu bukan staf".
    getStaffContext.mockResolvedValue({ role: null, error: true });
    expect(await resolveHomeRoute()).toEqual({ home: null, reason: "gagal-muat" });
  });
});
