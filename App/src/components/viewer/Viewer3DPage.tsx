"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, RotateCcw, ScanLine, Move3d } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";

// Bypassing TypeScript JSX check for custom elements
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ModelViewerElement = "model-viewer" as any;

interface Viewer3DPageProps {
  url: string;
  usdzUrl?: string;
  menuName: string;
  backUrl: string;
}

type ViewerState = "loading" | "ready" | "error";

export default function Viewer3DPage({ url, usdzUrl, menuName, backUrl }: Viewer3DPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelViewerRef = useRef<any>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [arSupported, setArSupported] = useState(false);
  const [arHint, setArHint] = useState(false);
  const [arActivating, setArActivating] = useState(false);

  const isGlb = url.toLowerCase().endsWith(".glb");

  // GLB: attach load/error listeners via ref (onLoad prop unreliable on web components)
  useEffect(() => {
    if (!isGlb) return;
    const mv = modelViewerRef.current;
    if (!mv) return;

    const handleLoad = () => {
      setProgress(100);
      setState("ready");
      // canActivateAR resolves once model-viewer evaluates ar-modes for the device
      setArSupported(Boolean(mv.canActivateAR));
      window.setTimeout(() => setArSupported(Boolean(mv.canActivateAR)), 600);
      // Nudge model-viewer to (re)measure its canvas in case the flex layout
      // settled after the WebGL context was created (canvas can init at 0×0).
      window.dispatchEvent(new Event("resize"));
      window.setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
    };
    const handleError = () => setState("error");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleArStatus = (e: any) => {
      if (e.detail?.status === "not-presenting" || e.detail?.status === "failed") {
        setArActivating(false);
      }
    };

    mv.addEventListener("load", handleLoad);
    mv.addEventListener("error", handleError);
    mv.addEventListener("ar-status", handleArStatus);
    if (mv.loaded) handleLoad();

    return () => {
      mv.removeEventListener("load", handleLoad);
      mv.removeEventListener("error", handleError);
      mv.removeEventListener("ar-status", handleArStatus);
    };
  }, [isGlb]);

  // GLB: import model-viewer library
  useEffect(() => {
    if (isGlb) {
      import("@google/model-viewer").catch((err) => {
        console.error("Failed to load model-viewer", err);
        setState("error");
      });
    }
  }, [isGlb]);

  function launchAR() {
    const mv = modelViewerRef.current;
    if (mv?.canActivateAR) {
      setArActivating(true);
      mv.activateAR();
    } else {
      setArHint(true);
      window.setTimeout(() => setArHint(false), 3600);
    }
  }

  function resetView() {
    const mv = modelViewerRef.current;
    if (mv) {
      mv.cameraOrbit = "0deg 75deg auto";
      mv.fieldOfView = "auto";
    }
  }

  const initViewer = useCallback(async () => {
    if (isGlb) {
      setState("loading");
      setProgress(0);
      return;
    }

    if (!containerRef.current) return;
    setState("loading");
    setProgress(0);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body!.getReader();
      const rawChunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
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
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      const GS = await import("@mkkellogg/gaussian-splats-3d");

      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch { /* noop */ }
        viewerRef.current = null;
      }
      containerRef.current.innerHTML = "";

      const viewer = new GS.Viewer({
        rootElement: containerRef.current,
        selfDrivenMode: true,
        useBuiltInControls: true,
        sharedMemoryForWorkers: false,
        cameraUp: [0, -1, 0],
        initialCameraPosition: [0, -0.5, 2],
        initialCameraLookAt: [0, 0, 0],
      });

      viewerRef.current = viewer;

      await viewer.addSplatScene(blobUrl, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
        progressiveLoad: false,
        format: GS.SceneFormat.Ply,
      });

      viewer.start();

      const THREE = await import("three");
      fitCameraToModel(viewer, THREE);

      setProgress(100);
      setState("ready");
    } catch (err) {
      console.error("[Viewer3DPage]", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [url, isGlb]);

  useEffect(() => {
    initViewer();
    return () => {
      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch { /* noop */ }
        viewerRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [initViewer]);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "radial-gradient(120% 90% at 50% 35%, #0A3A78 0%, #022C60 45%, #002355 100%)" }}>
      {/* Top bar */}
      <div
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
      <div className="relative flex-1 overflow-hidden min-h-0">
        {isGlb ? (
          <ModelViewerElement
            ref={modelViewerRef}
            src={url}
            ios-src={usdzUrl || undefined}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="fixed"
            loading="eager"
            reveal="auto"
            camera-controls
            touch-action="pan-y"
            shadow-intensity="1"
            exposure="1.05"
            environment-image="neutral"
            autoplay
            auto-rotate
            rotation-per-second="18deg"
            interaction-prompt="none"
            alt={menuName}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", outline: "none", "--poster-color": "transparent" } as React.CSSProperties}
          />
        ) : (
          <div ref={containerRef} className="absolute inset-0" />
        )}

        {/* Reset view (only when ready) */}
        {state === "ready" && (
          <button
            onClick={resetView}
            aria-label="Atur ulang tampilan"
            className="press absolute top-3 right-4 w-10 h-10 rounded-full inline-flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
          >
            <RotateCcw size={17} strokeWidth={2.2} />
          </button>
        )}

        {/* Loading */}
        {state === "loading" && (
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

        {/* Error */}
        {state === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="font-semibold text-sm" style={{ color: "#FDFDFD" }}>Gagal memuat model 3D</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Cek koneksi internet lalu coba lagi</p>
            {errorMsg && <p className="text-xs px-4 font-mono break-all" style={{ color: "rgba(255,255,255,0.45)" }}>{errorMsg}</p>}
            <button onClick={initViewer} className="btn-primary press inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white">
              <RotateCcw size={14} /> Coba Lagi
            </button>
          </div>
        )}
      </div>

      {/* Bottom control panel */}
      <div
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

        {arHint && (
          <p className="text-[12px] text-center mb-2.5 leading-relaxed px-4" style={{ color: "rgba(255,255,255,0.78)" }}>
            Mode AR berjalan di HP (Android atau iPhone). Buka halaman ini lewat kamera HP untuk menaruh hidangan di mejamu.
          </p>
        )}

        <button
          onClick={launchAR}
          disabled={state !== "ready" || arActivating}
          className="btn-primary press w-full h-[54px] rounded-2xl inline-flex items-center justify-center gap-2.5 font-semibold text-[15px] text-white disabled:opacity-50 max-w-xl mx-auto"
        >
          {arActivating ? (
            <Loader2 size={20} strokeWidth={2.2} className="animate-spin" />
          ) : (
            <ScanLine size={20} strokeWidth={2.2} />
          )}
          {arActivating ? "Membuka AR..." : "Lihat di Meja (AR)"}
        </button>

        <p className="text-[11px] text-center mt-2.5" style={{ color: "rgba(255,255,255,0.5)" }}>
          {arSupported ? "Arahkan kamera ke meja untuk menaruh hidangan" : "Tampilan nyata ukuran asli di mejamu"}
        </p>
      </div>
    </div>
  );
}
