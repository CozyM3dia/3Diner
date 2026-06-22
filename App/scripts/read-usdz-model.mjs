import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { unzipSync } = require('fflate');

const r = await fetch('https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/models/pasta.usdz');
const buf = new Uint8Array(await r.arrayBuffer());
const files = unzipSync(buf);

// Print full model.usda
const usda = new TextDecoder().decode(files['model.usda']);
console.log('=== model.usda FULL ===');
console.log(usda);
console.log('=== END (length:', usda.length, ') ===');
