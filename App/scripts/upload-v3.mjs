/**
 * Re-download the already-baked pasta-v2.glb and upload as pasta-v3.glb
 * then update Menus table to point to v3.
 * This busts any CDN cache that might still serve the old un-baked v2.
 */
const SUPABASE_URL = 'https://zvkmcbvckuupjsdftsyz.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2MzU3MSwiZXhwIjoyMDk3NDM5NTcxfQ.PnR9NjtyjC8IEZ0b5EVfriMB4sP00_F7chTCPwmJU70';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjM1NzEsImV4cCI6MjA5NzQzOTU3MX0._aq3aVFfAVmb8aetI9OqqTRXItulnPSNzQPUlKF8Rxg';

const V2_URL      = `${SUPABASE_URL}/storage/v1/object/public/models/pasta-v2.glb`;
const V3_PATH     = 'models/pasta-v3.glb';
const V3_PUBLIC   = `${SUPABASE_URL}/storage/v1/object/public/${V3_PATH}`;
const OLD_V2_URL  = `${SUPABASE_URL}/storage/v1/object/public/models/pasta-v2.glb`;

// 1. Download baked v2
console.log('1. Downloading baked pasta-v2.glb...');
const r = await fetch(V2_URL);
if (!r.ok) throw new Error(`Download failed: ${r.status}`);
const buf = new Uint8Array(await r.arrayBuffer());
console.log(`   ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);

// 2. Upload as pasta-v3.glb
console.log('2. Uploading as pasta-v3.glb...');
const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${V3_PATH}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'model/gltf-binary',
    'x-upsert': 'true',
  },
  body: buf,
});
if (!up.ok) throw new Error(`Upload failed: ${up.status} ${await up.text()}`);
console.log(`   → ${V3_PUBLIC}`);

// 3. Update all Menus that currently point to pasta-v2.glb → pasta-v3.glb
console.log('3. Updating Menus.model_3d_url...');
const patch = await fetch(
  `${SUPABASE_URL}/rest/v1/Menus?model_3d_url=eq.${encodeURIComponent(OLD_V2_URL)}`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ model_3d_url: V3_PUBLIC }),
  }
);
if (!patch.ok) throw new Error(`DB patch failed: ${patch.status} ${await patch.text()}`);

// 4. Verify DB
const check = await fetch(
  `${SUPABASE_URL}/rest/v1/Menus?select=id_menu,nama_menu,model_3d_url,usdz_url`,
  { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
);
const menus = await check.json();
menus.forEach(m => console.log(`   ${m.nama_menu}: ${m.model_3d_url?.split('/').pop()} | ${m.usdz_url?.split('/').pop()}`));

console.log('\n✅ Done! All menus → pasta-v3.glb (baked) + pasta-v2.usdz');
