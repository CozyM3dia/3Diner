/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Viewer3DPage from "../src/components/viewer/Viewer3DPage";

const { gsapSet, gsapTimeline, timelineFromTo, timelines, useGSAPOptions } = vi.hoisted(() => {
  const timelineFromTo = vi.fn();
  const timelines: Array<{ fromTo: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }> = [];
  const gsapTimeline = vi.fn(() => {
    const timeline = {
      fromTo: vi.fn((...args: unknown[]) => {
        timelineFromTo(...args);
        return timeline;
      }),
      kill: vi.fn(),
    };
    timelines.push(timeline);
    return timeline;
  });

  return {
    gsapSet: vi.fn(),
    gsapTimeline,
    timelineFromTo,
    timelines,
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
    timeline: gsapTimeline,
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

function renderViewer(reducedMotion = false, hasTransitionMarker = true) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reducedMotion }),
  );
  if (hasTransitionMarker) {
    sessionStorage.setItem("3diner:viewer-transition", "true");
  }

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
    timelines.length = 0;
    sessionStorage.clear();
  });

  it("uses a subtle entrance for direct visits without a transition marker", () => {
    const view = renderViewer(false, false);
    const header = view.container.querySelector('[data-viewer-entrance="header"]');
    const stage = view.container.querySelector('[data-viewer-entrance="stage"]');
    const controls = view.container.querySelector('[data-viewer-entrance="controls"]');

    expect(timelineFromTo).toHaveBeenNthCalledWith(
      1,
      header,
      expect.objectContaining({ opacity: 0.6, y: -8 }),
      expect.objectContaining({ opacity: 1, y: 0 }),
      expect.anything(),
    );
    expect(timelineFromTo).toHaveBeenNthCalledWith(
      2,
      stage,
      expect.objectContaining({ opacity: 0.65, scale: 0.99 }),
      expect.objectContaining({ opacity: 1, scale: 1 }),
      expect.anything(),
    );
    expect(timelineFromTo).toHaveBeenNthCalledWith(
      3,
      controls,
      expect.objectContaining({ opacity: 0.6, y: 8 }),
      expect.objectContaining({ opacity: 1, y: 0 }),
      expect.anything(),
    );
  });

  it("uses the direct-visit entrance when transition storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("storage unavailable");
    });

    renderViewer(false, false);

    expect(timelineFromTo).toHaveBeenCalledTimes(3);
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

  it("replays the entrance after Strict Mode cleans up the first setup", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false }),
    );
    sessionStorage.setItem("3diner:viewer-transition", "true");

    const view = render(
      <React.StrictMode>
        <Viewer3DPage
          url="/models/pasta.glb"
          menuName="Pasta Meatball"
          backUrl="/demo/pasta"
        />
      </React.StrictMode>,
    );
    const header = view.container.querySelector('[data-viewer-entrance="header"]');

    expect(timelines).toHaveLength(2);
    expect(timelines[0]?.kill).toHaveBeenCalledTimes(1);
    expect(timelines[1]?.kill).not.toHaveBeenCalled();
    expect(timelineFromTo).toHaveBeenCalledTimes(6);
    expect(timelineFromTo).toHaveBeenNthCalledWith(
      4,
      header,
      expect.objectContaining({ opacity: 0, y: -16 }),
      expect.objectContaining({ opacity: 1, y: 0 }),
      expect.anything(),
    );
    expect(sessionStorage.getItem("3diner:viewer-transition")).toBeNull();
  });
});
