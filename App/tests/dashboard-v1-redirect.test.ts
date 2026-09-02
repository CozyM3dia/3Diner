import { describe, expect, it } from "vitest";
import { dashboardV2Path } from "@/lib/dashboard-v1-redirect";

describe("dashboardV2Path", () => {
  it("mengalihkan konsol v1 ke v2", () => {
    expect(dashboardV2Path("/dashboard")).toBe("/dashboard-v2");
    expect(dashboardV2Path("/dashboard/")).toBe("/dashboard-v2");
    expect(dashboardV2Path("/dashboard/orders")).toBe("/dashboard-v2/pesanan");
    expect(dashboardV2Path("/dashboard/menu")).toBe("/dashboard-v2/items");
    expect(dashboardV2Path("/dashboard/menu/abc/edit")).toBe("/dashboard-v2/menu/abc/edit");
    expect(dashboardV2Path("/dashboard/settings")).toBe("/dashboard-v2/pengaturan");
    expect(dashboardV2Path("/dashboard/revenue")).toBe("/dashboard-v2/penjualan");
    expect(dashboardV2Path("/dashboard/inventory")).toBe("/dashboard-v2");
  });

  it("tidak menyentuh konsol v2 atau rute lain", () => {
    expect(dashboardV2Path("/dashboard-v2")).toBeNull();
    expect(dashboardV2Path("/dashboard-v2/pesanan")).toBeNull();
    expect(dashboardV2Path("/kasir")).toBeNull();
    expect(dashboardV2Path("/senja-kopi")).toBeNull();
  });
});
