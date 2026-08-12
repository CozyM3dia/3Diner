import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Box3, Vector3 } from "three";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const sceneCache = new Map<string, Group>();

/**
 * Loads a GLB and holds a delayRender handle open until it is decoded.
 *
 * The canvas is mounted only after this resolves. Adding a mesh to an already
 * mounted `<ThreeCanvas>` is not enough: the model lands after Remotion's
 * per-frame draw, and the frame is captured without it.
 */
const useGltfScene = (src: string): Group | null => {
  const [scene, setScene] = useState<Group | null>(() => sceneCache.get(src) ?? null);
  const [handle] = useState<number | null>(() =>
    sceneCache.has(src) ? null : delayRender(`GLB ${src}`),
  );

  useEffect(() => {
    if (handle === null) return;
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.load(
      src,
      (gltf) => {
        sceneCache.set(src, gltf.scene);
        if (!cancelled) setScene(gltf.scene);
        continueRender(handle);
      },
      undefined,
      (err) => {
        // Never hang a render on a missing asset.
        console.error("GLB failed", src, err);
        continueRender(handle);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [src, handle]);

  return scene;
};

export type DishName = "croissant" | "steak" | "pasta" | "kopi";

/**
 * A real product model on a transparent canvas, lit like food photography:
 * warm key from the front right, cool fill from the left, orange rim behind.
 */
export const Dish3D: React.FC<{
  dish: DishName;
  /** Radians. Driven by the caller so the spin reads with the cut. */
  rotationY: number;
  size?: number;
  targetSize?: number;
  cameraY?: number;
  cameraZ?: number;
  fov?: number;
  /** Contact shadow under the dish. Off when the dish is meant to float. */
  shadow?: boolean;
}> = ({
  dish,
  rotationY,
  size = 900,
  targetSize = 2.1,
  cameraY = 1.05,
  cameraZ = 3.15,
  fov = 34,
  shadow = true,
}) => {
  const src = staticFile(`models/${dish}.glb`);
  const scene = useGltfScene(src);
  // ThreeCanvas rejects non-integer dimensions, and `size` is usually the
  // output of an interpolate().
  const px = Math.max(1, Math.round(size));

  const prepared = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone(true);
    const box = new Box3().setFromObject(clone);
    const size3 = new Vector3();
    const center = new Vector3();
    box.getSize(size3);
    box.getCenter(center);
    const longest = Math.max(size3.x, size3.y, size3.z) || 1;
    const scale = targetSize / longest;
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);
    return clone;
  }, [scene, targetSize]);

  return (
    <div style={{ position: "relative", width: px, height: px }}>
      {shadow ? (
        // Cheaper and softer than a shadow map, and it never flickers.
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: px * 0.24,
            translate: "-50% 0",
            width: px * 0.54,
            height: px * 0.09,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 72%)",
            filter: "blur(12px)",
          }}
        />
      ) : null}
      {prepared ? (
        <ThreeCanvas
          width={px}
          height={px}
          style={{ position: "absolute", inset: 0 }}
          camera={{ position: [0, cameraY, cameraZ], fov }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[4, 6, 5]} intensity={2.6} color="#FFF3E8" />
          <directionalLight position={[-5, 3, -2]} intensity={1.1} color="#BFD8FF" />
          <directionalLight position={[0, 2, -6]} intensity={1.7} color="#FD5002" />
          <group rotation={[0, rotationY, 0]}>
            <primitive object={prepared} />
          </group>
        </ThreeCanvas>
      ) : null}
    </div>
  );
};
