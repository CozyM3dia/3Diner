"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, RotateCcw, ScanLine, Move3d } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";
import GlbViewer from "./GlbViewer";
import dynamic from "next/dynamic";

const ARSession = dynamic(() => import("./ARSession"), { ssr: false });

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
  const gltfCacheRef = useRef<any>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAR, setShowAR] = useState(false);

  const isGlb = url.toLowerCase().endsWith(".glb");

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
          <GlbViewer
            url={url}
            onReady={() => setState("ready")}
            onError={(msg) => { setErrorMsg(msg); setState("error"); }}
            onGltfLoaded={(g) => { gltfCacheRef.current = g; }}
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

        <button
          onClick={() => setShowAR(true)}
          disabled={state !== "ready"}
          className="btn-primary press w-full h-[54px] rounded-2xl inline-flex items-center justify-center gap-2.5 font-semibold text-[15px] text-white disabled:opacity-50 max-w-xl mx-auto"
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
          preloadedGltf={gltfCacheRef.current}
        />
      )}
    </div>
  );
}
