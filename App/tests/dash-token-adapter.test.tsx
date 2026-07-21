// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardShell from "../src/components/dashboard/DashboardShell";
import { DASH_PORTAL_ID } from "../src/components/dashboard/system/portal";

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

const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");

describe("dash token adapter", () => {
  afterEach(cleanup);

  it("mounts the dedicated portal root inside the shell with its own class", () => {
    render(<DashboardShell cafe={null}>{null}</DashboardShell>);
    const portal = document.getElementById(DASH_PORTAL_ID);
    expect(portal).toBeTruthy();
    expect(portal!.classList.contains("dash-portal-root")).toBe(true);
    // Dedicated class only — never a nested dashboard root.
    expect(portal!.classList.contains("dash-root")).toBe(false);
    // Portal root lives INSIDE the .dash-root wrapper so :has() rules still apply.
    expect(portal!.closest(".dash-root")).toBeTruthy();
  });

  it("scopes the shadcn variable adapter to dashboard selectors only", () => {
    expect(css).toMatch(/\.dash-root, \.dash-portal-root \{/);
    const adapter = css.slice(css.indexOf(".dash-root, .dash-portal-root {"));
    expect(adapter).toContain("--ring: var(--orange)");
    expect(adapter).toContain("--card: var(--dash-panel)");
    expect(adapter).toContain("--destructive: var(--semantic-danger)");
  });

  it("keeps customer light tokens intact after shadcn init", () => {
    expect(css).toContain("--border:       #CFD9E4");
    expect(css).toMatch(/--radius-2xl:\s*1rem/);
    expect(css).toMatch(/--font-sans:\s*var\(--font-poppins\)/);
  });
});
