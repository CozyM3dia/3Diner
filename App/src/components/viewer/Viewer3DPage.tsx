"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, RotateCcw } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";

// Bypassing TypeScript JSX check for custom elements
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
    <div className="fixed inset-0 flex flex-col" style={{ background: "#002355" }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{
          background: "rgba(0,35,85,0.85)",
          backdropFilter: "blur(8px)",
          paddingTop: "calc(env(safe-area-inset-top) + 12px)",
          paddingBottom: "12px",
        }}
      >
        <a
          href={backUrl}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(253,253,253,0.15)" }}
          aria-label="Kembali"
        >
          <X size={18} color="#FDFDFD" />
        </a>
        <p className="text-sm font-semibold truncate flex-1" style={{ color: "#FDFDFD" }}>
          {menuName}
        </p>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        {isGlb ? (
          <ModelViewerElement
            ref={modelViewerRef}
            src={url}
            ios-src={usdzUrl || undefined}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="auto"
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
            style={{ background: "#002355" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "rgba(253,253,253,0.1)" }}
            >
              <Loader2 size={28} color="#FD5002" strokeWidth={2} className="animate-spin" />
            </div>
            <p className="text-sm font-semibold" style={{ color: "#FDFDFD" }}>
              Memuat model 3D...
            </p>
            <div className="w-56 h-2 rounded-full overflow-hidden" style={{ background: "rgba(253,253,253,0.15)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #022C60, #FD5002)",
                }}
              />
            </div>
            <p className="text-base font-bold" style={{ color: "#FDFDFD" }}>
              {progress > 0 ? `${progress}%` : "Menyiapkan..."}
            </p>
            <p className="text-xs text-center px-10 leading-relaxed" style={{ color: "rgba(253,253,253,0.6)" }}>
              Model sedang diunduh, mohon tunggu...
            </p>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-6"
            style={{ background: "#002355" }}
          >
            <p className="font-semibold text-sm" style={{ color: "#FDFDFD" }}>
              Gagal memuat model 3D
            </p>
            <p className="text-xs text-center" style={{ color: "rgba(253,253,253,0.6)" }}>
              Cek koneksi internet & coba lagi
            </p>
            {errorMsg && (
              <p className="text-xs text-center px-4 font-mono break-all" style={{ color: "rgba(253,253,253,0.5)" }}>
                {errorMsg}
              </p>
            )}
            <button
              type="button"
              onClick={initViewer}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: "#FD5002" }}
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
            style={{ background: "rgba(0,35,85,0.8)", color: "#FDFDFD" }}
          >
            <span>👆</span>
            <span>Drag untuk memutar model</span>
          </div>
        )}
      </div>
    </div>
  );
}
