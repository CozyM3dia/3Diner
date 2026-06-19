"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, Scan, AlertTriangle, RotateCcw } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";

// Bypassing TypeScript JSX check for custom elements
const ModelViewerElement = "model-viewer" as any;

interface ARSessionProps {
  url: string;
  menuName: string;
  onClose: () => void;
}

type SessionState =
  | "loading"
  | "ready"
  | "unsupported"
  | "active"
  | "overlay_blocked"  // Android overlay apps blocking permission dialog
  | "error";

export default function ARSession({ url, menuName, onClose }: ARSessionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uiOverlayRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [progress, setProgress] = useState(0);
  const [arStarting, setArStarting] = useState(false);

  const isGlb = url.toLowerCase().endsWith(".glb");

  // Handle GLB load and AR status events
  useEffect(() => {
    if (isGlb && modelViewerRef.current) {
      const mv = modelViewerRef.current;

      const handleLoad = () => {
        console.log("[ARSession] GLB loaded");
        setProgress(100);
        setSessionState("ready");
      };

      const handleError = (err: any) => {
        console.error("[ARSession] GLB load error:", err);
        setSessionState("error");
      };

      const handleArStatus = (event: any) => {
        console.log("[ARSession] GLB AR Status:", event.detail.status);
        if (event.detail.status === "not-presenting") {
          onClose();
        } else if (event.detail.status === "failed") {
          setSessionState("unsupported");
        }
      };

      mv.addEventListener("load", handleLoad);
      mv.addEventListener("error", handleError);
      mv.addEventListener("ar-status", handleArStatus);

      // Check if it's already loaded
      if (mv.loaded) {
        handleLoad();
      }

      return () => {
        mv.removeEventListener("load", handleLoad);
        mv.removeEventListener("error", handleError);
        mv.removeEventListener("ar-status", handleArStatus);
      };
    }
  }, [isGlb, onClose]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (isGlb) {
        try {
          await import("@google/model-viewer");
          // The load listener above will transition state from loading to ready
        } catch (err) {
          console.error("Failed to load model-viewer", err);
          if (mounted) setSessionState("error");
        }
        return;
      }

      if (!containerRef.current) return;

      const arSupported =
        typeof navigator !== "undefined" &&
        !!navigator.xr &&
        (await navigator.xr.isSessionSupported("immersive-ar").catch(() => false));

      const GS = await import("@mkkellogg/gaussian-splats-3d");

      if (!mounted) return;

      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch { /* noop */ }
        viewerRef.current = null;
      }
      containerRef.current.innerHTML = "";

      const viewer = new GS.Viewer({
        rootElement: containerRef.current,
        selfDrivenMode: true,
        useBuiltInControls: !arSupported,
        sharedMemoryForWorkers: false,
        cameraUp: [0, -1, 0],
        initialCameraPosition: [0, -0.5, 2],
        initialCameraLookAt: [0, 0, 0],
        ...(arSupported
          ? {
              webXRMode: GS.WebXRMode.AR,
              webXRSessionInit: {
                optionalFeatures: ["hit-test", "dom-overlay"],
                domOverlay: {
                  root: uiOverlayRef.current!,
                },
              },
            }
          : {}),
      });

      viewerRef.current = viewer;

      await viewer.addSplatScene(url, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
        progressiveLoad: false,
        format: GS.SceneFormat.Ply,
        onProgress: (pct: number) => {
          if (mounted) setProgress(Math.min(100, Math.round(pct)));
        },
      });

      if (!mounted) return;

      viewer.start();

      if (!arSupported) {
        const THREE = await import("three");
        fitCameraToModel(viewer, THREE);
      }

      if (arSupported && viewer.renderer?.xr) {
        // Save original transform so we can restore after AR ends
        let savedScale: [number, number, number] | null = null;
        let savedPosition: [number, number, number] | null = null;

        viewer.renderer.xr.addEventListener("sessionstart", async () => {
          if (mounted) setSessionState("active");

          // Scale model to real-world table-top size only when AR starts
          const mesh = viewer.splatMesh;
          if (!mesh) return;
          try {
            const THREE = await import("three");

            // Save original transform before modifying
            savedScale = [mesh.scale.x, mesh.scale.y, mesh.scale.z];
            savedPosition = [mesh.position.x, mesh.position.y, mesh.position.z];

            const bb = mesh.computeBoundingBox(true);
            if (bb) {
              const size = new THREE.Vector3();
              const center = new THREE.Vector3();
              bb.getSize(size);
              bb.getCenter(center);

              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 0) {
                // Target: ~0.20 meters (realistic coffee cup / food plate)
                const targetSize = 0.20;
                const scaleFactor = targetSize / maxDim;

                mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

                // Place 0.5m in front, 0.3m below camera (table surface)
                mesh.position.set(
                  -center.x * scaleFactor,
                  -center.y * scaleFactor - 0.3,
                  -center.z * scaleFactor - 0.5
                );
                mesh.updateMatrixWorld(true);

                console.log(
                  `[ARSession] AR scale applied: maxDim=${maxDim.toFixed(3)}, ` +
                  `factor=${scaleFactor.toFixed(6)}, target=${targetSize}m`
                );
              }
            }
          } catch (err) {
            console.warn("[ARSession] Could not scale model for AR:", err);
          }
        });

        viewer.renderer.xr.addEventListener("sessionend", () => {
          if (mounted) setSessionState("ready");

          // Restore original transform when AR ends
          const mesh = viewer.splatMesh;
          if (mesh && savedScale && savedPosition) {
            mesh.scale.set(savedScale[0], savedScale[1], savedScale[2]);
            mesh.position.set(savedPosition[0], savedPosition[1], savedPosition[2]);
            mesh.updateMatrixWorld(true);
            savedScale = null;
            savedPosition = null;
          }
        });
      }

      if (mounted) {
        setSessionState(arSupported ? "ready" : "unsupported");
      }
    }

    init().catch((err) => {
      console.error("[ARSession]", err);
      if (mounted) setSessionState("error");
    });

    return () => {
      mounted = false;
      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch { /* noop */ }
        viewerRef.current = null;
      }
    };
  }, [url]);

  const triggerAR = useCallback(async () => {
    if (isGlb) {
      const mv = modelViewerRef.current;
      if (!mv) return;

      if (!mv.canActivateAR) {
        setSessionState("unsupported");
        return;
      }

      try {
        await mv.activateAR();
      } catch (err) {
        console.error("[ARSession] GLB activateAR error:", err);
        setSessionState("unsupported");
      }
      return;
    }

    if (!navigator.xr) {
      setSessionState("unsupported");
      return;
    }
    if (!uiOverlayRef.current) {
      console.error("[ARSession] uiOverlayRef is null");
      setSessionState("error");
      return;
    }

    if (sessionState === "active") {
      if (viewerRef.current?.renderer?.xr) {
        const session = viewerRef.current.renderer.xr.getSession();
        if (session) {
          try {
            await session.end();
          } catch (err) {
            console.error("[ARSession] Failed to end session:", err);
          }
        }
      }
      return;
    }

    setArStarting(true);

    // Timeout: if requestSession never resolves/rejects after 6s, show error
    const timeout = setTimeout(() => {
      setArStarting(false);
      setSessionState("overlay_blocked");
    }, 6000);

    try {
      const session = await navigator.xr.requestSession("immersive-ar", {
        optionalFeatures: ["hit-test", "dom-overlay"],
        domOverlay: { root: uiOverlayRef.current },
      });

      clearTimeout(timeout);
      
      if (viewerRef.current?.renderer?.xr) {
        viewerRef.current.renderer.xr.setReferenceSpaceType("local");
        await viewerRef.current.renderer.xr.setSession(session);
      }
      setArStarting(false);
    } catch (err) {
      clearTimeout(timeout);
      setArStarting(false);
      console.error("[ARSession] triggerAR error:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setSessionState("overlay_blocked");
      } else if (err instanceof DOMException && err.name === "NotSupportedError") {
        setSessionState("unsupported");
      } else {
        setSessionState("error");
      }
    }
  }, [sessionState, isGlb, onClose]);

  const retryAR = useCallback(() => {
    setSessionState("ready");
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black" style={{ touchAction: "none" }}>
      <style>{`#ARButton { display: none !important; }`}</style>
      {isGlb ? (
        <ModelViewerElement
          ref={modelViewerRef}
          src={url}
          ar
          ar-modes="scene-viewer webxr quick-look"
          camera-controls
          touch-action="pan-y"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            outline: "none",
            "--poster-color": "transparent",
          } as any}
        />
      ) : (
        <div ref={containerRef} className="absolute inset-0" />
      )}

      {/* Loading */}
      {sessionState === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: "rgba(245,230,211,0.96)" }}>
          <button onClick={onClose}
            className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(139,94,60,0.18)" }}>
            <X size={18} color="#8B5E3C" />
          </button>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "#FFFBF5" }}>
            <Loader2 size={28} color="#8B5E3C" strokeWidth={2} className="animate-spin" />
          </div>
          <p className="text-sm font-semibold" style={{ color: "#8B5E3C" }}>Memuat model AR...</p>
          <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ background: "#E8D5C0" }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #C4956A, #D4A574)" }} />
          </div>
          <p className="text-xs" style={{ color: "#C4956A" }}>
            {progress > 0 ? `${progress}%` : "Menyiapkan..."}
          </p>
        </div>
      )}

      {/* Ready */}
      {sessionState === "ready" && (
        <>
          <button onClick={onClose}
            className="absolute top-4 left-4 z-[101] w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(44,24,16,0.65)", backdropFilter: "blur(6px)" }}>
            <X size={18} color="#FDF6EC" />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[101] px-4 py-2 rounded-full"
            style={{ background: "rgba(44,24,16,0.55)", backdropFilter: "blur(6px)" }}>
            <p className="text-sm font-semibold whitespace-nowrap" style={{ color: "#FDF6EC" }}>
              {menuName}
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 z-[101] px-5 pb-8 pt-12"
            style={{ background: "linear-gradient(to top, rgba(44,24,16,0.88) 0%, transparent 100%)" }}>
            <p className="text-center text-xs mb-3" style={{ color: "rgba(253,246,236,0.65)" }}>
              👆 Drag untuk memutar model
            </p>
            <button onClick={triggerAR} disabled={arStarting}
              className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #8B5E3C, #C4956A)", color: "#FDF6EC",
                boxShadow: "0 4px 24px rgba(139,94,60,0.45)",
                opacity: arStarting ? 0.7 : 1 }}>
              {arStarting
                ? <><Loader2 size={18} strokeWidth={2} className="animate-spin" />Memulai AR...</>
                : <><Scan size={18} strokeWidth={2} />Mulai AR — Arahkan ke Permukaan Datar</>
              }
            </button>
          </div>
        </>
      )}



      {/* Overlay blocked — specific helpful message */}
      {sessionState === "overlay_blocked" && (
        <div className="absolute inset-0 z-[101] flex flex-col items-end justify-end"
          style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full rounded-t-3xl px-5 pt-5 pb-8" style={{ background: "#FFFBF5" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "#E8D5C0" }} />
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "#FEF3E8" }}>
                <AlertTriangle size={20} color="#C4956A" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base mb-2" style={{ color: "#2C1810" }}>
                  Ada Aplikasi Mengambang
                </h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "#5C3D2E" }}>
                  Izin kamera diblokir oleh Android karena ada aplikasi yang tampil di atas layar.
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#8B5E3C" }}>
                  Tutup terlebih dahulu:
                </p>
                <ul className="text-xs mt-1.5 space-y-1" style={{ color: "#8B5E3C" }}>
                  <li>• Chat bubble WhatsApp / Telegram</li>
                  <li>• Notifikasi mengambang TrueCaller</li>
                  <li>• Floating window aplikasi lain</li>
                </ul>
              </div>
            </div>
            {/* Deep link to Android "Display over other apps" settings */}
            <a
              href="intent:#Intent;action=android.settings.action.MANAGE_OVERLAY_PERMISSION;end"
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 mb-3"
              style={{ background: "#FEF3E8", color: "#C4956A", border: "1px solid #E8D5C0" }}
            >
              Buka Pengaturan Android →
            </a>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: "#F5E6D3", color: "#8B5E3C" }}>
                Kembali
              </button>
              <button onClick={retryAR}
                className="flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: "#8B5E3C", color: "#FDF6EC" }}>
                <RotateCcw size={14} />
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsupported */}
      {sessionState === "unsupported" && (
        <>
          <button onClick={onClose}
            className="absolute top-4 left-4 z-[101] w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(44,24,16,0.65)", backdropFilter: "blur(6px)" }}>
            <X size={18} color="#FDF6EC" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 z-[101] rounded-t-3xl px-5 pt-4 pb-8"
            style={{ background: "#FFFBF5", boxShadow: "0 -4px 32px rgba(44,24,16,0.2)" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "#E8D5C0" }} />
            <div className="flex items-start gap-3 mb-5">
              <span className="text-2xl mt-0.5">📱</span>
              <div className="flex-1">
                <h3 className="font-bold text-base mb-1"
                  style={{ color: "#2C1810", fontFamily: "var(--font-playfair)" }}>
                  AR Belum Didukung
                </h3>
                <p className="text-xs leading-relaxed mb-2" style={{ color: "#8B5E3C" }}>
                  Perangkat ini membutuhkan <strong>Google Play Services for AR</strong> untuk menampilkan AR.
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#A0724A" }}>
                  Install dari Play Store, lalu coba lagi.
                </p>
              </div>
            </div>
            <a
              href="https://play.google.com/store/apps/details?id=com.google.ar.core"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 mb-3"
              style={{ background: "linear-gradient(135deg, #8B5E3C, #C4956A)", color: "#FDF6EC",
                boxShadow: "0 4px 24px rgba(139,94,60,0.45)" }}>
              Install Google AR Services →
            </a>
            <button onClick={onClose}
              className="w-full py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "#F5E6D3", color: "#8B5E3C" }}>
              Kembali ke Detail Menu
            </button>
          </div>
        </>
      )}

      {/* Error */}
      {sessionState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
          style={{ background: "rgba(245,230,211,0.97)" }}>
          <p className="font-semibold" style={{ color: "#2C1810" }}>Gagal memuat model</p>
          <p className="text-sm" style={{ color: "#C4956A" }}>Cek koneksi internet kamu</p>
          <button onClick={onClose}
            className="px-8 py-3 rounded-2xl text-sm font-semibold"
            style={{ background: "#8B5E3C", color: "#FDF6EC" }}>
            Kembali
          </button>
        </div>
      )}

      {/* WebXR DOM Overlay Container */}
      <div ref={uiOverlayRef} className="absolute inset-0 pointer-events-none z-[101]">
        {sessionState === "active" && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[101] pointer-events-auto">
            <button onClick={triggerAR}
              className="px-6 py-3 rounded-full font-semibold text-sm flex items-center gap-2 active:scale-95 transition-transform"
              style={{ background: "rgba(44,24,16,0.75)", color: "#FDF6EC", backdropFilter: "blur(8px)" }}>
              <X size={16} />
              Keluar AR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
