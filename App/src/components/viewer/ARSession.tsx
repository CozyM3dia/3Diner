"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, Scan, AlertTriangle, RotateCcw } from "lucide-react";
import { fitCameraToModel } from "@/lib/fit-camera";
import type { Group, Material } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Viewer } from "@mkkellogg/gaussian-splats-3d";

interface ARSessionProps {
  url: string;
  usdzUrl?: string;
  menuName: string;
  onClose: () => void;
  preloadedGltf?: GLTF;
  /** Admin-set default scale; pinch/slider multiplies on top of this base. */
  modelScale?: number;
}

type GlbState = "loading" | "ready" | "ar" | "unsupported" | "error";
type PlyState = "loading" | "ready" | "unsupported" | "active" | "overlay_blocked" | "error";

export default function ARSession({ url, usdzUrl, menuName, onClose, preloadedGltf, modelScale = 1.0 }: ARSessionProps) {
  const isGlb = url.toLowerCase().endsWith(".glb");

  return isGlb ? (
    <GlbAR url={url} usdzUrl={usdzUrl} menuName={menuName} onClose={onClose} preloadedGltf={preloadedGltf} modelScale={modelScale} />
  ) : (
    <PlyAR url={url} onClose={onClose} />
  );
}

function GlbAR({ url, usdzUrl, onClose, preloadedGltf, modelScale = 1.0 }: ARSessionProps) {
  const [state, setState] = useState<GlbState>("loading");
  const [modelPlaced, setModelPlaced] = useState(false);     // provisional model is visible
  const [modelAnchored, setModelAnchored] = useState(false); // settled onto a real surface
  const [searchingSurface, setSearchingSurface] = useState(false); // show "move phone" hint
  const [rotateHintDismissed, setRotateHintDismissed] = useState(false);
  const sessionEndRef = useRef<(() => void) | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasSlotRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<Group | null>(null);
  const userScaleRef = useRef(1);
  const rotateHintElRef = useRef<HTMLDivElement>(null);
  const showRotateHint = modelAnchored && !rotateHintDismissed;

  const startAR = useCallback(async () => {
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

      let gltf: GLTF;
      if (preloadedGltf) {
        gltf = preloadedGltf;
      } else {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
        const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
        const loader = new GLTFLoader();
        const draco = new DRACOLoader();
        draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
        loader.setDRACOLoader(draco);
        loader.setMeshoptDecoder(MeshoptDecoder); // Tripo compress:"geometry" emits EXT_meshopt_compression
        gltf = await new Promise<GLTF>((res, rej) =>
          loader.load(url, res, undefined, rej)
        );
      }

      const model = gltf.scene.clone(true);
      model.updateMatrixWorld(true);

      // Normalize: scale to ~0.35m, base at y=0
      const box0 = new THREE.Box3().setFromObject(model);
      const size0 = box0.getSize(new THREE.Vector3());
      const center0 = box0.getCenter(new THREE.Vector3());
      const maxDim0 = Math.max(size0.x, size0.y, size0.z);
      const baseScale = maxDim0 > 0.001 ? 0.35 / maxDim0 : 0.35;
      const s = baseScale * (modelScale && modelScale > 0 ? modelScale : 1);
      model.scale.setScalar(s);
      model.position.set(-center0.x * s, -box0.min.y * s, -center0.z * s);

      const group = new THREE.Group();
      group.add(model);
      group.visible = false;
      groupRef.current = group;
      userScaleRef.current = 1;

      // Collect the model's materials so we can fade it while it's still floating
      // (provisional ~50%) and pop to full opacity once it settles on the surface.
      const modelMats: Material[] = [];
      model.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((material) => {
          if (!modelMats.includes(material)) {
            material.userData._origTransparent = material.transparent;
            material.userData._origOpacity = material.opacity;
            modelMats.push(material);
          }
        });
      });
      const setModelOpacity = (factor: number) => {
        modelMats.forEach((material) => {
          if (factor < 1) {
            material.transparent = true;
            material.opacity = (material.userData._origOpacity as number | undefined ?? 1) * factor;
          } else {
            material.transparent = material.userData._origTransparent as boolean | undefined ?? false;
            material.opacity = material.userData._origOpacity as number | undefined ?? 1;
          }
          material.needsUpdate = true;
        });
      };

      // Rotation ring — thin blue circle at model base, dragging it rotates the model.
      // RING_OUTER_R stays 0.30 so the touch zone is unchanged; only the visual band is thinner.
      const RING_OUTER_R = 0.30;
      const ringGeo = new THREE.RingGeometry(0.265, RING_OUTER_R, 72);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x2F80FF, transparent: true, opacity: 0.90,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const rotationRing = new THREE.Mesh(ringGeo, ringMat);
      rotationRing.position.y = 0.005;
      rotationRing.visible = false; // hidden while floating; shown once anchored
      group.add(rotationRing);

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
      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mats: Material[] = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          Object.values(mat).forEach((value) => {
            if (value instanceof THREE.Texture) renderer.initTexture(value);
          });
        });
      });
      group.visible = false;

      const xr = navigator.xr;
      if (!xr) {
        setState("unsupported");
        return;
      }
      const session = await xr.requestSession("immersive-ar", {
        optionalFeatures: ["hit-test", "dom-overlay"],
        domOverlay: { root: overlayRef.current! },
      });
      await renderer.xr.setSession(session);

      // Cap XR frame rate at 30fps — halves GPU work and prevents thermal throttle.
      // This is how model-viewer avoids lag; our raw Three.js loop runs at 60fps by default.
      try {
        await session.updateTargetFrameRate?.(30);
      } catch { /* Chrome <120 or device doesn't support rate control — stays at 60fps */ }

      setState("ar");

      // Hit-test source from viewer (camera forward ray)
      let hitTestSource: XRHitTestSource | null = null;
      try {
        const viewerSpace = await session.requestReferenceSpace("viewer");
        const requestedHitTestSource = session.requestHitTestSource?.({ space: viewerSpace });
        if (requestedHitTestSource) hitTestSource = await requestedHitTestSource;
      } catch { /* fallback: fixed placement */ }

      // Transient-input hit test — casts a ray from the FINGER touch point each frame. Lets a
      // dragged model fall onto whatever real surface is under the finger (table edge → floor).
      let transientHitSource: XRTransientInputHitTestSource | null = null;
      try {
        const requestedTransientHitSource = session.requestHitTestSourceForTransientInput?.({
          profile: "generic-touchscreen",
          offsetRay: new XRRay(),
        });
        if (requestedTransientHitSource) transientHitSource = await requestedTransientHitSource;
      } catch { /* not supported — drag falls back to fixed-height plane */ }

      const hitPos = new THREE.Vector3();
      const hitQuat = new THREE.Quaternion();
      const hitScale = new THREE.Vector3();
      const hitMatrix = new THREE.Matrix4();

      // Drag-on-plane: cast a ray from the FINGER position (not camera center) onto a
      // horizontal plane at the model's base. Model follows the finger — camera stays still.
      const raycaster = new THREE.Raycaster();
      const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const dragTarget = new THREE.Vector3();
      const ndc = new THREE.Vector2();

      // Gesture state
      let placed = false;       // true once the model is anchored & interactive
      let anchored = false;     // settled onto a real surface
      let provisional = false;  // shown floating in front of camera, not yet anchored
      let hasSnapTarget = false;
      const snapTarget = new THREE.Vector3();
      const camPos = new THREE.Vector3();
      const camDir = new THREE.Vector3();
      let isDragging = false;
      let isDraggingPending = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragTouchX = 0;
      let dragTouchY = 0;
      let dragGrabOffsetX = 0;
      let dragGrabOffsetZ = 0;
      let isRotatingRing = false;
      let rotateRingStartX = 0;
      let lastPinchDist = 0;
      let lastPinchAngle = 0;
      let lastTapTime = 0;
      // Model projected screen position — updated each frame so touchStart can classify touch zone
      let modelScreenX = window.innerWidth / 2;
      let modelScreenY = window.innerHeight / 2;
      let modelScreenRadius = 120; // pixels to ring outer edge

      // Project the current finger screen pos onto the drag plane → world point. Returns true on hit.
      const fingerToPlane = () => {
        const xrCam = renderer.xr.getCamera();
        const cam = xrCam.cameras.length > 0 ? xrCam.cameras[0] : xrCam;
        // Keep the inverse projection in sync — WebXR sub-cameras don't always update it.
        cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
        ndc.x = (dragTouchX / window.innerWidth) * 2 - 1;
        ndc.y = -(dragTouchY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(ndc, cam);
        return raycaster.ray.intersectPlane(dragPlane, dragTarget) !== null;
      };

      const overlay = overlayRef.current;

      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          isDragging = false;
          isDraggingPending = false;
          isRotatingRing = false;
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          lastPinchDist = Math.hypot(dx, dy);
          lastPinchAngle = Math.atan2(dy, dx);
          return;
        }
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const now = Date.now();
          if (group.visible && anchored) {
            if (now - lastTapTime < 300) {
              // Double-tap: reset scale and re-run the appear → settle flow
              lastTapTime = 0;
              userScaleRef.current = 1;
              group.scale.setScalar(1);
              placed = false;
              anchored = false;
              provisional = false;
              hasSnapTarget = false;
              rotationRing.visible = false;
              setModelOpacity(0.5);
              setModelAnchored(false);
              setSearchingSurface(true);
              return;
            }
            lastTapTime = now;
            // Classify touch zone: ring band → rotation, inside → drag
            const touchDist = Math.hypot(t.clientX - modelScreenX, t.clientY - modelScreenY);
            const ringInnerPx = modelScreenRadius * 0.65;
            const ringOuterPx = modelScreenRadius * 1.55;
            if (touchDist >= ringInnerPx && touchDist <= ringOuterPx) {
              isRotatingRing = true;
              rotateRingStartX = t.clientX;
            } else {
              // Start drag only after finger actually moves (prevents tap-to-teleport)
              isDraggingPending = true;
              dragStartX = t.clientX;
              dragStartY = t.clientY;
            }
          } else {
            lastTapTime = now;
          }
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        if (!anchored) return;
        if (e.touches.length === 2 && group.visible) {
          isDragging = false;
          isDraggingPending = false;
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);
          if (lastPinchDist > 0) {
            let next = userScaleRef.current * (dist / lastPinchDist);
            next = Math.max(0.2, Math.min(5, next));
            userScaleRef.current = next;
            group.scale.setScalar(next);
            group.rotation.y += angle - lastPinchAngle;
          }
          lastPinchDist = dist;
          lastPinchAngle = angle;
          return;
        }
        if (e.touches.length === 1) {
          const t = e.touches[0];
          dragTouchX = t.clientX;
          dragTouchY = t.clientY;
          // Ring drag → rotate Y
          if (isRotatingRing && group.visible) {
            group.rotation.y += (t.clientX - rotateRingStartX) * 0.015;
            rotateRingStartX = t.clientX;
            setRotateHintDismissed(true); // dismiss hint the moment user rotates
          }
          // Activate drag only after real finger movement (>12px threshold)
          if (isDraggingPending) {
            const dx = t.clientX - dragStartX;
            const dy = t.clientY - dragStartY;
            if (Math.hypot(dx, dy) > 12) {
              isDragging = true;
              isDraggingPending = false;
              // Lock the drag plane to the model's current base height, then compute the
              // offset between where the finger grabbed and the model origin so the model
              // doesn't jump under the finger — it slides relative to the grab point.
              dragPlane.constant = -group.position.y;
              if (fingerToPlane()) {
                dragGrabOffsetX = group.position.x - dragTarget.x;
                dragGrabOffsetZ = group.position.z - dragTarget.z;
              } else {
                dragGrabOffsetX = 0;
                dragGrabOffsetZ = 0;
              }
            }
          }
        }
      };

      const onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 1) {
          isDragging = false;
          isDraggingPending = false;
          isRotatingRing = false;
        }
        if (e.touches.length < 2) { lastPinchDist = 0; lastPinchAngle = 0; }
      };

      overlay?.addEventListener("touchstart", onTouchStart, { passive: true });
      overlay?.addEventListener("touchmove", onTouchMove, { passive: true });
      overlay?.addEventListener("touchend", onTouchEnd);

      renderer.setAnimationLoop((_time: number, frame?: XRFrame) => {
        // Finger-drag: move the model under the finger. Camera stays put.
        if (placed && isDragging && group.visible) {
          let droppedOnSurface = false;
          // Prefer the real surface under the finger so the model falls table → floor.
          if (frame && transientHitSource) {
            const refSpace = renderer.xr.getReferenceSpace();
            if (refSpace) {
              const tResults = frame.getHitTestResultsForTransientInput(transientHitSource);
              if (tResults.length > 0 && tResults[0].results.length > 0) {
                const pose = tResults[0].results[0].getPose(refSpace);
                if (pose) {
                  const p = pose.transform.position;
                  group.position.x = p.x + dragGrabOffsetX;
                  group.position.z = p.z + dragGrabOffsetZ;
                  group.position.y = p.y; // sit on whatever surface is under the finger
                  droppedOnSurface = true;
                }
              }
            }
          }
          // Fallback: no transient hit — slide along the locked base plane.
          if (!droppedOnSurface && fingerToPlane()) {
            group.position.x = dragTarget.x + dragGrabOffsetX;
            group.position.z = dragTarget.z + dragGrabOffsetZ;
          }
        }

        // v3: show the model instantly in front of the camera, then glide it onto the first
        // table-height surface ARCore finds — no "Menyiapkan AR" wait while it scans.
        if (frame && !anchored) {
          const xrCam = renderer.xr.getCamera();

          if (!hitTestSource) {
            // No hit-test support — just anchor in front of the camera.
            xrCam.getWorldPosition(camPos);
            xrCam.getWorldDirection(camDir);
            group.position.set(camPos.x + camDir.x * 0.6, camPos.y - 0.5, camPos.z + camDir.z * 0.6);
            group.visible = true;
            provisional = true;
            anchored = true;
            placed = true;
            setModelOpacity(1);
            rotationRing.visible = true;
            setModelPlaced(true);
            setRotateHintDismissed(false);
            setModelAnchored(true);
            setSearchingSurface(false);
          } else {
            // Look for a real surface (table height) to settle onto.
            const hits = frame.getHitTestResults(hitTestSource);
            if (hits.length > 0) {
              const refSpace = renderer.xr.getReferenceSpace();
              if (refSpace) {
                const pose = hits[0].getPose(refSpace);
                if (pose) {
                  hitMatrix.fromArray(pose.transform.matrix);
                  hitMatrix.decompose(hitPos, hitQuat, hitScale);
                  if (hitPos.y > -1.2) { snapTarget.copy(hitPos); hasSnapTarget = true; }
                }
              }
            }

            if (!provisional) {
              // First appearance — show immediately at half opacity (still floating).
              provisional = true;
              group.visible = true;
              setModelOpacity(0.5);
              setModelPlaced(true);
              setSearchingSurface(true);
            }

            if (hasSnapTarget) {
              // Glide onto the detected surface, then lock it in at full opacity.
              group.position.lerp(snapTarget, 0.28);
              if (group.position.distanceTo(snapTarget) < 0.02) {
                group.position.copy(snapTarget);
                anchored = true;
                placed = true;
                setModelOpacity(1);
                rotationRing.visible = true;
                setRotateHintDismissed(false);
                setModelAnchored(true);
                setSearchingSurface(false);
              }
            } else {
              // Float ~0.5 m in front of the camera while scanning.
              xrCam.getWorldPosition(camPos);
              xrCam.getWorldDirection(camDir);
              group.position.set(
                camPos.x + camDir.x * 0.5,
                camPos.y + camDir.y * 0.5,
                camPos.z + camDir.z * 0.5,
              );
            }
          }
        }
        renderer.render(scene, camera);

        // Update projected model screen position every frame for accurate touch zone detection
        if (placed && group.visible) {
          const xrCam = renderer.xr.getCamera();
          const wPos = new THREE.Vector3();
          group.getWorldPosition(wPos);
          const proj = wPos.clone().project(xrCam);
          modelScreenX = (proj.x + 1) / 2 * window.innerWidth;
          modelScreenY = (-proj.y + 1) / 2 * window.innerHeight;
          // Project ring outer edge to screen to get a scale-aware pixel radius
          const edgeProj = wPos.clone()
            .add(new THREE.Vector3(RING_OUTER_R * group.scale.x, 0, 0))
            .project(xrCam);
          modelScreenRadius = Math.hypot(
            (edgeProj.x + 1) / 2 * window.innerWidth - modelScreenX,
            (-edgeProj.y + 1) / 2 * window.innerHeight - modelScreenY,
          );

          // Park the rotate hint just below the projected ring (front-facing, screen down = +Y)
          const hintEl = rotateHintElRef.current;
          if (hintEl) {
            hintEl.style.left = `${modelScreenX}px`;
            hintEl.style.top = `${modelScreenY + modelScreenRadius + 14}px`;
          }
        }
      });

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        overlay?.removeEventListener("touchstart", onTouchStart);
        overlay?.removeEventListener("touchmove", onTouchMove);
        overlay?.removeEventListener("touchend", onTouchEnd);
        hitTestSource?.cancel();
        transientHitSource?.cancel?.();
        renderer.setAnimationLoop(null);
        renderer.domElement.remove();
        renderer.dispose();
        ringGeo.dispose();
        ringMat.dispose();
        sessionEndRef.current = null;
        onClose();
      };

      session.addEventListener("end", cleanup);
      sessionEndRef.current = () => { session.end().catch(() => {}); };

    } catch (err) {
      console.error("[GlbAR]", err);
      canvasSlotRef.current?.querySelectorAll("canvas").forEach(c => c.remove());
      sessionEndRef.current = null;
      setState("unsupported");
    }
  }, [url, usdzUrl, onClose, preloadedGltf, modelScale]);

  // The hint is derived from the anchor state. Its timeout only records the
  // user-visible dismissal asynchronously, so anchoring itself does not cause
  // a synchronous state update from an effect.
  useEffect(() => {
    if (!modelAnchored) return;
    const timeout = window.setTimeout(() => setRotateHintDismissed(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [modelAnchored]);

  useEffect(() => {
    let disposed = false;
    const kickoff = window.setTimeout(() => {
      if (!disposed) void startAR();
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(kickoff);
      sessionEndRef.current?.();
    };
  }, [startAR]);

  const exitAR = () => sessionEndRef.current?.();

  return (
    <div className="fixed inset-0 z-[100]" style={{ background: "var(--navy-dark)", touchAction: "none" }}>
      <div ref={canvasSlotRef} className="absolute inset-0" />

      {/* DOM overlay root — always mounted for WebXR registration */}
      <div ref={overlayRef} className="absolute inset-0" style={{ zIndex: 20, touchAction: "none" }}>
        {/* Loading cover — only while the camera session is starting up (not while scanning) */}
        {state !== "ar" && state !== "unsupported" && state !== "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "var(--navy-dark)" }}>
            <Loader2 size={28} color="var(--orange)" strokeWidth={2} className="animate-spin" />
            <p className="text-sm font-semibold" style={{ color: "#FDFDFD" }}>
              {"Membuka kamera..."}
            </p>
          </div>
        )}

        {/* Surface-search hint — model is already visible; guide the user to settle it on a table */}
        {state === "ar" && searchingSurface && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center px-6 pointer-events-none">
            <div className="px-5 py-3 rounded-2xl text-center" style={{ background: "rgba(0,35,85,0.82)", backdropFilter: "blur(10px)" }}>
              <p className="text-sm font-semibold" style={{ color: "#FDFDFD" }}>
                Gerakkan ponsel perlahan ke meja
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(253,253,253,0.65)" }}>
                Model akan menempel begitu permukaan terdeteksi
              </p>
            </div>
          </div>
        )}

        {/* Rotate hint — parked under the blue ring; auto-positioned each frame */}
        {state === "ar" && modelAnchored && showRotateHint && (
          <div
            ref={rotateHintElRef}
            className="absolute -translate-x-1/2 pointer-events-none"
            style={{ left: -9999, top: 0, zIndex: 30 }}
          >
            <span
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{ background: "rgba(47,128,255,0.92)", color: "#FDFDFD", backdropFilter: "blur(6px)" }}
            >
              Geser garis biru untuk memutar
            </span>
          </div>
        )}

        {state === "ar" && modelPlaced && (
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
                <h3 className="font-bold text-base mb-1" style={{ color: "var(--navy)" }}>AR Belum Didukung</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#51698F" }}>
                  Perangkat ini membutuhkan <strong>Google Play Services for AR</strong>.
                </p>
              </div>
            </div>
            <a href="https://play.google.com/store/apps/details?id=com.google.ar.core"
              target="_blank" rel="noopener noreferrer"
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 mb-3 text-white"
              style={{ background: "linear-gradient(135deg, var(--orange), var(--orange-bright))" }}>
              Install Google AR Services →
            </a>
            <button onClick={onClose}
              className="w-full py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "var(--surface)", color: "var(--navy)" }}>
              Kembali ke Detail Menu
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PLY AR via Gaussian Splatting + WebXR ────────────────────────────────────

function PlyAR({ url, onClose }: { url: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uiOverlayRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
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
          <Loader2 size={28} color="var(--orange)" strokeWidth={2} className="animate-spin" />
          <p className="text-sm font-semibold" style={{ color: "#FDFDFD" }}>Memuat model AR...</p>
          <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(253,253,253,0.15)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--navy), var(--orange))" }} />
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
              style={{ background: "linear-gradient(135deg, var(--orange), var(--orange-bright))", color: "#FDFDFD", boxShadow: "0 4px 24px rgba(253,80,2,0.45)", opacity: arStarting ? 0.7 : 1 }}>
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
                <AlertTriangle size={20} color="var(--orange)" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base mb-2" style={{ color: "var(--navy)" }}>Ada Aplikasi Mengambang</h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "#254473" }}>Izin kamera diblokir oleh Android karena ada aplikasi yang tampil di atas layar.</p>
                <ul className="text-xs mt-1.5 space-y-1" style={{ color: "#51698F" }}>
                  <li>• Chat bubble WhatsApp / Telegram</li>
                  <li>• Floating window aplikasi lain</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: "var(--surface)", color: "var(--navy)" }}>Kembali</button>
              <button onClick={() => setState("ready")} className="flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 text-white" style={{ background: "var(--orange)" }}>
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
                <h3 className="font-bold text-base mb-1" style={{ color: "var(--navy)" }}>AR Belum Didukung</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#51698F" }}>Perangkat ini membutuhkan Google Play Services for AR.</p>
              </div>
            </div>
            <a href="https://play.google.com/store/apps/details?id=com.google.ar.core" target="_blank" rel="noopener noreferrer"
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 mb-3 text-white"
              style={{ background: "linear-gradient(135deg, var(--orange), var(--orange-bright))" }}>
              Install Google AR Services →
            </a>
            <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ background: "var(--surface)", color: "var(--navy)" }}>Kembali</button>
          </div>
        </>
      )}

      {state === "error" && (
        <div className="absolute inset-0 z-[101] flex flex-col items-center justify-center gap-4" style={{ background: "rgba(0,35,85,0.97)" }}>
          <p className="font-semibold" style={{ color: "#FDFDFD" }}>Gagal memuat model</p>
          <button onClick={onClose} className="px-8 py-3 rounded-2xl text-sm font-semibold text-white" style={{ background: "var(--orange)" }}>Kembali</button>
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
