/**
 * fitCameraToModel
 * Computes the world-space bounding box of the loaded splat mesh and
 * repositions the camera so the whole model is visible with comfortable
 * padding. Pass the Viewer instance and the THREE namespace (dynamic import).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fitCameraToModel(viewer: any, THREE: any) {
  try {
    const splatMesh = viewer.splatMesh;
    if (!splatMesh) return;

    // World-space bounding box (applySceneTransforms = true)
    const bb = splatMesh.computeBoundingBox(true);
    if (!bb) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bb.getCenter(center);
    bb.getSize(size);

    if (size.x === 0 && size.y === 0 && size.z === 0) return;

    const camera = viewer.camera;
    const fovV = (camera.fov ?? 60) * (Math.PI / 180);

    // Bounding sphere radius — more robust than per-axis
    const halfDiag = new THREE.Vector3(size.x, size.y, size.z).length() / 2;

    // Distance so the sphere fills the FOV, with 1.5× padding
    const distance = (halfDiag / Math.tan(fovV / 2)) * 1.5;

    // Front-above direction that works for food models with cameraUp=[0,-1,0]
    const dir = new THREE.Vector3(0, -0.5, 1.5).normalize();

    // 1. Set orbit target exactly at center
    if (viewer.controls) {
      viewer.controls.target.copy(center);
    }

    // 2. Position camera = center + dir * distance
    camera.up.set(0, -1, 0);
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.lookAt(center.x, center.y, center.z);
    camera.updateProjectionMatrix();

    // 3. Sync controls
    if (viewer.controls) {
      viewer.controls.update();
    }

    console.log(
      `[fitCamera] center=(${center.x.toFixed(3)},${center.y.toFixed(3)},${center.z.toFixed(3)})`,
      `size=(${size.x.toFixed(3)},${size.y.toFixed(3)},${size.z.toFixed(3)})`,
      `radius=${halfDiag.toFixed(3)} dist=${distance.toFixed(3)}`
    );
  } catch (err) {
    console.warn("[fitCameraToModel]", err);
  }
}
