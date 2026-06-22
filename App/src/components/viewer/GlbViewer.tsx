"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, RotateCcw } from "lucide-react";

interface GlbViewerProps {
  url: string;
  onReady?: () => void;
  onError?: (msg: string) => void;
}

export default function GlbViewer({ url, onReady, onError }: GlbViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const frameRef = useRef<number>(0);
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

    try {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

      setProgress(20);

      const container = containerRef.current;
      if (!container) return;

      const w = container.clientWidth;
      const h = container.clientHeight;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x002355);

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

      // Load GLB
      const loader = new GLTFLoader();
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

      setProgress(95);

      const model = gltf.scene;
      scene.add(model);

      // Fit camera to model bounding box
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim * 2.2;
      camera.near = maxDim * 0.001;
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();

      // Spherical coords for manual rotation
      let theta = 0;       // horizontal angle
      let phi = 1.1;       // vertical angle (radians from top)
      let autoRotating = true;

      const updateCamera = () => {
        camera.position.set(
          dist * Math.sin(phi) * Math.sin(theta),
          dist * Math.cos(phi),
          dist * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(0, 0, 0);
      };
      updateCamera();

      // Drag handler (mouse + touch)
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      const onDragStart = (x: number, y: number) => {
        dragging = true;
        autoRotating = false;
        lastX = x;
        lastY = y;
      };
      const onDragMove = (x: number, y: number) => {
        if (!dragging) return;
        const dx = x - lastX;
        const dy = y - lastY;
        lastX = x;
        lastY = y;
        theta -= dx * 0.012;
        phi -= dy * 0.012;
        phi = Math.max(0.15, Math.min(Math.PI - 0.15, phi));
        updateCamera();
      };
      const onDragEnd = () => { dragging = false; };

      // Mouse
      const onMouseDown = (e: MouseEvent) => onDragStart(e.clientX, e.clientY);
      const onMouseMove = (e: MouseEvent) => onDragMove(e.clientX, e.clientY);
      const onMouseUp = () => onDragEnd();

      // Touch
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          e.preventDefault();
          onDragStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      };
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          e.preventDefault();
          onDragMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      };
      const onTouchEnd = () => onDragEnd();

      renderer.domElement.addEventListener("mousedown", onMouseDown);
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

      setProgress(100);
      setState("ready");
      onReady?.();

      return () => {
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
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
  }, [url, onReady, onError]);

  useEffect(() => {
    init();
    return () => {
      cancelAnimationFrame(frameRef.current);
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
