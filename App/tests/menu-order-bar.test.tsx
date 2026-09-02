/**
 * @vitest-environment jsdom
 */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Menu3DTransitionLink from "../src/components/Menu3DTransitionLink";
import MenuOrderPanel from "../src/components/MenuOrderPanel";
import {
  MENU_ORDER_BAR_CHROME_PX,
  MENU_ORDER_BAR_SPACE_PX,
  menuOrderBarSpacerStyle,
} from "../src/lib/menu-order-bar";
import type { Menu } from "../src/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; scroll?: boolean }
  >(function TestLink({ href, scroll, ...props }, ref) {
    void scroll;
    return <a ref={ref} href={href} {...props} />;
  }),
}));

vi.mock("@/lib/cart", () => ({
  useCart: () => ({
    items: [],
    count: 0,
    total: 0,
    add: vi.fn(),
    setQty: vi.fn(),
  }),
}));

vi.mock("@/lib/log-event", () => ({
  logEvent: vi.fn(),
}));

function clearsStickyBarAtMaxScroll({
  viewportHeight,
  contentBottom,
  reservedSpace,
  barHeight,
}: {
  viewportHeight: number;
  contentBottom: number;
  reservedSpace: number;
  barHeight: number;
}): boolean {
  const documentHeight = contentBottom + reservedSpace;
  const maxScroll = Math.max(0, documentHeight - viewportHeight);
  const contentBottomAtMaxScroll = contentBottom - maxScroll;
  const barTop = viewportHeight - barHeight;
  return contentBottomAtMaxScroll <= barTop;
}

const steak: Menu = {
  id_menu: "9f877ed3-98f5-4192-824a-d2855b39c7f2",
  cafe_id: "cafe-1",
  nama_menu: "Steak Generate 2",
  harga_menu: 50_000,
  description_menu: "Potongan daging sapi premium.",
  model_3d_url: "https://example.test/steak.glb",
  redirect_link: "",
  created_at: "2026-01-01",
  is_active: true,
};

describe("dish-detail order bar vs 3D CTA", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the CSS token in sync with the JS reservation and a pixel spacer", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain(
      `--menu-order-bar-space: calc(env(safe-area-inset-bottom, 0px) + ${MENU_ORDER_BAR_SPACE_PX}px)`,
    );
    expect(css).toMatch(new RegExp(`\\.menu-order-bar-spacer\\s*\\{[^}]*height:\\s*${MENU_ORDER_BAR_SPACE_PX}px`));
    expect(css).toMatch(/\.menu-order-bar-spacer\s*\{[^}]*padding-bottom:\s*env\(safe-area-inset-bottom/);
  });

  it("reserves more in-flow space than the sticky bar chrome", () => {
    expect(MENU_ORDER_BAR_SPACE_PX).toBeGreaterThanOrEqual(MENU_ORDER_BAR_CHROME_PX + 16);
    expect(menuOrderBarSpacerStyle().height).toBe(`${MENU_ORDER_BAR_SPACE_PX}px`);
    expect(menuOrderBarSpacerStyle().height).not.toContain("--menu-order-bar-space");
    expect(menuOrderBarSpacerStyle().paddingBottom).toContain("safe-area-inset-bottom");
  });

  it("places a real-height spacer below the 3D CTA and above the overlay bar", () => {
    render(
      <>
        <Menu3DTransitionLink
          href="/senja-kopi/steak/3d"
          heroId="menu-detail-hero"
          imageUrl="/steak.jpg"
          menuName="Steak Generate 2"
        />
        <MenuOrderPanel menu={steak} slug="senja-kopi" optionGroups={[]} />
      </>,
    );

    const cta = screen.getByRole("link", { name: "Lihat Model 3D" });
    const spacer = document.querySelector("[data-menu-order-bar-spacer]");
    const bar = document.querySelector("[data-menu-order-bar]");
    const addButton = screen.getByRole("button", { name: /Tambah ke Pesanan/ });

    expect(spacer).toBeInstanceOf(HTMLElement);
    expect(bar).toBeInstanceOf(HTMLElement);
    expect(cta.compareDocumentPosition(spacer as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((spacer as Node).compareDocumentPosition(bar as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((spacer as HTMLElement).style.height).toBe(`${MENU_ORDER_BAR_SPACE_PX}px`);
    expect((spacer as HTMLElement).style.height).not.toContain("--");
    expect((spacer as HTMLElement).style.boxSizing).toBe("content-box");
    expect((spacer as HTMLElement).className).toContain("menu-order-bar-spacer");
    expect(addButton.closest("[data-menu-order-bar]")).toBe(bar);
  });

  it("clears the 3D CTA on the QA 1024×656 viewport at max scroll", () => {
    // Live regression: CTA top 604 / bottom 656, bar top 579, scrollY 41.
    const viewportHeight = 656;
    const barHeight = 656 - 579;
    const contentBottom = 604 + 41 + 52;

    expect(
      clearsStickyBarAtMaxScroll({
        viewportHeight,
        contentBottom,
        reservedSpace: 0,
        barHeight,
      }),
    ).toBe(false);

    expect(
      clearsStickyBarAtMaxScroll({
        viewportHeight,
        contentBottom,
        reservedSpace: MENU_ORDER_BAR_SPACE_PX,
        barHeight,
      }),
    ).toBe(true);
  });

  it("clears the 3D CTA on a short mobile viewport at max scroll", () => {
    const viewportHeight = 844;
    const barHeight = MENU_ORDER_BAR_CHROME_PX;
    // CTA sitting on the last in-flow pixels before reservation.
    const contentBottom = 820;

    expect(
      clearsStickyBarAtMaxScroll({
        viewportHeight,
        contentBottom,
        reservedSpace: 0,
        barHeight,
      }),
    ).toBe(false);

    expect(
      clearsStickyBarAtMaxScroll({
        viewportHeight,
        contentBottom,
        reservedSpace: MENU_ORDER_BAR_SPACE_PX,
        barHeight,
      }),
    ).toBe(true);
  });
});
