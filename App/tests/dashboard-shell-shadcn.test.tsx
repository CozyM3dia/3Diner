// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardShell from "../src/components/dashboard/DashboardShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

// jsdom tidak punya matchMedia — dibutuhkan Sonner/Radix saat render.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

const NAV_HREFS = [
  "/dashboard",
  "/dashboard/revenue",
  "/dashboard/orders",
  "/dashboard/menu",
  "/dashboard/inventory",
  "/dashboard/announcements",
  "/dashboard/scheduler",
  "/dashboard/settings",
];

function renderShell() {
  return render(
    <DashboardShell cafe={{ nama_cafe: "Senja Kopi", logo_url: null, slug_url: "senja-kopi" }}>
      <p>isi</p>
    </DashboardShell>
  );
}

describe("DashboardShell on shadcn foundation", () => {
  afterEach(cleanup);

  it("keeps all 8 dashboard nav routes reachable", () => {
    renderShell();
    for (const href of NAV_HREFS) {
      const links = document.querySelectorAll(`a[href="${href}"]`);
      expect(links.length, href).toBeGreaterThanOrEqual(1);
    }
  });

  it("mounts exactly one Sonner toaster region", () => {
    renderShell();
    expect(document.querySelectorAll("section[aria-label*='Notifications' i], ol[data-sonner-toaster], [data-sonner-toaster]").length).toBe(1);
  });

  it("gives the mobile menu trigger an accessible name and 44px target", () => {
    renderShell();
    const btn = screen.getByRole("button", { name: "Buka menu navigasi" });
    expect(btn).toBeTruthy();
    expect((btn as HTMLElement).style.minHeight).toBe("44px");
  });

  it("marks the active route with aria-current", () => {
    renderShell();
    const active = document.querySelector('a[aria-current="page"]') as HTMLAnchorElement;
    expect(active).toBeTruthy();
    expect(active.getAttribute("href")).toBe("/dashboard");
  });
});
