/**
 * Resize AR model to target dining-table size.
 *
 * Current (pasta-v3.glb): ~0.24m diameter (baked vertices)
 * Target:                  ~0.40m diameter — realistic large restaurant plate
 *
 * Produces:
 *   pasta-v4.glb   — baked vertices at 0.40m (GLB for 3D view + Android AR)
 *   pasta-v3.usdz  — scale 0.04103 patched into USDA (iOS Quick Look AR)
 *
 * Run: node scripts/rescale-ar.mjs
 */

import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { transformPrimitive } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { unzipSync, zipSync } = require('fflate');

const SUPABASE_URL = 'https://zvkmcbvckuupjsdftsyz.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2MzU3MSwiZXhwIjoyMDk3NDM5NTcxfQ.PnR9NjtyjC8IEZ0b5EVfriMB4sP00_F7chTCPwmJU70';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjM1NzEsImV4cCI6MjA5NzQzOTU3MX0._aq3aVFfAVmb8aetI9OqqTRXItulnPSNzQPUlKF8Rxg';

// Current baked size is ~0.24m. Target 0.40m → multiply vertices by this ratio.
const CURRENT_M   = 0.24;
const TARGET_M    = 0.40;
const RATIO       = TARGET_M / CURRENT_M;   // ≈ 1.6667

// For USDZ: original model = 9.75m, new scale = target / 9.75
const ORIGINAL_M  = 9.75;
const USDZ_SCALE  = TARGET_M / ORIGINAL_M;  // ≈ 0.04103

const V3_GLB_URL  = `${SUPABASE_URL}/storage/v1/object/public/models/pasta-v3.glb`;
const SRC_USDZ    = `${SUPABASE_URL}/storage/v1/object/public/models/pasta.usdz`;

const V4_GLB_PATH   = 'models/pasta-v4.glb';
const V3_USDZ_PATH  = 'models/pasta-v3.usdz';

const V4_GLB_PUBLIC  = `${SUPABASE_URL}/storage/v1/object/public/${V4_GLB_PATH}`;
const V3_USDZ_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/${V3_USDZ_PATH}`;

console.log(`Target: ${TARGET_M}m (ratio ×${RATIO.toFixed(4)}, USDZ scale ${USDZ_SCALE.toFixed(5)})\n`);

// ═══════════════════════════════════════════════
// PART A: GLB — rebake vertices at new scale
// ═══════════════════════════════════════════════

console.log('── GLB ──────────────────────────────');
console.log('1. Downloading pasta-v3.glb...');
const glbResp = await fetch(V3_GLB_URL);
if (!glbResp.ok) throw new Error(`GLB download failed: ${glbResp.status}`);
const glbBuf = new Uint8Array(await glbResp.arrayBuffer());
console.log(`   ${(glbBuf.byteLength / 1024 / 1024).toFixed(2)} MB`);

const decoderModule = await draco3d.createDecoderModule();
const encoderModule = await draco3d.createEncoderModule();
const io = new NodeIO()
  .registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': decoderModule, 'draco3d.encoder': encoderModule });

const document = await io.readBinary(glbBuf);
const root = document.getRoot();

// Build a uniform scale mat4 (column-major)
const s = RATIO;
const scaleMat = [
  s, 0, 0, 0,
  0, s, 0, 0,
  0, 0, s, 0,
  0, 0, 0, 1,
];

// Apply to all primitives (nodes should already be identity from bake-glb.mjs)
let primCount = 0;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    transformPrimitive(prim, scaleMat);
    primCount++;
  }
}
console.log(`2. Scaled ${primCount} primitives ×${RATIO.toFixed(4)}`);

// Verify bounds
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
let minY = Infinity, maxY = -Infinity;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const arr = pos.getArray();
    for (let i = 0; i < arr.length; i += 3) {
      if (arr[i]   < minX) minX = arr[i];   if (arr[i]   > maxX) maxX = arr[i];
      if (arr[i+1] < minY) minY = arr[i+1]; if (arr[i+1] > maxY) maxY = arr[i+1];
      if (arr[i+2] < minZ) minZ = arr[i+2]; if (arr[i+2] > maxZ) maxZ = arr[i+2];
    }
  }
}
console.log(`   Bounds: ${(maxX-minX).toFixed(3)}m × ${(maxY-minY).toFixed(3)}m × ${(maxZ-minZ).toFixed(3)}m`);

const outGlb = await io.writeBinary(document);
console.log(`3. Serialized: ${(outGlb.byteLength / 1024 / 1024).toFixed(2)} MB`);

console.log('4. Uploading pasta-v4.glb...');
const upGlb = await fetch(`${SUPABASE_URL}/storage/v1/object/${V4_GLB_PATH}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'model/gltf-binary', 'x-upsert': 'true' },
  body: outGlb,
});
if (!upGlb.ok) throw new Error(`GLB upload failed: ${upGlb.status} ${await upGlb.text()}`);
console.log(`   → ${V4_GLB_PUBLIC}`);

// ═══════════════════════════════════════════════
// PART B: USDZ — patch original with new scale
// ═══════════════════════════════════════════════

console.log('\n── USDZ ─────────────────────────────');
console.log('5. Downloading pasta.usdz (original 9.75m)...');
const usdzResp = await fetch(SRC_USDZ);
if (!usdzResp.ok) throw new Error(`USDZ download failed: ${usdzResp.status}`);
const usdzBuf = new Uint8Array(await usdzResp.arrayBuffer());

const files = unzipSync(usdzBuf);
const dec = new TextDecoder(), enc = new TextEncoder();
let usda = dec.decode(files['model.usda']);

// Remove any existing scale injection first (from patch-usdz.mjs)
const OLD_SCALE_RE = /\n?\t\t\tdouble3 xformOp:scale = \([^)]+\)\n\t\t\tuniform token\[\] xformOpOrder = \["xformOp:scale"\]\n/g;
usda = usda.replace(OLD_SCALE_RE, '\n');

// Inject new scale
const ANCHOR = '\t\t\ttoken preliminary:planeAnchoring:alignment = "horizontal"\n';
const SCALE_BLOCK = `${ANCHOR}\t\t\tdouble3 xformOp:scale = (${USDZ_SCALE}, ${USDZ_SCALE}, ${USDZ_SCALE})\n\t\t\tuniform token[] xformOpOrder = ["xformOp:scale"]\n`;

if (!usda.includes(ANCHOR)) throw new Error('USDZ anchor line not found');
usda = usda.replace(ANCHOR, SCALE_BLOCK);
console.log(`6. Injected scale ${USDZ_SCALE.toFixed(5)} → ${(ORIGINAL_M * USDZ_SCALE).toFixed(3)}m`);

const newFiles = { 'model.usda': enc.encode(usda) };
for (const [name, data] of Object.entries(files)) {
  if (name !== 'model.usda') newFiles[name] = data;
}
const usdz = zipSync(newFiles, { level: 0 });

console.log('7. Uploading pasta-v3.usdz...');
const upUsdz = await fetch(`${SUPABASE_URL}/storage/v1/object/${V3_USDZ_PATH}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'model/vnd.usdz+zip', 'x-upsert': 'true' },
  body: usdz,
});
if (!upUsdz.ok) throw new Error(`USDZ upload failed: ${upUsdz.status} ${await upUsdz.text()}`);
console.log(`   → ${V3_USDZ_PUBLIC}`);

// ═══════════════════════════════════════════════
// PART C: Update DB
// ═══════════════════════════════════════════════

console.log('\n── DB ───────────────────────────────');
// Update model_3d_url
const patch1 = await fetch(
  `${SUPABASE_URL}/rest/v1/Menus?model_3d_url=eq.${encodeURIComponent(V3_GLB_PUBLIC.replace('v4','v3').replace('/pasta-v4','/pasta-v3'))}`,
  { method: 'PATCH', headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ model_3d_url: V4_GLB_PUBLIC, usdz_url: V3_USDZ_PUBLIC }) }
);
// Also patch any that still point to v3
const patch2 = await fetch(
  `${SUPABASE_URL}/rest/v1/Menus?model_3d_url=eq.${encodeURIComponent(V3_GLB_PUBLIC)}`,
  { method: 'PATCH', headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ model_3d_url: V4_GLB_PUBLIC, usdz_url: V3_USDZ_PUBLIC }) }
);

// Verify
const check = await fetch(`${SUPABASE_URL}/rest/v1/Menus?select=nama_menu,model_3d_url,usdz_url`,
  { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } });
const menus = await check.json();
menus.forEach(m => console.log(`   ${m.nama_menu}: ${m.model_3d_url?.split('/').pop()} | ${m.usdz_url?.split('/').pop()}`));

console.log(`\n✅ Done! AR model now ${TARGET_M}m (${TARGET_M * 100}cm) — dining table plate size.`);
