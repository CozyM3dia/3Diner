// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard-v2" }));

import OwnerShell, { OWNER_ROUTES } from "@/components/dashboard-v2/OwnerShell";

// Tanpa setup file global, RTL tidak membersihkan DOM antar test.
afterEach(cleanup);

describe("OwnerShell navigasi responsif", () => {
  it("merender ketujuh rute OWNER_ROUTES sebagai link", () => {
    render(<OwnerShell title="Tes">isi</OwnerShell>);
    for (const r of OWNER_ROUTES) {
      expect(screen.getByRole("link", { name: r.label })).toBeTruthy();
    }
  });

  it("toggle membuka/menutup panel dengan aria-expanded akurat", () => {
    render(<OwnerShell title="Tes">isi</OwnerShell>);
    let toggle = screen.getByRole("button", { name: "Buka navigasi" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("owner-nav");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    // Label ikut berubah supaya pembaca layar tahu efek klik berikutnya.
    toggle = screen.getByRole("button", { name: "Tutup navigasi" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("Escape menutup panel yang sedang terbuka", () => {
    render(<OwnerShell title="Tes">isi</OwnerShell>);
    const toggle = screen.getByRole("button", { name: "Buka navigasi" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("klik link menandai rute aktif lewat aria-current", () => {
    render(<OwnerShell title="Tes">isi</OwnerShell>);
    const beranda = screen.getByRole("link", { name: "Beranda" });
    // pathname mock = /dashboard-v2 (exact match Beranda)
    expect(beranda.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Menu" }).getAttribute("aria-current")).toBeNull();
  });
});
