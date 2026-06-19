// Scale a GLB model's root nodes by a given factor
// Usage: node scripts/scale-glb.mjs <input.glb> <output.glb> <scaleFactor>

import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS, KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { readFile, writeFile } from "fs/promises";
import draco3d from "draco3dgltf";

const [,, input, output, scaleStr] = process.argv;
const scale = parseFloat(scaleStr ?? "0.15");

const decoderModule = await draco3d.createDecoderModule();
const encoderModule = await draco3d.createEncoderModule();

const io = new NodeIO()
  .registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": decoderModule,
    "draco3d.encoder": encoderModule,
  });

const document = await io.readBinary(new Uint8Array(await readFile(input)));

const root = document.getRoot();
for (const scene of root.listScenes()) {
  for (const node of scene.listChildren()) {
    const s = node.getScale();
    node.setScale([s[0] * scale, s[1] * scale, s[2] * scale]);
  }
}

await writeFile(output, Buffer.from(await io.writeBinary(document)));
console.log(`Scaled ${input} by ${scale} → ${output}`);
