// Measures tempo, first downbeat, and energy shape of the soundtrack so the
// scene grid in src/music.ts is based on the file rather than a guess.
//
// Usage: node scripts/analyse-music.mjs
// Needs a decoded copy first:
//   npx remotion ffmpeg -y -i public/audio/music.mp3 -ac 1 -ar 22050 -acodec pcm_s16le out/_music.wav

import { readFile } from "node:fs/promises";
import path from "node:path";

const WAV = path.resolve("out/_music.wav");
const HOP_HZ = 100; // onset envelope resolution

function decodePcm16Mono(buf) {
  let off = 12;
  let sampleRate = 0;
  while (off < buf.length - 8) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") sampleRate = buf.readUInt32LE(off + 12);
    if (id === "data") {
      const n = Math.floor(size / 2);
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(off + 8 + i * 2) / 32768;
      return { x, sampleRate };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("no data chunk");
}

/** Short-time RMS, then half-wave-rectified difference: a cheap onset function. */
function onsetFunction(x, sampleRate) {
  const hop = Math.round(sampleRate / HOP_HZ);
  const env = [];
  for (let i = 0; i + hop <= x.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + hop; j++) s += x[j] * x[j];
    env.push(Math.sqrt(s / hop));
  }
  const flux = [0];
  for (let i = 1; i < env.length; i++) flux.push(Math.max(0, env[i] - env[i - 1]));
  const mean = flux.reduce((a, c) => a + c, 0) / flux.length;
  return { env, flux: flux.map((v) => v - mean) };
}

/**
 * Comb-filter autocorrelation. Summing lags at 1x, 2x and 4x the beat rewards
 * tempi that also explain the bar, which stops it locking onto a harmonic.
 */
function estimateBpm(flux) {
  let best = { bpm: 0, score: -Infinity };
  for (let bpm = 60; bpm <= 200; bpm += 0.25) {
    const lag = (60 / bpm) * HOP_HZ;
    let sum = 0;
    let count = 0;
    for (let i = 0; i + Math.round(lag * 4) < flux.length; i++) {
      sum +=
        flux[i] *
        (flux[i + Math.round(lag)] + flux[i + Math.round(lag * 2)] + flux[i + Math.round(lag * 4)]);
      count++;
    }
    const score = count ? sum / count : 0;
    if (score > best.score) best = { bpm, score };
  }
  return best.bpm;
}

function findDownbeat(flux, bpm) {
  const beat = (60 / bpm) * HOP_HZ;
  const barHops = beat * 4;
  let best = { offset: 0, score: -Infinity };
  for (let p = 0; p < Math.round(barHops); p++) {
    let sum = 0;
    for (let k = 0; p + k * barHops < flux.length; k++) sum += flux[Math.round(p + k * barHops)] ?? 0;
    if (sum > best.score) best = { offset: p / HOP_HZ, score: sum };
  }
  return best.offset;
}

async function main() {
  const buf = await readFile(WAV).catch(() => {
    throw new Error(`missing ${WAV} — decode music.mp3 first (see header)`);
  });
  const { x, sampleRate } = decodePcm16Mono(buf);
  const duration = x.length / sampleRate;
  const { env, flux } = onsetFunction(x, sampleRate);

  const bpm = estimateBpm(flux);
  const downbeat = findDownbeat(flux, bpm);
  const barSec = (60 / bpm) * 4;

  console.log(`duration        ${duration.toFixed(2)}s`);
  console.log(`bpm             ${bpm}`);
  console.log(`bar             ${barSec.toFixed(4)}s (${(barSec * 30).toFixed(2)} frames @30fps)`);
  console.log(`first downbeat  ${downbeat.toFixed(3)}s`);
  console.log(`bars in track   ${Math.floor((duration - downbeat) / barSec)}`);

  // Per-second level, and where the arrangement actually changes.
  const perSec = [];
  for (let s = 0; (s + 1) * HOP_HZ <= env.length; s++) {
    const slice = env.slice(s * HOP_HZ, (s + 1) * HOP_HZ);
    perSec.push(slice.reduce((a, c) => a + c, 0) / slice.length);
  }
  console.log(
    `\nlevel dB/s\n${perSec.map((v, i) => `${i}:${(20 * Math.log10(v + 1e-9)).toFixed(0)}`).join(" ")}`,
  );

  const smoothed = perSec.map((_, i) => {
    const w = perSec.slice(Math.max(0, i - 1), i + 2);
    return w.reduce((a, c) => a + c, 0) / w.length;
  });
  const ups = [];
  const downs = [];
  for (let i = 1; i < smoothed.length; i++) {
    const d = (smoothed[i] - smoothed[i - 1]) / (smoothed[i - 1] + 1e-9);
    if (d > 0.18) ups.push(i);
    if (d < -0.18) downs.push(i);
  }
  console.log(`\nenergy rises at   ${ups.join("s ")}s`);
  console.log(`energy drops at   ${downs.join("s ")}s`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
