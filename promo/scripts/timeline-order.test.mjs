import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function sceneKeys(path, marker) {
  const source = await readFile(path, "utf8");
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `scene list ${marker} was not found`);
  const endConst = source.indexOf("] as const", start);
  const endSemi = source.indexOf("];", start);
  const end = [endConst, endSemi].filter((index) => index !== -1).sort((a, b) => a - b)[0] ?? -1;
  assert.notEqual(end, -1, `scene list ${marker} has no closing marker`);
  return [...source.slice(start, end).matchAll(/key:\s*"([^"]+)"/g)].map((match) => match[1]);
}

test("harga scene lands before the product proof beats", async () => {
  const timelineKeys = await sceneKeys(new URL("../src/timeline.ts", import.meta.url), "const PLAN = [");
  const promoKeys = await sceneKeys(new URL("../src/Promo.tsx", import.meta.url), "const ORDER:");
  const soundtrack = await readFile(new URL("../src/Soundtrack.tsx", import.meta.url), "utf8");
  const curve = soundtrack.slice(soundtrack.indexOf("const MUSIC_CURVE"), soundtrack.indexOf("const musicVolume"));
  const cues = soundtrack.slice(soundtrack.indexOf("const CUES"), soundtrack.indexOf("export const Soundtrack"));

  for (const keys of [timelineKeys, promoKeys]) {
    assert.deepEqual(keys.slice(0, 4), ["intro", "harga", "praHook", "tembokAlasan"]);
    assert.ok(keys.indexOf("harga") < keys.indexOf("coretanMahal"));
  }

  assert.deepEqual(timelineKeys, promoKeys);
  assert.ok(curve.indexOf("SCENES.harga.from") < curve.indexOf("SCENES.praHook.from"));
  assert.ok(cues.indexOf("SCENES.harga.from + 8") < cues.indexOf("SCENES.praHook.from + 10"));
});
