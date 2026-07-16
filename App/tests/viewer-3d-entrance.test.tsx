/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Viewer3DPage from "../src/components/viewer/Viewer3DPage";

const { gsapSet, timeline, timelineFromTo, useGSAPOptions } = vi.hoisted(() => {
  const fromTo = vi.fn(() => timeline);
  const timeline = { fromTo, kill: vi.fn() };

  return {
    gsapSet: vi.fn(),
    timeline,
    timelineFromTo: fromTo,
    useGSAPOptions: vi.fn(),
  };
});

vi.mock("next/dynamic", () => ({
  default: () => function TestARSession() {
    return <div data-testid="ar-session" />;
  },
}));

vi.mock("../src/components/viewer/GlbViewer", () => ({
  default: () => <div data-testid="glb-viewer" />,
}));

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    set: gsapSet,
    timeline: vi.fn(() => timeline),
  },
}));

vi.mock("@gsap/react", () => ({
  useGSAP: (
    callback: () => void | (() => void),
    options: { scope?: React.RefObject<HTMLElement | null> },
  ) => {
    useGSAPOptions(options);
    React.useEffect(callback, [callback]);
  },
}));

function renderViewer(reducedMotion = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reducedMotion }),
  );
  sessionStorage.setItem("3diner:viewer-transition", "true");

  return render(
    <Viewer3DPage
      url="/models/pasta.glb"
      menuName="Pasta Meatball"
      backUrl="/demo/pasta"
    />,
  );
}

describe("Viewer3DPage entrance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("stages the header, model stage, and controls in a scoped timeline", () => {
    const view = renderViewer();
    const shell = view.container.querySelector('[data-viewer-entrance="shell"]');
    const header = view.container.querySelector('[data-viewer-entrance="header"]');
    const stage = view.container.querySelector('[data-viewer-entrance="stage"]');
    const controls = view.container.querySelector('[data-viewer-entrance="controls"]');

    expect(useGSAPOptions).toHaveBeenCalledWith(
      expect.objectContaining({ scope: expect.objectContaining({ current: shell }) }),
    );
    expect(timelineFromTo).toHaveBeenNthCalledWith(
      1,
      header,
      expect.objectContaining({ opacity: 0, y: -16 }),
      expect.objectContaining({ opacity: 1, y: 0 }),
      expect.anything(),
    );
    expect(timelineFromTo).toHaveBeenNthCalledWith(
      2,
      stage,
      expect.objectContaining({ opacity: 0, scale: 0.97 }),
      expect.objectContaining({ opacity: 1, scale: 1 }),
      expect.anything(),
    );
    expect(timelineFromTo).toHaveBeenNthCalledWith(
      3,
      controls,
      expect.objectContaining({ opacity: 0, y: 18 }),
      expect.objectContaining({ opacity: 1, y: 0 }),
      expect.anything(),
    );
    expect(sessionStorage.getItem("3diner:viewer-transition")).toBeNull();
  });

  it("shows every entrance target immediately when reduced motion is preferred", () => {
    const view = renderViewer(true);
    const targets = ["header", "stage", "controls"].map((target) =>
      view.container.querySelector(`[data-viewer-entrance="${target}"]`),
    );

    expect(gsapSet).toHaveBeenCalledWith(targets, {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
    });
    expect(timelineFromTo).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("3diner:viewer-transition")).toBeNull();
  });
});
