"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, RotateCcw } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";

// Bypassing TypeScript JSX check for custom elements
const ModelViewerElement = "model-viewer" as any;

interface Viewer3DPageProps {
  url: string;
  menuName: string;
  backUrl: string;
}

type ViewerState = "loading" | "ready" | "error";

export default function Viewer3DPage({ url, menuName, backUrl }: Viewer3DPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelViewerRef = useRef<any>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const isGlb = url.toLowerCase().endsWith(".glb");

  // For GLB: attach load/error listeners via ref (onLoad prop unreliable on web components)
  useEffect(() => {
    if (!isGlb) return;

    const mv = modelViewerRef.current;
    if (!mv) return;

    const handleLoad = () => {
      setProgress(100);
      setState("ready");
    };
    const handleError = () => setState("error");

    mv.addEventListener("load", handleLoad);
    mv.addEventListener("error", handleError);

    // Model may have already loaded before effect ran (e.g. from cache)
    if (mv.loaded) handleLoad();

    return () => {
      mv.removeEventListener("load", handleLoad);
      mv.removeEventListener("error", handleError);
    };
  }, [isGlb]);

  // For GLB: import model-viewer library
  useEffect(() => {
    if (isGlb) {
      import("@google/model-viewer").catch((err) => {
        console.error("Failed to load model-viewer", err);
        setState("error");
      });
    }
  }, [isGlb]);

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
      // Step 1: Fetch the PLY in the main thread with real progress tracking.
      // This avoids Android Chrome's "can't download securely" block on HTTP
      // worker fetches. Main-thread fetch is always allowed.
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
        if (total > 0) {
          setProgress(Math.min(95, Math.round((loaded / total) * 100)));
        }
      }

      // Combine chunks into a single ArrayBuffer so Blob constructor is happy.
      const combined = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of rawChunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }

      // Step 2: Create a same-origin Blob URL so the GS worker can access it.
      const blob = new Blob([combined.buffer], { type: "application/octet-stream" });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      // Step 3: Set up the GS viewer.
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
    <div className="fixed inset-0 flex flex-col" style={{ background: "#1A0F0A" }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{
          background: "rgba(26,15,10,0.85)",
          backdropFilter: "blur(8px)",
          paddingTop: "calc(env(safe-area-inset-top) + 12px)",
          paddingBottom: "12px",
        }}
      >
        <a
          href={backUrl}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(253,246,236,0.15)" }}
          aria-label="Kembali"
        >
          <X size={18} color="#FDF6EC" />
        </a>
        <p className="text-sm font-semibold truncate flex-1" style={{ color: "#FDF6EC" }}>
          {menuName}
        </p>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        {isGlb ? (
          <ModelViewerElement
            ref={modelViewerRef}
            src={url}
            ar
            ar-modes="scene-viewer webxr quick-look"
            camera-controls
            touch-action="pan-y"
            shadow-intensity="1"
            autoplay
            auto-rotate
            alt={menuName}
            style={{ width: "100%", height: "100%", outline: "none", "--poster-color": "transparent" } as any}
          />
        ) : (
          <div ref={containerRef} className="absolute inset-0" />
        )}

        {/* Loading */}
        {state === "loading" && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
            style={{ background: "#F5E6D3" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "#FFFBF5" }}
            >
              <Loader2 size={28} color="#8B5E3C" strokeWidth={2} className="animate-spin" />
            </div>
            <p className="text-sm font-semibold" style={{ color: "#8B5E3C" }}>
              Memuat model 3D...
            </p>
            <div className="w-56 h-2 rounded-full overflow-hidden" style={{ background: "#E8D5C0" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #8B5E3C, #C4956A)",
                }}
              />
            </div>
            <p className="text-base font-bold" style={{ color: "#8B5E3C" }}>
              {progress > 0 ? `${progress}%` : "Menyiapkan..."}
            </p>
            <p className="text-xs text-center px-10 leading-relaxed" style={{ color: "#A0724A" }}>
              Model sedang diunduh, mohon tunggu...
            </p>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-6"
            style={{ background: "#F5E6D3" }}
          >
            <p className="font-semibold text-sm" style={{ color: "#2C1810" }}>
              Gagal memuat model 3D
            </p>
            <p className="text-xs text-center" style={{ color: "#C4956A" }}>
              Cek koneksi internet & coba lagi
            </p>
            {errorMsg && (
              <p className="text-xs text-center px-4 font-mono break-all" style={{ color: "#8B5E3C" }}>
                {errorMsg}
              </p>
            )}
            <button
              type="button"
              onClick={initViewer}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{ background: "#8B5E3C", color: "#FDF6EC" }}
            >
              <RotateCcw size={14} />
              Coba Lagi
            </button>
          </div>
        )}

        {/* Ready hint */}
        {state === "ready" && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium pointer-events-none"
            style={{ background: "rgba(44,24,16,0.65)", color: "#FDF6EC" }}
          >
            <span>👆</span>
            <span>Drag untuk memutar model</span>
          </div>
        )}
      </div>
    </div>
  );
}
