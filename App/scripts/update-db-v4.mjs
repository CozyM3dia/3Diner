const SUPABASE_URL = 'https://zvkmcbvckuupjsdftsyz.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2MzU3MSwiZXhwIjoyMDk3NDM5NTcxfQ.PnR9NjtyjC8IEZ0b5EVfriMB4sP00_F7chTCPwmJU70';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjM1NzEsImV4cCI6MjA5NzQzOTU3MX0._aq3aVFfAVmb8aetI9OqqTRXItulnPSNzQPUlKF8Rxg';

const V4_GLB  = `${SUPABASE_URL}/storage/v1/object/public/models/pasta-v4.glb`;
const V3_USDZ = `${SUPABASE_URL}/storage/v1/object/public/models/pasta-v3.usdz`;

// Patch rows where model_3d_url contains "pasta"
const patch = await fetch(
  `${SUPABASE_URL}/rest/v1/Menus?model_3d_url=like.*pasta*`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ model_3d_url: V4_GLB, usdz_url: V3_USDZ }),
  }
);
console.log('Patch:', patch.status, patch.ok ? 'OK' : await patch.text());

const check = await fetch(`${SUPABASE_URL}/rest/v1/Menus?select=nama_menu,model_3d_url,usdz_url`,
  { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } });
const menus = await check.json();
menus.forEach(m => console.log(`${m.nama_menu}: ${m.model_3d_url?.split('/').pop()} | ${m.usdz_url?.split('/').pop()}`));
