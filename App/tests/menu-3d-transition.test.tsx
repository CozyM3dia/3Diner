/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Menu3DTransitionLink from "../src/components/Menu3DTransitionLink";

const { routerPush, timeline, timelineCall, timelineFromTo, timelineSet, timelineTo } = vi.hoisted(() => {
  const call = vi.fn(
    (callback: () => void, params: undefined, position: string) => {
      void callback;
      void params;
      void position;
      return timeline;
    },
  );
  const fromTo = vi.fn(() => timeline);
  const set = vi.fn(() => timeline);
  const to = vi.fn(() => timeline);
  const timeline = { call, fromTo, kill: vi.fn(), set, to };

  return {
    routerPush: vi.fn(),
    timeline,
    timelineCall: call,
    timelineFromTo: fromTo,
    timelineSet: set,
    timelineTo: to,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("next/link", () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; scroll?: boolean }
  >(function TestLink({ href, onClick, scroll, ...props }, ref) {
    void scroll;
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

function renderLink(
  reducedMotion = false,
  imageUrl: string | null = "/pasta.jpg",
  heroBounds?: Partial<DOMRect>,
) {
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
    ...heroBounds,
  });
  document.body.appendChild(hero);

  return render(
    <Menu3DTransitionLink
      href="/kopi/pasta/3d"
      heroId="menu-hero"
      imageUrl={imageUrl}
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
    expect((portal as HTMLElement).style.borderRadius).toBe("24px");
    expect(timelineFromTo).toHaveBeenNthCalledWith(
      1,
      portal,
      {
        scaleX: 320 / window.innerWidth,
        scaleY: 220 / window.innerHeight,
        x: 16,
        y: 40,
      },
      {
        duration: 0.68,
        ease: "power3.inOut",
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
    );
    expect(timelineTo).toHaveBeenCalledTimes(1);
    expect(timelineSet).toHaveBeenCalledWith(
      portal,
      { borderRadius: 0 },
      0.68,
    );
    expect(timelineCall).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      "-=0.12",
    );
    expect(timelineCall.mock.invocationCallOrder[0]).toBeGreaterThan(
      timelineFromTo.mock.invocationCallOrder.at(-1) ?? 0,
    );
    expect(timelineCall.mock.invocationCallOrder[0]).toBeGreaterThan(
      timelineTo.mock.invocationCallOrder[0],
    );
    expect(routerPush).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("3diner:viewer-transition")).toBeNull();

    const navigate = timelineCall.mock.calls[0]?.[0];
    if (!navigate) throw new Error("Expected a scheduled navigation callback");
    navigate();

    expect(sessionStorage.getItem("3diner:viewer-transition")).toBe("true");
    expect(routerPush).toHaveBeenCalledWith("/kopi/pasta/3d");
  });

  it("omits an inline background image when no menu image is available", async () => {
    renderLink(false, null);

    await userEvent.click(screen.getByRole("link", { name: "Lihat Model 3D" }));

    const portal = document.querySelector<HTMLElement>('[data-menu-3d-portal="true"]');
    expect(portal?.className).toBe("dish-mesh");
    expect(portal?.style.backgroundImage).toBe("");
  });

  it("routes even when transition marker storage throws", async () => {
    const storageError = new Error("storage unavailable");
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw storageError;
    });
    renderLink(true);

    await userEvent.click(screen.getByRole("link", { name: "Lihat Model 3D" }));

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

  it("preserves non-primary clicks for native link navigation", () => {
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
      button: 1,
      cancelable: true,
    });

    link.dispatchEvent(event);

    expect(defaultPreventedByComponent).toBe(false);
    expect(timelineFromTo).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("routes immediately when the hero is below the fold / off-screen", async () => {
    renderLink(false, "/pasta.jpg", { top: -320, bottom: -20, height: 300, y: -320 });

    await userEvent.click(screen.getByRole("link", { name: "Lihat Model 3D" }));

    expect(document.querySelector('[data-menu-3d-portal="true"]')).toBeNull();
    expect(timelineFromTo).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("3diner:viewer-transition")).toBe("true");
    expect(routerPush).toHaveBeenCalledWith("/kopi/pasta/3d");
  });

  it("still opens the viewer if the link unmounts after the first tap", async () => {
    const view = renderLink();
    await userEvent.click(screen.getByRole("link", { name: "Lihat Model 3D" }));
    const portal = document.querySelector('[data-menu-3d-portal="true"]');

    expect(portal).not.toBeNull();
    expect(routerPush).not.toHaveBeenCalled();

    view.unmount();

    expect(timeline.kill).toHaveBeenCalledTimes(1);
    expect(portal?.isConnected).toBe(false);
    expect(document.querySelector('[data-menu-3d-portal="true"]')).toBeNull();
    expect(routerPush).toHaveBeenCalledWith("/kopi/pasta/3d");
  });
});
