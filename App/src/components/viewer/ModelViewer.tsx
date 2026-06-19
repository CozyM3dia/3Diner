"use client";

/**
 * ModelViewer — full-screen 3D viewer overlay.
 * Opens on top of the detail page when the user taps "Lihat 3D".
 * Full-screen gives the model room to breathe and sidesteps mobile
 * layout/hydration issues with embedded height constraints.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, RotateCcw } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";

interface ModelViewerProps {
  url: string;
  menuName: string;
  onClose: () => void;
}

type ViewerState = "loading" | "ready" | "error";

export default function ModelViewer({ url, menuName, onClose }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [progress, setProgress] = useState(0);

  const initViewer = useCallback(async () => {
    if (!containerRef.current) return;
    setState("loading");
    setProgress(0);

    try {
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

      await viewer.addSplatScene(url, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
        progressiveLoad: true,
        onProgress: (percent: number) => {
          setProgress(Math.min(100, Math.round(percent)));
        },
      });

      viewer.start();

      const THREE = await import("three");
      fitCameraToModel(viewer, THREE);

      setState("ready");
    } catch (err) {
      console.error("[ModelViewer]", err);
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
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "#1A0F0A" }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: "rgba(26,15,10,0.8)", backdropFilter: "blur(8px)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          style={{ background: "rgba(253,246,236,0.15)" }}
        >
          <X size={18} color="#FDF6EC" />
        </button>
        <p className="text-sm font-semibold truncate" style={{ color: "#FDF6EC" }}>
          {menuName}
        </p>
      </div>

      {/* ── 3D canvas area — fills remaining height ── */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Loading overlay */}
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

            {/* Progress bar */}
            <div
              className="w-56 h-2 rounded-full overflow-hidden"
              style={{ background: "#E8D5C0" }}
            >
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

            <p
              className="text-xs text-center px-10 leading-relaxed"
              style={{ color: "#A0724A" }}
            >
              Model 3D sedang diunduh.{"\n"}Mohon tunggu sebentar...
            </p>
          </div>
        )}

        {/* Error overlay */}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 p-6"
            style={{ background: "#F5E6D3" }}>
            <p className="font-semibold text-sm" style={{ color: "#2C1810" }}>
              Gagal memuat model 3D
            </p>
            <p className="text-xs text-center" style={{ color: "#C4956A" }}>
              Cek koneksi internet & coba lagi
            </p>
            <button
              type="button"
              onClick={initViewer}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold active:scale-95 transition-transform"
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
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium pointer-events-none"
            style={{
              background: "rgba(44,24,16,0.65)",
              color: "#FDF6EC",
              backdropFilter: "blur(6px)",
            }}
          >
            <span>👆</span>
            <span>Drag untuk memutar model</span>
          </div>
        )}
      </div>
    </div>
  );
}
