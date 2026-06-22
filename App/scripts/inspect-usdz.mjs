/**
 * Inspect pasta.usdz — unzip and show file list + USDA content
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { unzipSync } = require('fflate');
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const SUPABASE_URL = 'https://zvkmcbvckuupjsdftsyz.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2a21jYnZja3V1cGpzZGZ0c3l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2MzU3MSwiZXhwIjoyMDk3NDM5NTcxfQ.PnR9NjtyjC8IEZ0b5EVfriMB4sP00_F7chTCPwmJU70';

console.log('Downloading pasta.usdz...');
const r = await fetch(`${SUPABASE_URL}/storage/v1/object/public/models/pasta.usdz`);
const buf = new Uint8Array(await r.arrayBuffer());
console.log(`Size: ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB`);

const files = unzipSync(buf);
console.log('\n=== FILES IN USDZ ===');
for (const [name, data] of Object.entries(files)) {
  console.log(`  ${name} (${(data.byteLength / 1024).toFixed(1)} KB)`);
}

// Print text files (usda/usdc)
for (const [name, data] of Object.entries(files)) {
  if (name.endsWith('.usda') || name.endsWith('.usd')) {
    const text = new TextDecoder().decode(data);
    console.log(`\n=== ${name} (first 2000 chars) ===`);
    console.log(text.slice(0, 2000));
  }
}
