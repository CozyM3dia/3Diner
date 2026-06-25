"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, Scan, AlertTriangle, RotateCcw } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";
import GlbViewer from "./GlbViewer";

// model-viewer v3.4.0 — same version as tgo.4d-menu.com
const MV_CDN = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
const ModelViewerEl = "model-viewer" as any;

async function loadModelViewerCDN(): Promise<void> {
  if (typeof customElements === "undefined") return;
  if (customElements.get("model-viewer")) return;
  const s = document.createElement("script");
  s.type = "module";
  s.src = MV_CDN;
  document.head.appendChild(s);
  await customElements.whenDefined("model-viewer");
}

interface ARSessionProps {
  url: string;
  usdzUrl?: string;
  menuName: string;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preloadedGltf?: any;
}

type GlbState = "loading" | "ready" | "ar" | "unsupported" | "error";
type PlyState = "loading" | "ready" | "unsupported" | "active" | "overlay_blocked" | "error";

export default function ARSession({ url, usdzUrl, menuName, onClose, preloadedGltf }: ARSessionProps) {
  const isGlb = url.toLowerCase().endsWith(".glb");

  return isGlb ? (
    <GlbAR url={url} usdzUrl={usdzUrl} menuName={menuName} onClose={onClose} preloadedGltf={preloadedGltf} />
  ) : (
    <PlyAR url={url} menuName={menuName} onClose={onClose} />
  );
}

function GlbAR({ url, usdzUrl, menuName: _menuName, onClose, preloadedGltf }: ARSessionProps) {
  const [state, setState] = useState<GlbState>("loading");
  const [arStarted, setArStarted] = useState(false);
  const [modelPlaced, setModelPlaced] = useState(false);
  const sessionEndRef = useRef<(() => void) | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasSlotRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    startAR();
    return () => { sessionEndRef.current?.(); };
  }, []);

  async function startAR() {
    // iOS: USDZ QuickLook — trigger and return immediately
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      if (usdzUrl) {
        const a = document.createElement("a");
        a.setAttribute("rel", "ar");
        a.href = usdzUrl;
        const img = new Image(); img.src = usdzUrl;
        a.appendChild(img);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 200);
        onClose();
        return;
      }
      setState("unsupported");
      return;
    }

    const supported = await navigator.xr?.isSessionSupported("immersive-ar").catch(() => false);
    if (!supported) { setState("unsupported"); return; }

    try {
      const THREE = await import("three");

      let gltf: any = preloadedGltf;
      if (!gltf) {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        gltf = await new Promise<any>((res, rej) =>
          new GLTFLoader().load(url, res, undefined, rej)
        );
      }

      const model = (gltf.scene as any).clone(true);
      model.updateMatrixWorld(true);

      // Normalize: scale to ~0.35m, base at y=0
      const box0 = new THREE.Box3().setFromObject(model);
      const size0 = box0.getSize(new THREE.Vector3());
      const center0 = box0.getCenter(new THREE.Vector3());
      const maxDim0 = Math.max(size0.x, size0.y, size0.z);
      const s = maxDim0 > 0.001 ? 0.35 / maxDim0 : 0.35;
      model.scale.setScalar(s);
      model.position.set(-center0.x * s, -box0.min.y * s, -center0.z * s);

      const group = new THREE.Group();
      group.add(model);
      group.visible = false;

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.5));
      const sun = new THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(1, 3, 2);
      scene.add(sun);
      scene.add(group);

      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      renderer.setPixelRatio(1); // force 1:1 — reduces GPU load ~55% vs 1.5x, slows thermal throttle
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.LinearToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local");
      // Render XR framebuffer at 60% of native resolution — cuts GPU work ~64%,
      // delays thermal throttle significantly. Imperceptible at phone viewing distance.
      renderer.xr.setFramebufferScaleFactor(0.6);
      Object.assign(renderer.domElement.style, {
        position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
      });
      canvasSlotRef.current!.appendChild(renderer.domElement);

      // Pre-warm shaders + textures before XR session opens
      group.visible = true;
      renderer.compile(scene, camera);
      scene.traverse((obj: any) => {
        if (!obj.isMesh) return;
        const mats: any[] = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          Object.values(mat).forEach((val: any) => {
            if (val?.isTexture) renderer.initTexture(val);
          });
        });
      });
      group.visible = false;

      const session = await (navigator.xr as any).requestSession("immersive-ar", {
        optionalFeatures: ["hit-test", "dom-overlay"],
        domOverlay: { root: overlayRef.current },
      });
      await renderer.xr.setSession(session);

      // Cap XR frame rate at 30fps — halves GPU work and prevents thermal throttle.
      // This is how model-viewer avoids lag; our raw Three.js loop runs at 60fps by default.
      try {
        if (typeof (session as any).updateTargetFrameRate === "function") {
          await (session as any).updateTargetFrameRate(30);
        }
      } catch { /* Chrome <120 or device doesn't support rate control — stays at 60fps */ }

      setState("ar");
      setArStarted(true);

      // Hit-test source from viewer (camera forward ray)
      let hitTestSource: any = null;
      try {
        const viewerSpace = await (session as any).requestReferenceSpace("viewer");
        hitTestSource = await (session as any).requestHitTestSource({ space: viewerSpace });
      } catch { /* fallback: fixed placement */ }

      const hitPos = new THREE.Vector3();
      const hitQuat = new THREE.Quaternion();
      const hitScale = new THREE.Vector3();
      const hitMatrix = new THREE.Matrix4();

      // Single-finger drag → rotate model Y (always active once visible)
      let rotating = false;
      let lastRotX = 0;
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) { rotating = true; lastRotX = e.touches[0].clientX; }
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!rotating || !group.visible || e.touches.length !== 1) return;
        group.rotation.y += (e.touches[0].clientX - lastRotX) * 0.015;
        lastRotX = e.touches[0].clientX;
      };
      const onTouchEnd = () => { rotating = false; };
      const overlay = overlayRef.current;
      overlay?.addEventListener("touchstart", onTouchStart, { passive: true });
      overlay?.addEventListener("touchmove", onTouchMove, { passive: true });
      overlay?.addEventListener("touchend", onTouchEnd);

      let placed = false;

      renderer.setAnimationLoop((_: number, frame: any) => {
        if (!placed && frame) {
          if (hitTestSource) {
            const hits = frame.getHitTestResults(hitTestSource);
            if (hits.length > 0) {
              const refSpace = renderer.xr.getReferenceSpace();
              const pose = hits[0].getPose(refSpace);
              if (pose) {
                hitMatrix.fromArray(pose.transform.matrix);
                hitMatrix.decompose(hitPos, hitQuat, hitScale);
                // Y > -1.2 in "local" space = elevated surface (table), not floor
                if (hitPos.y > -1.2) {
                  group.position.copy(hitPos);
                  group.visible = true;
                  placed = true;          // lock position forever
                  hitTestSource.cancel(); // stop hit-test → eliminates GC lag
                  hitTestSource = null;
                  setModelPlaced(true);   // reveal camera + model together
                }
              }
            }
          } else {
            // No hit-test: place once using camera forward ray
            const xrCam = renderer.xr.getCamera();
            const p = new THREE.Vector3();
            const d = new THREE.Vector3();
            xrCam.getWorldPosition(p);
            xrCam.getWorldDirection(d);
            group.position.set(p.x + d.x * 0.6, p.y - 0.8, p.z + d.z * 0.6);
            group.visible = true;
            placed = true;
            setModelPlaced(true);
          }
        }
        renderer.render(scene, camera);
      });

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        overlay?.removeEventListener("touchstart", onTouchStart);
        overlay?.removeEventListener("touchmove", onTouchMove);
        overlay?.removeEventListener("touchend", onTouchEnd);
        hitTestSource?.cancel();
        renderer.setAnimationLoop(null);
        renderer.domElement.remove();
        renderer.dispose();
        sessionEndRef.current = null;
        setArStarted(false);
        onClose();
      };

      session.addEventListener("end", cleanup);
      sessionEndRef.current = () => { (session as any).end().catch(() => {}); };

    } catch (err) {
      console.error("[GlbAR]", err);
      canvasSlotRef.current?.querySelectorAll("canvas").forEach(c => c.remove());
      sessionEndRef.current = null;
      setArStarted(false);
      setState("unsupported");
    }
  }

  const exitAR = () => sessionEndRef.current?.();

  return (
    <div className="fixed inset-0 z-[100]" style={{ background: arStarted ? "transparent" : "#002355" }}>
      <div ref={canvasSlotRef} className="absolute inset-0" />

      {/* DOM overlay root — always mounted for WebXR registration */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        {/* Full-screen loading before XR camera is ready */}
        {!arStarted && state !== "unsupported" && state !== "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "#002355" }}>
            <Loader2 size={28} color="#FD5002" strokeWidth={2} className="animate-spin" />
            <p className="text-sm font-semibold" style={{ color: "#FDFDFD" }}>Menyiapkan AR...</p>
          </div>
        )}

        {/* Floating guidance toast over camera feed when scanning for table */}
        {arStarted && !modelPlaced && state !== "unsupported" && state !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="px-5 py-3.5 rounded-2xl flex items-center gap-3 shadow-2xl"
              style={{ background: "rgba(0,35,85,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(253,253,253,0.1)" }}>
              <Loader2 size={18} color="#FD5002" strokeWidth={2.5} className="animate-spin" />
              <div className="flex flex-col">
                <p className="text-sm font-semibold" style={{ color: "#FDFDFD" }}>Arahkan ke permukaan meja</p>
                <p className="text-[10px]" style={{ color: "rgba(253,253,253,0.7)" }}>Gerakkan ponsel Anda perlahan</p>
              </div>
            </div>
          </div>
        )}

        {/* Exit button: always show once XR starts so user is never trapped */}
        {state === "ar" && arStarted && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto">
            <button onClick={exitAR}
              className="px-6 py-3 rounded-full font-semibold text-sm flex items-center gap-2"
              style={{ background: "rgba(0,35,85,0.8)", color: "#FDFDFD", backdropFilter: "blur(8px)" }}>
              <X size={16} /> Keluar AR
            </button>
          </div>
        )}
      </div>

      {/* Unsupported */}
      {state === "unsupported" && (
        <>
          <button onClick={onClose}
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,35,85,0.7)", backdropFilter: "blur(6px)" }}>
            <X size={18} color="#FDFDFD" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 z-10 rounded-t-3xl px-5 pt-4 pb-8"
            style={{ background: "#FDFDFD" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "#CFD9E4" }} />
            <div className="flex items-start gap-3 mb-5">
              <span className="text-2xl mt-0.5">📱</span>
              <div className="flex-1">
                <h3 className="font-bold text-base mb-1" style={{ color: "#022C60" }}>AR Belum Didukung</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#51698F" }}>
                  Perangkat ini membutuhkan <strong>Google Play Services for AR</strong>.
                </p>
              </div>
            </div>
            <a href="https://play.google.com/store/apps/details?id=com.google.ar.core"
              target="_blank" rel="noopener noreferrer"
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 mb-3 text-white"
              style={{ background: "linear-gradient(135deg, #FD5002, #FC6A41)" }}>
              Install Google AR Services →
            </a>
            <button onClick={onClose}
              className="w-full py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "#E0E7EE", color: "#022C60" }}>
              Kembali ke Detail Menu
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PLY AR via Gaussian Splatting + WebXR ────────────────────────────────────

function PlyAR({ url, menuName, onClose }: { url: string; menuName: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uiOverlayRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [state, setState] = useState<PlyState>("loading");
  const [progress, setProgress] = useState(0);
  const [arStarting, setArStarting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
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
                domOverlay: { root: uiOverlayRef.current! },
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
        onProgress: (pct: number) => { if (mounted) setProgress(Math.min(100, Math.round(pct))); },
      });

      if (!mounted) return;

      viewer.start();

      if (!arSupported) {
        const THREE = await import("three");
        fitCameraToModel(viewer, THREE);
      }

      if (arSupported && viewer.renderer?.xr) {
        viewer.renderer.xr.addEventListener("sessionstart", async () => {
          if (mounted) setState("active");
          const mesh = viewer.splatMesh;
          if (!mesh) return;
          try {
            const THREE = await import("three");
            const bb = mesh.computeBoundingBox(true);
            if (bb) {
              const size = new THREE.Vector3();
              const center = new THREE.Vector3();
              bb.getSize(size);
              bb.getCenter(center);
              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 0) {
                const scale = 0.20 / maxDim;
                mesh.scale.set(scale, scale, scale);
                mesh.position.set(-center.x * scale, -center.y * scale - 0.3, -center.z * scale - 0.5);
                mesh.updateMatrixWorld(true);
              }
            }
          } catch { /* noop */ }
        });
        viewer.renderer.xr.addEventListener("sessionend", () => { if (mounted) setState("ready"); });
      }

      if (mounted) setState(arSupported ? "ready" : "unsupported");
    }

    init().catch((err) => {
      console.error("[PlyAR]", err);
      if (mounted) setState("error");
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
    if (!navigator.xr || !uiOverlayRef.current) { setState("unsupported"); return; }
    if (state === "active") {
      const session = viewerRef.current?.renderer?.xr?.getSession();
      if (session) try { await session.end(); } catch { /* noop */ }
      return;
    }

    setArStarting(true);
    const timeout = setTimeout(() => { setArStarting(false); setState("overlay_blocked"); }, 6000);

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
      if (err instanceof DOMException && err.name === "NotAllowedError") setState("overlay_blocked");
      else if (err instanceof DOMException && err.name === "NotSupportedError") setState("unsupported");
      else setState("error");
    }
  }, [state]);

  return (
    <div className="fixed inset-0 z-[100] bg-black" style={{ touchAction: "none" }}>
      <div ref={containerRef} className="absolute inset-0" />

      {state === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "rgba(0,35,85,0.96)" }}>
          <button onClick={onClose} className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(253,253,253,0.15)" }}>
            <X size={18} color="#FDFDFD" />
          </button>
          <Loader2 size={28} color="#FD5002" strokeWidth={2} className="animate-spin" />
          <p className="text-sm font-semibold" style={{ color: "#FDFDFD" }}>Memuat model AR...</p>
          <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(253,253,253,0.15)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #022C60, #FD5002)" }} />
          </div>
          <p className="text-xs" style={{ color: "rgba(253,253,253,0.7)" }}>{progress > 0 ? `${progress}%` : "Menyiapkan..."}</p>
        </div>
      )}

      {state === "ready" && (
        <>
          <button onClick={onClose} className="absolute top-4 left-4 z-[101] w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,35,85,0.7)", backdropFilter: "blur(6px)" }}>
            <X size={18} color="#FDFDFD" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 z-[101] px-5 pb-8 pt-12" style={{ background: "linear-gradient(to top, rgba(0,35,85,0.9) 0%, transparent 100%)" }}>
            <button onClick={triggerAR} disabled={arStarting}
              className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #FD5002, #FC6A41)", color: "#FDFDFD", boxShadow: "0 4px 24px rgba(253,80,2,0.45)", opacity: arStarting ? 0.7 : 1 }}>
              {arStarting ? <><Loader2 size={18} className="animate-spin" />Memulai AR...</> : <><Scan size={18} />Mulai AR — Arahkan ke Permukaan Datar</>}
            </button>
          </div>
        </>
      )}

      {state === "overlay_blocked" && (
        <div className="absolute inset-0 z-[101] flex flex-col items-end justify-end" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full rounded-t-3xl px-5 pt-5 pb-8" style={{ background: "#FDFDFD" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "#CFD9E4" }} />
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#FDD8C3" }}>
                <AlertTriangle size={20} color="#FD5002" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base mb-2" style={{ color: "#022C60" }}>Ada Aplikasi Mengambang</h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "#254473" }}>Izin kamera diblokir oleh Android karena ada aplikasi yang tampil di atas layar.</p>
                <ul className="text-xs mt-1.5 space-y-1" style={{ color: "#51698F" }}>
                  <li>• Chat bubble WhatsApp / Telegram</li>
                  <li>• Floating window aplikasi lain</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: "#E0E7EE", color: "#022C60" }}>Kembali</button>
              <button onClick={() => setState("ready")} className="flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 text-white" style={{ background: "#FD5002" }}>
                <RotateCcw size={14} />Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {state === "unsupported" && (
        <>
          <button onClick={onClose} className="absolute top-4 left-4 z-[101] w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,35,85,0.7)", backdropFilter: "blur(6px)" }}>
            <X size={18} color="#FDFDFD" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 z-[101] rounded-t-3xl px-5 pt-4 pb-8" style={{ background: "#FDFDFD" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "#CFD9E4" }} />
            <div className="flex items-start gap-3 mb-5">
              <span className="text-2xl">📱</span>
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: "#022C60" }}>AR Belum Didukung</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#51698F" }}>Perangkat ini membutuhkan Google Play Services for AR.</p>
              </div>
            </div>
            <a href="https://play.google.com/store/apps/details?id=com.google.ar.core" target="_blank" rel="noopener noreferrer"
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 mb-3 text-white"
              style={{ background: "linear-gradient(135deg, #FD5002, #FC6A41)" }}>
              Install Google AR Services →
            </a>
            <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ background: "#E0E7EE", color: "#022C60" }}>Kembali</button>
          </div>
        </>
      )}

      {state === "error" && (
        <div className="absolute inset-0 z-[101] flex flex-col items-center justify-center gap-4" style={{ background: "rgba(0,35,85,0.97)" }}>
          <p className="font-semibold" style={{ color: "#FDFDFD" }}>Gagal memuat model</p>
          <button onClick={onClose} className="px-8 py-3 rounded-2xl text-sm font-semibold text-white" style={{ background: "#FD5002" }}>Kembali</button>
        </div>
      )}

      <div ref={uiOverlayRef} className="absolute inset-0 pointer-events-none z-[101]">
        {state === "active" && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
            <button onClick={triggerAR} className="px-6 py-3 rounded-full font-semibold text-sm flex items-center gap-2" style={{ background: "rgba(0,35,85,0.8)", color: "#FDFDFD", backdropFilter: "blur(8px)" }}>
              <X size={16} />Keluar AR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
