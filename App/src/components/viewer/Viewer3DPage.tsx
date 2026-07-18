"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, RotateCcw, ScanLine, Move3d } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { fitCameraToModel } from "@/lib/fit-camera";
import GlbViewer from "./GlbViewer";
import dynamic from "next/dynamic";

gsap.registerPlugin(useGSAP);

const ARSession = dynamic(() => import("./ARSession"), { ssr: false });
const TRANSITION_MARKER = "3diner:viewer-transition";

interface Viewer3DPageProps {
  url: string;
  usdzUrl?: string;
  menuName: string;
  backUrl: string;
  modelScale?: number;
}

type ViewerState = "loading" | "ready" | "error";

export default function Viewer3DPage({ url, usdzUrl, menuName, backUrl, modelScale = 1.0 }: Viewer3DPageProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const entranceDecisionRef = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const blobUrlRef = useRef<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadGenerationRef = useRef(0);
  const [state, setState] = useState<ViewerState>("loading");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAR, setShowAR] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [preloadedGltf, setPreloadedGltf] = useState<any>(null);

  const isGlb = url.toLowerCase().endsWith(".glb");

  const handleGlbReady = useCallback(() => {
    setState("ready");
  }, []);

  const handleGlbError = useCallback((message: string) => {
    setErrorMsg(message);
    setState("error");
  }, []);

  const handleGltfLoaded = useCallback((gltf: unknown) => {
    setPreloadedGltf(gltf);
  }, []);

  useGSAP(() => {
    const targets = [headerRef.current, stageRef.current, controlsRef.current];
    if (targets.some((target) => !target)) return;

    if (entranceDecisionRef.current === null) {
      try {
        entranceDecisionRef.current = sessionStorage.getItem(TRANSITION_MARKER) === "true";
        if (entranceDecisionRef.current) sessionStorage.removeItem(TRANSITION_MARKER);
      } catch {
        entranceDecisionRef.current = false;
      }
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(targets, { opacity: 1, scale: 1, x: 0, y: 0 });
      return;
    }

    const enteredFromMenu = entranceDecisionRef.current;
    const headerFrom = enteredFromMenu ? { opacity: 0, y: -16 } : { opacity: 0.6, y: -8 };
    const stageFrom = enteredFromMenu ? { opacity: 0, scale: 0.97 } : { opacity: 0.65, scale: 0.99 };
    const controlsFrom = enteredFromMenu ? { opacity: 0, y: 18 } : { opacity: 0.6, y: 8 };

    const timeline = gsap.timeline();
    timeline
      .fromTo(headerRef.current, headerFrom, { duration: enteredFromMenu ? 0.28 : 0.22, ease: "power2.out", opacity: 1, y: 0 }, 0)
      .fromTo(stageRef.current, stageFrom, { duration: enteredFromMenu ? 0.42 : 0.3, ease: "power2.out", opacity: 1, scale: 1 }, enteredFromMenu ? 0.05 : 0.02)
      .fromTo(controlsRef.current, controlsFrom, { duration: enteredFromMenu ? 0.32 : 0.24, ease: "power2.out", opacity: 1, y: 0 }, enteredFromMenu ? 0.12 : 0.06);

    return () => timeline.kill();
  }, { scope: shellRef });

  const initViewer = useCallback(async (generation: number, signal: AbortSignal) => {
    const isCurrent = () => (
      !signal.aborted && generation === loadGenerationRef.current
    );
    if (!containerRef.current || !isCurrent()) return;

    let localBlobUrl: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let localViewer: any = null;

    const disposeLocalResources = () => {
      if (localViewer) {
        if (viewerRef.current === localViewer) viewerRef.current = null;
        try { localViewer.dispose(); } catch { /* noop */ }
        localViewer = null;
      }
      if (localBlobUrl) {
        if (blobUrlRef.current === localBlobUrl) blobUrlRef.current = null;
        URL.revokeObjectURL(localBlobUrl);
        localBlobUrl = null;
      }
    };

    try {
      const response = await fetch(url, { signal });
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body!.getReader();
      const rawChunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (!isCurrent()) return;
        if (done) break;
        rawChunks.push(new Uint8Array(value.buffer.slice(0)));
        loaded += value.byteLength;
        if (total > 0) setProgress(Math.min(95, Math.round((loaded / total) * 100)));
      }

      const combined = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of rawChunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }

      const blob = new Blob([combined.buffer], { type: "application/octet-stream" });
      localBlobUrl = URL.createObjectURL(blob);

      const GS = await import("@mkkellogg/gaussian-splats-3d");
      if (!isCurrent() || !containerRef.current) {
        disposeLocalResources();
        return;
      }

      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch { /* noop */ }
        viewerRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      containerRef.current.innerHTML = "";

      localViewer = new GS.Viewer({
        rootElement: containerRef.current,
        selfDrivenMode: true,
        useBuiltInControls: true,
        sharedMemoryForWorkers: false,
        cameraUp: [0, -1, 0],
        initialCameraPosition: [0, -0.5, 2],
        initialCameraLookAt: [0, 0, 0],
      });

      viewerRef.current = localViewer;
      blobUrlRef.current = localBlobUrl;

      await localViewer.addSplatScene(localBlobUrl, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
        progressiveLoad: false,
        format: GS.SceneFormat.Ply,
      });
      if (!isCurrent()) {
        disposeLocalResources();
        return;
      }

      localViewer.start();

      const THREE = await import("three");
      if (!isCurrent()) {
        disposeLocalResources();
        return;
      }
      fitCameraToModel(localViewer, THREE);

      setProgress(100);
      setState("ready");
    } catch (err) {
      if (!isCurrent() || (err instanceof DOMException && err.name === "AbortError")) {
        disposeLocalResources();
        return;
      }
      console.error("[Viewer3DPage]", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [url]);

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    const controller = new AbortController();
    const container = containerRef.current;
    loadAbortRef.current = controller;

    if (!isGlb) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) void initViewer(generation, controller.signal);
      });
    }

    return () => {
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
      loadGenerationRef.current += 1;
      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch { /* noop */ }
        viewerRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (container) container.innerHTML = "";
    };
  }, [initViewer, isGlb]);

  const retryViewer = () => {
    loadAbortRef.current?.abort();
    if (viewerRef.current) {
      try { viewerRef.current.dispose(); } catch { /* noop */ }
      viewerRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = "";

    const generation = ++loadGenerationRef.current;
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setState("loading");
    setProgress(0);
    setErrorMsg("");
    void initViewer(generation, controller.signal);
  };

  return (
    <div ref={shellRef} data-viewer-entrance="shell" className="fixed inset-0 flex flex-col" style={{ background: "radial-gradient(120% 90% at 50% 35%, #0A3A78 0%, #022C60 45%, #002355 100%)", touchAction: "none", overscrollBehavior: "none" } as React.CSSProperties}>
      {/* Top bar */}
      <div
        ref={headerRef}
        data-viewer-entrance="header"
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 14px)", paddingBottom: "14px" }}
      >
        <a
          href={backUrl}
          className="press w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.14)" }}
          aria-label="Tutup"
        >
          <X size={19} color="#FDFDFD" strokeWidth={2.2} />
        </a>
        <p className="text-[15px] font-semibold truncate flex-1 text-center pr-10" style={{ color: "#FDFDFD" }}>
          {menuName}
        </p>
      </div>

      {/* Canvas */}
      <div ref={stageRef} data-viewer-entrance="stage" className="relative flex-1 overflow-hidden min-h-0">
        {isGlb ? (
          <GlbViewer
            url={url}
            onReady={handleGlbReady}
            onError={handleGlbError}
            onGltfLoaded={handleGltfLoaded}
            modelScale={modelScale}
          />
        ) : (
          <div ref={containerRef} className="absolute inset-0" />
        )}

        {/* Loading overlay — PLY only (GlbViewer handles its own) */}
        {!isGlb && state === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Loader2 size={28} color="var(--orange)" strokeWidth={2} className="animate-spin" />
            </div>
            <p className="text-sm font-semibold" style={{ color: "#FDFDFD" }}>Memuat model 3D...</p>
            <div className="w-56 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "var(--orange)" }} />
            </div>
            <p className="text-base font-bold" style={{ color: "#FDFDFD" }}>{progress > 0 ? `${progress}%` : "Menyiapkan..."}</p>
          </div>
        )}

        {/* Error — PLY only */}
        {!isGlb && state === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="font-semibold text-sm" style={{ color: "#FDFDFD" }}>Gagal memuat model 3D</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Cek koneksi internet lalu coba lagi</p>
            {errorMsg && <p className="text-xs px-4 font-mono break-all" style={{ color: "rgba(255,255,255,0.45)" }}>{errorMsg}</p>}
            <button onClick={retryViewer} className="btn-primary press inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white">
              <RotateCcw size={14} /> Coba Lagi
            </button>
          </div>
        )}
      </div>

      {/* Bottom control panel */}
      <div
        ref={controlsRef}
        data-viewer-entrance="controls"
        className="shrink-0 px-4 pt-4"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 16px)",
          background: "linear-gradient(180deg, rgba(0,35,85,0) 0%, rgba(0,35,85,0.55) 40%)",
        }}
      >
        {state === "ready" && (
          <p className="flex items-center justify-center gap-1.5 text-xs mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
            <Move3d size={14} /> Putar dengan jari, cubit untuk perbesar
          </p>
        )}

        <button
          onClick={() => setShowAR(true)}
          disabled={state !== "ready"}
          className="btn-primary press w-full h-[54px] rounded-2xl flex items-center justify-center gap-2.5 font-semibold text-[15px] text-white disabled:opacity-50 max-w-xl mx-auto"
        >
          <ScanLine size={20} strokeWidth={2.2} />
          Lihat di Meja (AR)
        </button>

        <p className="text-[11px] text-center mt-2.5" style={{ color: "rgba(255,255,255,0.5)" }}>
          Tampilan nyata ukuran asli di mejamu
        </p>
      </div>

      {/* AR overlay */}
      {showAR && (
        <ARSession
          url={url}
          usdzUrl={usdzUrl}
          menuName={menuName}
          onClose={() => setShowAR(false)}
          preloadedGltf={preloadedGltf}
          modelScale={modelScale}
        />
      )}
    </div>
  );
}
