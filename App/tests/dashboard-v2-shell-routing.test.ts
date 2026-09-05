import { describe, expect, it } from "vitest";

import { resolveShellRoute } from "@/components/dp/Shell";

describe("route state Dashboard v2", () => {
  it.each([
    ["/dashboard-v2/penjualan", "Ringkasan", "Penjualan"],
    ["/dashboard-v2/panduan", "Bantuan", "Panduan"],
  ])("memberi breadcrumb khusus untuk %s tanpa menyalakan Dashboard", (path, section, label) => {
    expect(resolveShellRoute(path)).toEqual({ section, label, activeHref: null });
  });

  it("memilih Item untuk editor menu baru dan editor item bersarang", () => {
    expect(resolveShellRoute("/dashboard-v2/menu/new")).toEqual({
      section: "Menu",
      label: "Item baru",
      activeHref: "/dashboard-v2/items",
    });
    expect(resolveShellRoute("/dashboard-v2/menu/menu-123/edit")).toEqual({
      section: "Menu",
      label: "Edit item",
      activeHref: "/dashboard-v2/items",
    });
  });

  it("memakai exact match untuk Dashboard root", () => {
    expect(resolveShellRoute("/dashboard-v2").activeHref).toBe("/dashboard-v2");
    expect(resolveShellRoute("/dashboard-v2/rute-tidak-dikenal")).toEqual({
      section: null,
      label: null,
      activeHref: null,
    });
  });

  it("memilih rute Pengaturan terpanjang tanpa menyalakan item induknya", () => {
    expect(resolveShellRoute("/dashboard-v2/pengaturan")).toEqual({
      section: "Pengaturan",
      label: "Toko & QR Menu",
      activeHref: "/dashboard-v2/pengaturan",
    });
    expect(resolveShellRoute("/dashboard-v2/pengaturan/pajak/rincian")).toEqual({
      section: "Pengaturan",
      label: "Pajak",
      activeHref: "/dashboard-v2/pengaturan/pajak",
    });
    expect(resolveShellRoute("/dashboard-v2/pengaturan/qr")).toEqual({
      section: "Pengaturan",
      label: "QR Smart Menu",
      activeHref: "/dashboard-v2/pengaturan",
    });
  });
});
