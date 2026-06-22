/**
 * Ground pasta-v4.glb so plate bottom sits at Y=0 (surface level in AR).
 * Also re-patches pasta.usdz with scale + translate for iOS Quick Look.
 * Run: node scripts/fix-ar-ground.mjs
 */
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { transformPrimitive } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { unzipSync, zipSync } = require('fflate');

const SB  = 'https://zvkmcbvckuupjsdftsyz.supabase.co';
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2MzU3MSwiZXhwIjoyMDk3NDM5NTcxfQ.PnR9NjtyjC8IEZ0b5EVfriMB4sP00_F7chTCPwmJU70';
const ANO = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjM1NzEsImV4cCI6MjA5NzQzOTU3MX0._aq3aVFfAVmb8aetI9OqqTRXItulnPSNzQPUlKF8Rxg';

// ── 1. GLB: download & find actual Y range ───────────────────────────────────
console.log('1. Downloading pasta-v4.glb...');
const glbBuf = new Uint8Array(await (await fetch(`${SB}/storage/v1/object/public/models/pasta-v4.glb`)).arrayBuffer());

const dec = await draco3d.createDecoderModule();
const enc = await draco3d.createEncoderModule();
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': dec, 'draco3d.encoder': enc });

const doc = await io.readBinary(glbBuf);
const root = doc.getRoot();

// Find Y_min across all vertex positions
let yMin = Infinity, yMax = -Infinity;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const arr = pos.getArray();
    for (let i = 1; i < arr.length; i += 3) {
      if (arr[i] < yMin) yMin = arr[i];
      if (arr[i] > yMax) yMax = arr[i];
    }
  }
}
console.log(`   Y range: [${yMin.toFixed(4)}, ${yMax.toFixed(4)}]`);

// Translate so Y_min = 0 (plate bottom sits at surface)
const ty = -yMin;
const translateMat = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,ty,0,1]; // column-major
console.log(`2. Translating by (0, ${ty.toFixed(4)}, 0)...`);

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    transformPrimitive(prim, translateMat);
  }
}

// Verify
let newYMin = Infinity, newYMax = -Infinity;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const arr = pos.getArray();
    for (let i = 1; i < arr.length; i += 3) {
      if (arr[i] < newYMin) newYMin = arr[i];
      if (arr[i] > newYMax) newYMax = arr[i];
    }
  }
}
console.log(`   New Y range: [${newYMin.toFixed(4)}, ${newYMax.toFixed(4)}] — height ${(newYMax-newYMin).toFixed(3)}m`);

const outGlb = await io.writeBinary(doc);
console.log(`3. Uploading pasta-v5.glb (${(outGlb.byteLength/1024/1024).toFixed(2)} MB)...`);
const upGlb = await fetch(`${SB}/storage/v1/object/models/pasta-v5.glb`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SVC}`, 'Content-Type': 'model/gltf-binary', 'x-upsert': 'true' },
  body: outGlb,
});
if (!upGlb.ok) throw new Error(`GLB upload: ${upGlb.status} ${await upGlb.text()}`);

// ── 2. USDZ: re-patch from original with scale + translate ───────────────────
// USDZ units = cm (metersPerUnit=0.01), original model ~975cm
// After scale 0.04103: Y_min_world = -85.4cm * 0.04103 = -3.504cm
// translate_y = 3.504cm to ground
const USDZ_SCALE = 0.04103;
const TRANSLATE_CM = Math.abs(yMin) * 100; // yMin in meters → cm equivalent

console.log(`\n4. Downloading pasta.usdz (original)...`);
const usdzBuf = new Uint8Array(await (await fetch(`${SB}/storage/v1/object/public/models/pasta.usdz`)).arrayBuffer());
const files = unzipSync(usdzBuf);
const decoder = new TextDecoder(), encoder = new TextEncoder();
let usda = decoder.decode(files['model.usda']);

// Strip any existing scale/translate/xformOpOrder injections
usda = usda.replace(/\n?\t\t\tdouble3 xformOp:scale = \([^)]+\)\n/g, '\n');
usda = usda.replace(/\n?\t\t\tdouble3 xformOp:translate = \([^)]+\)\n/g, '\n');
usda = usda.replace(/\n?\t\t\tuniform token\[\] xformOpOrder = \[[^\]]+\]\n/g, '\n');

const ANCHOR = '\t\t\ttoken preliminary:planeAnchoring:alignment = "horizontal"\n';
if (!usda.includes(ANCHOR)) throw new Error('USDA anchor not found');

// translate first (outer), scale second (inner): result = T * S * vertex
// Order ["xformOp:translate","xformOp:scale"] = outermost first in USD
const PATCH = `${ANCHOR}\t\t\tdouble3 xformOp:scale = (${USDZ_SCALE}, ${USDZ_SCALE}, ${USDZ_SCALE})\n\t\t\tdouble3 xformOp:translate = (0, ${TRANSLATE_CM.toFixed(4)}, 0)\n\t\t\tuniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]\n`;
usda = usda.replace(ANCHOR, PATCH);
console.log(`   Scale: ${USDZ_SCALE}, translate Y: ${TRANSLATE_CM.toFixed(4)} cm`);

const newFiles = { 'model.usda': encoder.encode(usda) };
for (const [name, data] of Object.entries(files)) {
  if (name !== 'model.usda') newFiles[name] = data;
}
const usdz = zipSync(newFiles, { level: 0 });
console.log(`5. Uploading pasta-v4.usdz...`);
const upUsdz = await fetch(`${SB}/storage/v1/object/models/pasta-v4.usdz`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SVC}`, 'Content-Type': 'model/vnd.usdz+zip', 'x-upsert': 'true' },
  body: usdz,
});
if (!upUsdz.ok) throw new Error(`USDZ upload: ${upUsdz.status} ${await upUsdz.text()}`);

// ── 3. DB update ─────────────────────────────────────────────────────────────
const V5 = `${SB}/storage/v1/object/public/models/pasta-v5.glb`;
const U4 = `${SB}/storage/v1/object/public/models/pasta-v4.usdz`;
const patch = await fetch(`${SB}/rest/v1/Menus?model_3d_url=like.*pasta*`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${SVC}`, 'apikey': ANO, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
  body: JSON.stringify({ model_3d_url: V5, usdz_url: U4 }),
});
console.log(`6. DB patch: ${patch.status}`);

const check = await (await fetch(`${SB}/rest/v1/Menus?select=nama_menu,model_3d_url,usdz_url`,
  { headers: { apikey: ANO, Authorization: `Bearer ${ANO}` } })).json();
check.forEach(m => console.log(`   ${m.nama_menu}: ${m.model_3d_url?.split('/').pop()} | ${m.usdz_url?.split('/').pop()}`));
console.log('\n✅ Done');
