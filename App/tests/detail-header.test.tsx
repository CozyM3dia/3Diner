/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DetailHeader from "../src/components/DetailHeader";

const { useCartMock } = vi.hoisted(() => ({
  useCartMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/cart", () => ({
  useCart: () => useCartMock(),
}));

describe("DetailHeader", () => {
  beforeEach(() => {
    useCartMock.mockReturnValue({ count: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("snaps the dish page to the top without smooth scrolling", () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    document.documentElement.style.scrollBehavior = "smooth";

    render(<DetailHeader cafeName="Senja Kopi" slug="senja-kopi" />);

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.documentElement.style.scrollBehavior).toBe("smooth");
  });
});
