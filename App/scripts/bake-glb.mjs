/**
 * Bake node-level transforms into vertex positions for pasta-v2.glb
 *
 * WHY: scale-glb.mjs used node.setScale() which stores scale as a node
 * transform, not in vertex positions. model-viewer calculates camera
 * distance from the geometry bounding box (still 9.75m), so the
 * 0.24m-rendered model appears invisible (too small to see).
 *
 * FIX: Apply the node matrix to actual vertex positions, reset nodes to
 * identity. model-viewer then sees 0.24m geometry and fits camera correctly.
 *
 * Run: node scripts/bake-glb.mjs
 */

import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { transformPrimitive } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const SUPABASE_URL = 'https://zvkmcbvckuupjsdftsyz.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2MzU3MSwiZXhwIjoyMDk3NDM5NTcxfQ.PnR9NjtyjC8IEZ0b5EVfriMB4sP00_F7chTCPwmJU70';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjM1NzEsImV4cCI6MjA5NzQzOTU3MX0._aq3aVFfAVmb8aetI9OqqTRXItulnPSNzQPUlKF8Rxg';

const SOURCE_URL  = `${SUPABASE_URL}/storage/v1/object/public/models/pasta-v2.glb`;
const DEST_PATH   = 'models/pasta-v2.glb'; // overwrite in place

// ── Column-major mat4 multiply (C = A * B) ──────────────────────────────────
function multiplyMat4(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) {
        out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
      }
    }
  }
  return out;
}

const IDENTITY = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

// Recursively bake world transforms into vertex data, then reset to identity
function bakeNode(node, parentMat) {
  const localMat = Array.from(node.getMatrix());
  const worldMat = multiplyMat4(parentMat, localMat);

  const mesh = node.getMesh();
  if (mesh) {
    for (const prim of mesh.listPrimitives()) {
      transformPrimitive(prim, worldMat);
    }
  }
  for (const child of node.listChildren()) {
    bakeNode(child, worldMat);
  }
  node.setMatrix(IDENTITY);
}

// ── 1. Download ──────────────────────────────────────────────────────────────
console.log('1. Downloading pasta-v2.glb...');
const r = await fetch(SOURCE_URL);
if (!r.ok) throw new Error(`Download failed: ${r.status}`);
const buf = new Uint8Array(await r.arrayBuffer());
console.log(`   ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);

// ── 2. Parse ─────────────────────────────────────────────────────────────────
const decoderModule = await draco3d.createDecoderModule();
const encoderModule = await draco3d.createEncoderModule();
const io = new NodeIO()
  .registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': decoderModule,
    'draco3d.encoder': encoderModule,
  });

const document = await io.readBinary(buf);
const root = document.getRoot();

// ── 3. Bake all node transforms ───────────────────────────────────────────────
let count = 0;
for (const scene of root.listScenes()) {
  for (const node of scene.listChildren()) {
    bakeNode(node, IDENTITY);
    count++;
  }
}
console.log(`2. Baked transforms — ${count} root scene nodes processed`);

// ── 4. Print resulting bounds for verification ────────────────────────────────
let minX = Infinity, minY = Infinity, minZ = Infinity;
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const arr = pos.getArray();
    for (let i = 0; i < arr.length; i += 3) {
      if (arr[i]   < minX) minX = arr[i];
      if (arr[i]   > maxX) maxX = arr[i];
      if (arr[i+1] < minY) minY = arr[i+1];
      if (arr[i+1] > maxY) maxY = arr[i+1];
      if (arr[i+2] < minZ) minZ = arr[i+2];
      if (arr[i+2] > maxZ) maxZ = arr[i+2];
    }
  }
}
console.log(`   Baked bounds: X[${minX.toFixed(3)}, ${maxX.toFixed(3)}] Y[${minY.toFixed(3)}, ${maxY.toFixed(3)}] Z[${minZ.toFixed(3)}, ${maxZ.toFixed(3)}]`);
console.log(`   Size: ${(maxX-minX).toFixed(3)}m × ${(maxY-minY).toFixed(3)}m × ${(maxZ-minZ).toFixed(3)}m`);

// ── 5. Serialize ──────────────────────────────────────────────────────────────
const outBuf = await io.writeBinary(document);
console.log(`3. Re-serialized: ${(outBuf.byteLength / 1024 / 1024).toFixed(2)} MB`);

// ── 6. Upload ─────────────────────────────────────────────────────────────────
console.log('4. Uploading pasta-v2.glb (overwrite)...');
const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${DEST_PATH}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'model/gltf-binary',
    'x-upsert': 'true',
  },
  body: outBuf,
});
if (!up.ok) throw new Error(`Upload failed: ${up.status} ${await up.text()}`);

// ── 7. Verify ─────────────────────────────────────────────────────────────────
const v = await fetch(SOURCE_URL + '?t=' + Date.now(), { method: 'HEAD' });
console.log(`5. Verify: ${v.status}, ${(parseInt(v.headers.get('content-length') || '0') / 1024 / 1024).toFixed(2)} MB`);

console.log('\n✅ Done! model-viewer auto-fits camera to ~0.24m baked geometry.');
