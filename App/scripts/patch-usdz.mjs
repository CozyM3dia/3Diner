/**
 * Patch pasta.usdz → pasta-v2.usdz
 * Injects xformOp:scale = (0.0246, 0.0246, 0.0246) into the Scene node
 * so iOS Quick Look displays the model at correct plate size (~0.24m).
 *
 * Run: node scripts/patch-usdz.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { unzipSync, zipSync } = require('fflate');

const SUPABASE_URL = 'https://zvkmcbvckuupjsdftsyz.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2MzU3MSwiZXhwIjoyMDk3NDM5NTcxfQ.PnR9NjtyjC8IEZ0b5EVfriMB4sP00_F7chTCPwmJU70';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjM1NzEsImV4cCI6MjA5NzQzOTU3MX0._aq3aVFfAVmb8aetI9OqqTRXItulnPSNzQPUlKF8Rxg';

const SCALE        = 0.0246;   // 9.75m × 0.0246 = 0.2397m ≈ plate size
const SOURCE_USDZ  = `${SUPABASE_URL}/storage/v1/object/public/models/pasta.usdz`;
const DEST_PATH    = 'models/pasta-v2.usdz';
const PUBLIC_USDZ  = `${SUPABASE_URL}/storage/v1/object/public/${DEST_PATH}`;
const GLB_URL      = `${SUPABASE_URL}/storage/v1/object/public/models/pasta-v2.glb`;

// ── 1. Download ──────────────────────────────────────────────────────────
console.log('1. Downloading pasta.usdz...');
const r = await fetch(SOURCE_USDZ);
if (!r.ok) throw new Error(`Download failed: ${r.status}`);
const buf = new Uint8Array(await r.arrayBuffer());
console.log(`   ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB`);

// ── 2. Unzip ────────────────────────────────────────────────────────────
const files = unzipSync(buf);
console.log(`   Files: ${Object.keys(files).join(', ')}`);

// ── 3. Patch model.usda ─────────────────────────────────────────────────
const decoder = new TextDecoder();
const encoder = new TextEncoder();

let usda = decoder.decode(files['model.usda']);

// Anchor line used as injection point (present in all Three.js USDZ exports)
const ANCHOR = '\t\t\ttoken preliminary:planeAnchoring:alignment = "horizontal"\n';
const SCALE_BLOCK = `${ANCHOR}\t\t\tdouble3 xformOp:scale = (${SCALE}, ${SCALE}, ${SCALE})\n\t\t\tuniform token[] xformOpOrder = ["xformOp:scale"]\n`;

if (!usda.includes(ANCHOR)) {
  throw new Error('Anchor line not found in model.usda — check USDZ structure');
}
if (usda.includes('xformOp:scale')) {
  console.log('   Scale already present — skipping injection');
} else {
  usda = usda.replace(ANCHOR, SCALE_BLOCK);
  console.log(`2. Scale ${SCALE} injected → effective size ~${(9.75 * SCALE).toFixed(3)}m`);
}

// ── 4. Re-pack (USDZ requires store=0, no deflate) ──────────────────────
const newFiles = { 'model.usda': encoder.encode(usda) };
for (const [name, data] of Object.entries(files)) {
  if (name !== 'model.usda') newFiles[name] = data;
}

const usdz = zipSync(newFiles, { level: 0 });
console.log(`3. USDZ re-packed: ${(usdz.byteLength / 1024 / 1024).toFixed(1)} MB`);

// ── 5. Upload to Supabase storage ────────────────────────────────────────
console.log('4. Uploading pasta-v2.usdz...');
const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${DEST_PATH}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'model/vnd.usdz+zip',
    'x-upsert': 'true',
  },
  body: usdz,
});
if (!up.ok) throw new Error(`Upload failed: ${up.status} ${await up.text()}`);
console.log(`   → ${PUBLIC_USDZ}`);

// ── 6. Update Menus table ───────────────────────────────────────────────
console.log('5. Updating Menus.usdz_url...');
const patch = await fetch(
  `${SUPABASE_URL}/rest/v1/Menus?model_3d_url=eq.${encodeURIComponent(GLB_URL)}`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ usdz_url: PUBLIC_USDZ }),
  }
);
if (!patch.ok) throw new Error(`DB patch failed: ${patch.status} ${await patch.text()}`);
console.log('   All pasta menus → usdz_url updated');

// ── 7. Verify ───────────────────────────────────────────────────────────
const verify = await fetch(PUBLIC_USDZ, { method: 'HEAD' });
console.log(`\n6. Verification HEAD: ${verify.status} ${verify.headers.get('content-type')} ${(verify.headers.get('content-length') / 1024 / 1024).toFixed(1)} MB`);

console.log('\n✅ Done! iOS Quick Look will use pasta-v2.usdz (~0.24m plate)');
