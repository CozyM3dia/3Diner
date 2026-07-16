/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Menu3DTransitionLink from "../src/components/Menu3DTransitionLink";

const { routerPush, timeline, timelineCall, timelineFromTo, timelineTo } = vi.hoisted(() => {
  const call = vi.fn((_callback: () => void) => {
    _callback();
    return timeline;
  });
  const fromTo = vi.fn(() => timeline);
  const to = vi.fn(() => timeline);
  const timeline = { call, fromTo, kill: vi.fn(), to };

  return {
    routerPush: vi.fn(),
    timeline,
    timelineCall: call,
    timelineFromTo: fromTo,
    timelineTo: to,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("next/link", () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >(function TestLink({ href, onClick, ...props }, ref) {
    return (
      <a
        ref={ref}
        href={href}
        onClick={onClick}
        {...props}
      />
    );
  }),
}));

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    timeline: vi.fn(() => timeline),
  },
}));

vi.mock("@gsap/react", () => ({
  useGSAP: (callback: () => void | (() => void)) => {
    React.useEffect(callback, [callback]);
    return {
      contextSafe: <T extends (...args: never[]) => unknown>(handler: T) => handler,
    };
  },
}));

function renderLink(reducedMotion = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reducedMotion }),
  );

  const hero = document.createElement("div");
  hero.id = "menu-hero";
  hero.getBoundingClientRect = vi.fn().mockReturnValue({
    bottom: 260,
    height: 220,
    left: 16,
    right: 336,
    top: 40,
    width: 320,
    x: 16,
    y: 40,
  });
  document.body.appendChild(hero);

  render(
    <Menu3DTransitionLink
      href="/kopi/pasta/3d"
      heroId="menu-hero"
      imageUrl="/pasta.jpg"
      menuName="Pasta Meatball"
    />,
  );
}

describe("Menu3DTransitionLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("animates a hidden portal and routes during the final timeline segment", async () => {
    renderLink();

    await userEvent.click(screen.getByRole("link", { name: "Lihat Model 3D" }));

    const portal = document.querySelector('[data-menu-3d-portal="true"]');
    expect(portal?.getAttribute("aria-hidden")).toBe("true");
    expect(portal?.textContent).toContain("Pasta Meatball");
    expect(timelineTo).toHaveBeenCalled();
    expect(timelineFromTo).toHaveBeenCalled();
    expect(timelineCall).toHaveBeenCalled();
    expect(sessionStorage.getItem("3diner:viewer-transition")).toBe("true");
    expect(routerPush).toHaveBeenCalledWith("/kopi/pasta/3d");
  });

  it("routes immediately without a portal when reduced motion is preferred", async () => {
    renderLink(true);

    await userEvent.click(screen.getByRole("link", { name: "Lihat Model 3D" }));

    expect(document.querySelector('[data-menu-3d-portal="true"]')).toBeNull();
    expect(timelineTo).not.toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith("/kopi/pasta/3d");
  });

  it("preserves modified clicks for native link navigation", () => {
    renderLink();
    const link = screen.getByRole("link", { name: "Lihat Model 3D" });
    let defaultPreventedByComponent: boolean | undefined;
    document.addEventListener("click", (clickEvent) => {
      defaultPreventedByComponent = clickEvent.defaultPrevented;
      clickEvent.preventDefault();
    }, {
      once: true,
    });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });

    link.dispatchEvent(event);

    expect(defaultPreventedByComponent).toBe(false);
    expect(timelineTo).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });
});
