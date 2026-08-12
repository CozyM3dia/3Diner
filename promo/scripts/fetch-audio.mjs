// Downloads the promo's music and sound effects from Mixkit.
//
// Mixkit's free music and SFX licenses allow commercial use with no attribution
// and no account. The files below are the full downloads, not the site previews.
// Source pages: https://mixkit.co/free-stock-music/ and /free-sound-effects/
//
// Usage: node scripts/fetch-audio.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Every effect is levelled to this RMS so cue volumes in code mean something. */
const TARGET_RMS_DB = -24;
const PEAK_CEILING_DB = -1;

const OUT = path.resolve("public/audio");
const SFX_OUT = path.join(OUT, "sfx");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";

const MUSIC = {
  id: 1167,
  title: "Close Up",
  artist: "Michael Ramir C.",
  file: "music.mp3",
};

/** name -> [mixkit id, human title]. Names are what `Soundtrack.tsx` refers to. */
const SFX = {
  "whoosh-up": [1490, "Fast whoosh transition"],
  "whoosh-down": [174, "Fast sweep transition"],
  impact: [2902, "Movie impact intro presentation"],
  // 1143 and 1144 are Envato-gated (403); these are the free equivalents.
  "impact-soft": [2909, "Cool impact movie trailer"],
  riser: [645, "Cinematic synth riser"],
  "riser-short": [790, "Cinematic trailer riser"],
  click: [3124, "Modern technology select"],
  "click-alt": [2568, "Cool interface click tone"],
  pop: [3005, "Explainer video pops whoosh light pop"],
  scan: [1073, "Shop scanner beeps"],
  "ai-process": [2529, "Sci fi loading operative system"],
  shutter: [1133, "Camera shutter click"],
  confirm: [951, "Positive notification"],
  chime: [1107, "Page forward single chime"],
  "tech-slide": [3120, "Technology transition slide"],
};

const musicUrl = (id) => `https://assets.mixkit.co/music/${id}/${id}.mp3`;
const sfxUrl = (id) => `https://assets.mixkit.co/active_storage/sfx/${id}/${id}.wav`;

async function download(url, dest, label) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`${label}: suspiciously small (${buf.length}B)`);
  await writeFile(dest, buf);
  console.log(`${label.padEnd(14)} ${(buf.length / 1024).toFixed(0).padStart(6)}KB  ${path.basename(dest)}`);
}

/** Minimal WAV reader. Mixkit ships 16- and 24-bit PCM. */
function decodeWav(buf) {
  let off = 12;
  let fmt = null;
  while (off < buf.length - 8) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      fmt = {
        channels: buf.readUInt16LE(off + 10),
        sampleRate: buf.readUInt32LE(off + 12),
        bits: buf.readUInt16LE(off + 22),
      };
    }
    if (id === "data" && fmt) return { ...fmt, dataOffset: off + 8, dataSize: size };
    off += 8 + size + (size % 2);
  }
  return null;
}

const readSample = (buf, offset, bits) => {
  if (bits === 16) return buf.readInt16LE(offset) / 32768;
  if (bits === 24) {
    const v = buf.readUInt8(offset) | (buf.readUInt8(offset + 1) << 8) | (buf.readInt8(offset + 2) << 16);
    return v / 8388608;
  }
  if (bits === 32) return buf.readFloatLE(offset);
  throw new Error(`unsupported bit depth ${bits}`);
};

/** Rewrites the file as 16-bit PCM at a consistent RMS, peak-safe. */
async function normalise(file) {
  const buf = await readFile(file);
  const w = decodeWav(buf);
  if (!w) {
    console.log(`  ! ${path.basename(file)}: not PCM WAV, left as-is`);
    return null;
  }
  const bytes = w.bits / 8;
  const frames = Math.floor(w.dataSize / (bytes * w.channels));
  const total = frames * w.channels;
  const samples = new Float32Array(total);

  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < total; i++) {
    const v = readSample(buf, w.dataOffset + i * bytes, w.bits);
    samples[i] = v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / total) || 1e-9;

  const wantRms = Math.pow(10, TARGET_RMS_DB / 20);
  const ceiling = Math.pow(10, PEAK_CEILING_DB / 20);
  const gain = Math.min(wantRms / rms, peak > 0 ? ceiling / peak : 1);

  const out = Buffer.alloc(44 + total * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + total * 2, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(w.channels, 22);
  out.writeUInt32LE(w.sampleRate, 24);
  out.writeUInt32LE(w.sampleRate * w.channels * 2, 28);
  out.writeUInt16LE(w.channels * 2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * gain));
    out.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  await writeFile(file, out);
  return { gainDb: 20 * Math.log10(gain), seconds: frames / w.sampleRate };
}

async function main() {
  await mkdir(SFX_OUT, { recursive: true });

  await download(
    musicUrl(MUSIC.id),
    path.join(OUT, MUSIC.file),
    "music",
  );
  console.log(`  -> "${MUSIC.title}" by ${MUSIC.artist} (Mixkit #${MUSIC.id})`);

  for (const [name, [id, title]] of Object.entries(SFX)) {
    const dest = path.join(SFX_OUT, `${name}.wav`);
    try {
      await download(sfxUrl(id), dest, name);
      const n = await normalise(dest);
      if (n) {
        console.log(
          `  -> "${title}" (#${id}) ${n.seconds.toFixed(2)}s, levelled ${n.gainDb >= 0 ? "+" : ""}${n.gainDb.toFixed(1)} dB`,
        );
      }
    } catch (err) {
      console.log(`SKIP ${name} — ${err.message}`);
    }
  }

  console.log("done ->", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
