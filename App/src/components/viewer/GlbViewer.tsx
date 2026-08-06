"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, RotateCcw } from "lucide-react";

interface GlbViewerProps {
  url: string;
  onReady?: () => void;
  onError?: (msg: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onGltfLoaded?: (gltf: any) => void;
  /** Admin-set default scale; customer slider multiplies on top of this. */
  modelScale?: number;
  /** Menyerahkan fungsi pengambil frame ke induk setelah model siap. */
  onCaptureReady?: (capture: (() => string | null) | null) => void;
}

export default function GlbViewer({
  url,
  onReady,
  onError,
  onGltfLoaded,
  modelScale = 1.0,
  onCaptureReady,
}: GlbViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const frameRef = useRef<number>(0);
  // Listener window (mousemove/mouseup/resize) didaftarkan di dalam init().
  // Cleanup-nya disimpan di sini supaya effect cleanup — dan re-init lewat
  // tombol Coba Lagi — benar-benar melepasnya, bukan menumpuknya.
  const listenersCleanupRef = useRef<(() => void) | null>(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const init = useCallback(async () => {
    if (!containerRef.current) return;
    setState("loading");
    setProgress(0);

    if (rendererRef.current) {
      cancelAnimationFrame(frameRef.current);
      try { rendererRef.current.forceContextLoss(); } catch { /* noop */ }
      rendererRef.current.dispose();
      rendererRef.current = null;
      containerRef.current.innerHTML = "";
    }
    // Lepas listener dari init sebelumnya (mis. tombol Coba Lagi) supaya
    // tidak menumpuk — handler lama memegang kamera/renderer usang.
    listenersCleanupRef.current?.();
    listenersCleanupRef.current = null;

    try {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
      const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");

      setProgress(20);

      const container = containerRef.current;
      if (!container) return;

      const w = container.clientWidth;
      const h = container.clientHeight;

      // Scene — tanpa background: renderer alpha membiarkan gradient shell
      // (CSS di Viewer3DPage) terlihat, jadi model tidak mengambang di atas
      // bidang navy datar.
      const scene = new THREE.Scene();

      // Camera
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(w, h);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.domElement.style.position = "absolute";
      renderer.domElement.style.top = "0";
      renderer.domElement.style.left = "0";
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.userSelect = "none";
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambient);
      const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
      dirLight.position.set(5, 10, 7);
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
      fillLight.position.set(-5, 5, -5);
      scene.add(fillLight);

      setProgress(40);

      // Load GLB (with Draco support for compressed models)
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
      loader.setDRACOLoader(draco);
      loader.setMeshoptDecoder(MeshoptDecoder); // Tripo compress:"geometry" emits EXT_meshopt_compression
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          url,
          resolve,
          (xhr) => {
            if (xhr.total > 0) setProgress(40 + Math.round((xhr.loaded / xhr.total) * 50));
          },
          reject
        );
      });

      onGltfLoaded?.(gltf);
      setProgress(95);

      const model = gltf.scene;

      // Fit camera to model bounding box
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      // Wrap in a pivot so scaling happens around the visual center.
      const pivot = new THREE.Group();
      pivot.add(model);
      scene.add(pivot);
      const base = modelScale && modelScale > 0 ? modelScale : 1;
      pivot.scale.setScalar(base);

      // Blob shadow — bayangan kontak murah (canvas radial gradient, tanpa
      // shadow map) supaya model "berdiri" di permukaan, bukan mengambang.
      const maxDim = Math.max(size.x, size.y, size.z);
      const shadowCanvas = document.createElement("canvas");
      shadowCanvas.width = shadowCanvas.height = 256;
      const shadowCtx = shadowCanvas.getContext("2d")!;
      const shadowGrad = shadowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
      shadowGrad.addColorStop(0, "rgba(0,10,30,0.5)");
      shadowGrad.addColorStop(0.6, "rgba(0,10,30,0.25)");
      shadowGrad.addColorStop(1, "rgba(0,10,30,0)");
      shadowCtx.fillStyle = shadowGrad;
      shadowCtx.fillRect(0, 0, 256, 256);
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 48),
        new THREE.MeshBasicMaterial({
          map: new THREE.CanvasTexture(shadowCanvas),
          transparent: true,
          depthWrite: false,
        })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.setScalar(Math.max(size.x, size.z) * 1.35);
      shadow.position.y = -size.y / 2 - maxDim * 0.01;
      pivot.add(shadow);

      let dist = maxDim * 1.6;
      camera.near = maxDim * 0.001;
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();

      // Spherical coords for manual rotation
      const initialDist = dist;
      let theta = 0;       // horizontal angle
      let phi = 1.1;       // vertical angle (radians from top)
      let autoRotating = true;
      let idleTimer: number | undefined;
      let dragMoved = false;
      let lastTapAt = 0;

      const updateCamera = () => {
        camera.position.set(
          dist * Math.sin(phi) * Math.sin(theta),
          dist * Math.cos(phi),
          dist * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(0, 0, 0);
      };
      updateCamera();

      const resetView = () => {
        theta = 0;
        phi = 1.1;
        dist = initialDist;
        autoRotating = true;
        updateCamera();
      };

      // Rotasi otomatis hidup lagi setelah tamu berhenti memutar beberapa detik.
      const scheduleAutoRotate = () => {
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => { autoRotating = true; }, 4000);
      };

      // Drag handler (mouse + touch)
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      const onDragStart = (x: number, y: number) => {
        dragging = true;
        dragMoved = false;
        autoRotating = false;
        window.clearTimeout(idleTimer);
        lastX = x;
        lastY = y;
      };
      const onDragMove = (x: number, y: number) => {
        if (!dragging) return;
        const dx = x - lastX;
        const dy = y - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
        lastX = x;
        lastY = y;
        theta -= dx * 0.012;
        phi -= dy * 0.012;
        phi = Math.max(0.15, Math.min(Math.PI - 0.15, phi));
        updateCamera();
      };
      const onDragEnd = () => {
        dragging = false;
        scheduleAutoRotate();
      };

      // Mouse
      const onMouseDown = (e: MouseEvent) => onDragStart(e.clientX, e.clientY);
      const onMouseMove = (e: MouseEvent) => onDragMove(e.clientX, e.clientY);
      const onMouseUp = () => onDragEnd();

      // Touch — single finger: rotate, two fingers: pinch-to-zoom
      let pinchDist0 = 0;
      let distAtPinch = dist;

      const getPinchDist = (t: TouchList) =>
        Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          onDragStart(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2) {
          dragging = false;
          lastTapAt = 0; // cubit bukan ketukan ganda
          pinchDist0 = getPinchDist(e.touches);
          distAtPinch = dist;
        }
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          onDragMove(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2 && pinchDist0 > 0) {
          const newDist = getPinchDist(e.touches);
          dist = Math.max(maxDim * 0.5, Math.min(maxDim * 8, distAtPinch * (pinchDist0 / newDist)));
          updateCamera();
        }
      };
      const onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length === 0) {
          // Ketukan ganda tanpa geser = kembalikan sudut pandang awal.
          if (!dragMoved) {
            const now = performance.now();
            if (now - lastTapAt < 300) {
              resetView();
              lastTapAt = 0;
            } else {
              lastTapAt = now;
            }
          }
          onDragEnd();
        }
        if (e.touches.length < 2) pinchDist0 = 0;
      };

      renderer.domElement.addEventListener("mousedown", onMouseDown);
      renderer.domElement.addEventListener("dblclick", resetView);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: false });
      renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
      renderer.domElement.addEventListener("touchend", onTouchEnd);

      // Handle resize
      const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      // Render loop
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        if (autoRotating) {
          theta += 0.005;
          updateCamera();
        }
        renderer.render(scene, camera);
      };
      animate();

      // Renderer dibuat tanpa preserveDrawingBuffer supaya tidak menanggung
      // biaya salinan buffer di tiap frame. Konsekuensinya, isi canvas hanya
      // terbaca kalau render dan pembacaan terjadi dalam satu task yang sama —
      // karena itu render dipanggil ulang tepat sebelum toDataURL.
      captureRef.current = () => {
        try {
          // Foto share memakai latar navy brand — frame live transparan akan
          // jadi abu terang setelah dicompose di atas backdrop kertas.
          scene.background = new THREE.Color(0x002355);
          renderer.render(scene, camera);
          const dataUrl = renderer.domElement.toDataURL("image/png");
          scene.background = null;
          return dataUrl;
        } catch {
          return null;
        }
      };
      onCaptureReady?.(captureRef.current);

      setProgress(100);
      setState("ready");
      onReady?.();

      listenersCleanupRef.current = () => {
        captureRef.current = null;
        onCaptureReady?.(null);
        window.clearTimeout(idleTimer);
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
        renderer.domElement.removeEventListener("dblclick", resetView);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        renderer.domElement.removeEventListener("touchstart", onTouchStart);
        renderer.domElement.removeEventListener("touchmove", onTouchMove);
        renderer.domElement.removeEventListener("touchend", onTouchEnd);
      };
    } catch (err) {
      console.error("[GlbViewer]", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setState("error");
      onError?.(msg);
    }
  }, [url, onReady, onError, onCaptureReady]);

  useEffect(() => {
    init();
    return () => {
      cancelAnimationFrame(frameRef.current);
      listenersCleanupRef.current?.();
      listenersCleanupRef.current = null;
      if (rendererRef.current) {
        try { rendererRef.current.forceContextLoss(); } catch { /* noop */ }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [init]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

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
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #022C60, #FD5002)" }}
            />
          </div>
          <p className="text-base font-bold" style={{ color: "#FDFDFD" }}>
            {progress > 0 ? `${progress}%` : "Menyiapkan..."}
          </p>
        </div>
      )}

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
            onClick={init}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ background: "#FD5002" }}
          >
            <RotateCcw size={14} />
            Coba Lagi
          </button>
        </div>
      )}
    </div>
  );
}
