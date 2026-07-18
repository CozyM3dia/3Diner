/**
 * @vitest-environment jsdom
 */
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Viewer3DPage from "../src/components/viewer/Viewer3DPage";

const {
  fetchMock,
  fitCameraMock,
  glbEffectRuns,
  glbViewerProps,
  gsapSet,
  gsapTimeline,
  plyAddSplatScene,
  plyViewerConstructor,
  plyViewerInstances,
  timelineFromTo,
  timelines,
  useGSAPOptions,
} = vi.hoisted(() => {
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
  const plyViewerInstances: Array<{
    addSplatScene: ReturnType<typeof vi.fn>;
    canvas: HTMLCanvasElement;
    dispose: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }> = [];
  const plyAddSplatScene = vi.fn().mockResolvedValue(undefined);
  const plyViewerConstructor = vi.fn(function PlyViewer(options: { rootElement?: HTMLElement }) {
    const canvas = document.createElement("canvas");
    options.rootElement?.appendChild(canvas);
    const instance = {
      addSplatScene: vi.fn((...args: unknown[]) => plyAddSplatScene(...args)),
      canvas,
      dispose: vi.fn(() => canvas.remove()),
      start: vi.fn(),
    };
    plyViewerInstances.push(instance);
    return instance;
  });

  return {
    fetchMock: vi.fn(),
    fitCameraMock: vi.fn(),
    glbEffectRuns: vi.fn(),
    glbViewerProps: [] as Array<Record<string, unknown>>,
    gsapSet: vi.fn(),
    gsapTimeline,
    plyAddSplatScene,
    plyViewerConstructor,
    plyViewerInstances,
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
  default: function TestGlbViewer(props: Record<string, unknown>) {
    glbViewerProps.push(props);
    React.useEffect(() => {
      glbEffectRuns();
    }, [props.url, props.onReady, props.onError, props.onGltfLoaded]);
    return <div data-testid="glb-viewer" />;
  },
}));

vi.mock("@/lib/fit-camera", () => ({
  fitCameraToModel: fitCameraMock,
}));

vi.mock("@mkkellogg/gaussian-splats-3d", () => ({
  SceneFormat: { Ply: 2 },
  Viewer: plyViewerConstructor,
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

function plyResponse() {
  const bytes = new Uint8Array([1, 2, 3]);
  let delivered = false;
  return {
    body: {
      getReader: () => ({
        read: vi.fn(async () => {
          if (delivered) return { done: true, value: undefined };
          delivered = true;
          return { done: false, value: bytes };
        }),
      }),
    },
    headers: new Headers({ "content-length": String(bytes.byteLength) }),
    ok: true,
    status: 200,
  } as unknown as Response;
}

function plyViewer(url: string) {
  return (
    <Viewer3DPage
      url={url}
      menuName="Pasta Meatball"
      backUrl="/demo/pasta"
    />
  );
}

describe("Viewer3DPage entrance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    glbViewerProps.length = 0;
    plyViewerInstances.length = 0;
    plyAddSplatScene.mockReset().mockResolvedValue(undefined);
    timelines.length = 0;
    sessionStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => `blob:viewer-${Math.random()}`),
      revokeObjectURL: vi.fn(),
    });
  });

  it("keeps GlbViewer lifecycle callbacks stable across parent state updates", () => {
    renderViewer();
    const initialProps = glbViewerProps.at(-1);
    const onGltfLoaded = initialProps?.onGltfLoaded as ((gltf: unknown) => void) | undefined;
    const onReady = initialProps?.onReady as (() => void) | undefined;
    const onError = initialProps?.onError as ((message: string) => void) | undefined;
    if (!onGltfLoaded || !onReady || !onError) throw new Error("Expected GlbViewer callbacks");

    act(() => onGltfLoaded({ scene: {} }));
    const afterGltf = glbViewerProps.at(-1);
    act(() => onReady());
    const afterReady = glbViewerProps.at(-1);
    act(() => onError("load failed"));
    const afterError = glbViewerProps.at(-1);

    for (const props of [afterGltf, afterReady, afterError]) {
      expect(props?.onGltfLoaded).toBe(onGltfLoaded);
      expect(props?.onReady).toBe(onReady);
      expect(props?.onError).toBe(onError);
    }
    expect(glbEffectRuns).toHaveBeenCalledTimes(1);
  });

  it("keeps one current PLY viewer when a stale Strict Mode load finishes late", async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    let resolveSecond: ((response: Response) => void) | undefined;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSecond = resolve; }));

    const view = render(<React.StrictMode>{plyViewer("/models/first.ply")}</React.StrictMode>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    view.rerender(<React.StrictMode>{plyViewer("/models/current.ply")}</React.StrictMode>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond?.(plyResponse());
    });
    await waitFor(() => expect(plyViewerConstructor).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolveFirst?.(plyResponse());
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(plyViewerConstructor).toHaveBeenCalledTimes(1);
    expect(plyViewerInstances).toHaveLength(1);
    expect(plyViewerInstances[0]?.dispose).not.toHaveBeenCalled();
    expect(view.container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("disposes a constructed stale PLY viewer and ignores its late scene completion", async () => {
    let resolveStaleScene: (() => void) | undefined;
    plyAddSplatScene
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveStaleScene = resolve; }))
      .mockResolvedValueOnce(undefined);
    fetchMock.mockImplementation(() => Promise.resolve(plyResponse()));

    const view = render(plyViewer("/models/stale.ply"));
    await waitFor(() => expect(plyViewerConstructor).toHaveBeenCalledTimes(1));
    const staleViewer = plyViewerInstances[0];

    view.rerender(plyViewer("/models/current.ply"));
    await waitFor(() => expect(plyViewerConstructor).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(plyViewerInstances[1]?.start).toHaveBeenCalledTimes(1));

    expect(staleViewer?.dispose).toHaveBeenCalled();
    expect(staleViewer?.start).not.toHaveBeenCalled();

    await act(async () => {
      resolveStaleScene?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(staleViewer?.start).not.toHaveBeenCalled();
    expect(view.container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("cancels retry-owned PLY work when the page unmounts", async () => {
    let resolveRetryScene: (() => void) | undefined;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock
      .mockRejectedValueOnce(new Error("initial load failed"))
      .mockImplementationOnce(() => Promise.resolve(plyResponse()));
    plyAddSplatScene.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveRetryScene = resolve; }),
    );

    const view = render(plyViewer("/models/retry.ply"));
    const retryButton = await screen.findByRole("button", { name: "Coba Lagi" });
    consoleError.mockRestore();

    act(() => retryButton.click());
    await waitFor(() => expect(plyViewerConstructor).toHaveBeenCalledTimes(1));

    const retrySignal = (fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.signal;
    const retryViewer = plyViewerInstances[0];
    view.unmount();

    expect(retrySignal?.aborted).toBe(true);
    expect(retryViewer?.dispose).toHaveBeenCalled();
    expect(retryViewer?.start).not.toHaveBeenCalled();

    await act(async () => {
      resolveRetryScene?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(retryViewer?.start).not.toHaveBeenCalled();
    expect(fitCameraMock).not.toHaveBeenCalled();
    expect(view.container.querySelectorAll("canvas")).toHaveLength(0);
  });

  it("uses a block flex AR CTA so desktop auto margins center it", () => {
    renderViewer();

    const cta = screen.getByRole("button", { name: "Lihat di Meja (AR)" });
    expect(cta.classList).toContain("flex");
    expect(cta.classList).not.toContain("inline-flex");
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
