const url = 'https://zvkmcbvckuupjsdftsyz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjM1NzEsImV4cCI6MjA5NzQzOTU3MX0._aq3aVFfAVmb8aetI9OqqTRXItulnPSNzQPUlKF8Rxg';

// 1. Query menus
const res = await fetch(`${url}/rest/v1/Menus?select=id_menu,nama_menu,model_3d_url,usdz_url`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }
});
const menus = await res.json();
console.log('=== MENUS ===');
menus.forEach(m => console.log(JSON.stringify({ name: m.nama_menu, model: m.model_3d_url, usdz: m.usdz_url })));

// 2. Test model URL HEAD
const modelUrl = 'https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/models/pasta-v2.glb';
const r = await fetch(modelUrl, { method: 'HEAD' });
console.log('\n=== MODEL HEAD ===');
console.log('status:', r.status);
console.log('content-type:', r.headers.get('content-type'));
console.log('content-length:', r.headers.get('content-length'));
console.log('access-control-allow-origin:', r.headers.get('access-control-allow-origin'));
console.log('cross-origin-resource-policy:', r.headers.get('cross-origin-resource-policy'));

// 3. Test usdz URL if exists
const usdzUrl = 'https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/models/pasta.usdz';
const r2 = await fetch(usdzUrl, { method: 'HEAD' });
console.log('\n=== USDZ HEAD ===');
console.log('status:', r2.status);
console.log('content-length:', r2.headers.get('content-length'));
