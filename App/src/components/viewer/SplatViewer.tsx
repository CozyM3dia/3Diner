"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";

interface SplatViewerProps {
  url: string;
  className?: string;
}

type ViewerState = "loading" | "ready" | "error";

export default function SplatViewer({ url, className = "" }: SplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState(false);

  const initViewer = useCallback(async () => {
    if (!containerRef.current) return;

    setState("loading");
    setProgress(0);
    setHint(false);

    try {
      const GS = await import("@mkkellogg/gaussian-splats-3d");

      // ── Dispose previous ──────────────────────────────────────────────
      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch { /* noop */ }
        viewerRef.current = null;
      }
      containerRef.current.innerHTML = "";

      // ── Create viewer — tanpa hardcoded camera position ───────────────
      // Camera akan di-fit setelah model loaded
      const viewer = new GS.Viewer({
        rootElement: containerRef.current,
        selfDrivenMode: true,
        useBuiltInControls: true,
        sharedMemoryForWorkers: false,
        cameraUp: [0, -1, 0],
        // Temporary position — akan di-override oleh fitCameraToModel()
        initialCameraPosition: [0, -0.5, 2],
        initialCameraLookAt: [0, 0, 0],
      });

      viewerRef.current = viewer;

      // ── Load scene progressively ──────────────────────────────────────
      await viewer.addSplatScene(url, {
        // Remove splats with opacity < 5/255 — reduces GPU memory significantly
        // without noticeable visual quality loss on mobile screens
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
        progressiveLoad: true,
        onProgress: (percent: number) => {
          setProgress(Math.min(100, Math.round(percent)));
        },
      });

      // ── Start render ──────────────────────────────────────────────────
      viewer.start();

      // ── Auto-fit camera ke model bounds ───────────────────────────────
      const THREE = await import("three");
      fitCameraToModel(viewer, THREE); // from @/lib/fit-camera

      setState("ready");
      setHint(true);
      setTimeout(() => setHint(false), 3000);
    } catch (err) {
      console.error("[SplatViewer]", err);
      setState("error");
    }
  }, [url]);

  useEffect(() => {
    initViewer();
    return () => {
      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch { /* noop */ }
        viewerRef.current = null;
      }
    };
  }, [initViewer]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ background: "linear-gradient(145deg, #F5E6D3, #E8D5C0)" }}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading — solid opaque overlay so it's always visible on any device */}
      {state === "loading" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10"
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
          <div className="w-48 h-2 rounded-full overflow-hidden" style={{ background: "#E8D5C0" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #8B5E3C, #C4956A)" }}
            />
          </div>
          <p className="text-sm font-bold" style={{ color: "#8B5E3C" }}>
            {progress > 0 ? `${progress}%` : "Menyiapkan..."}
          </p>
          <p className="text-xs text-center px-8" style={{ color: "#A0724A" }}>
            Model 3D sedang diunduh{"\n"}mungkin butuh beberapa detik
          </p>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 p-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#FDF6EC" }}>
            <AlertCircle size={26} color="#C4956A" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm mb-1" style={{ color: "#2C1810" }}>Gagal memuat model 3D</p>
            <p className="text-xs mb-4" style={{ color: "#C4956A" }}>Cek koneksi internet kamu</p>
          </div>
          <button
            onClick={initViewer}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold active:scale-95 transition-transform"
            style={{ background: "#8B5E3C", color: "#FDF6EC" }}
          >
            <RotateCcw size={14} />
            Coba lagi
          </button>
        </div>
      )}

      {/* Hint */}
      {state === "ready" && hint && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium"
          style={{ background: "rgba(44,24,16,0.65)", color: "#FDF6EC", backdropFilter: "blur(6px)", pointerEvents: "none" }}
        >
          <span>👆</span>
          <span>Drag untuk memutar model</span>
        </div>
      )}
    </div>
  );
}

