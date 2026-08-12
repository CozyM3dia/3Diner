// Synthesises the soundtrack and sound effects for the promo from scratch.
// Everything here is generated maths — no sampled or licensed material.
//
// Usage: node scripts/make-audio.mjs
// Output: public/audio/music.wav and public/audio/sfx/*.wav

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SR = 44100;
const OUT = path.resolve("public/audio");
const SFX_OUT = path.join(OUT, "sfx");

const BPM = 120;
const BEAT = 60 / BPM; // 0.5s
const BAR = BEAT * 4; // 2s
const TOTAL = 45; // seconds, matches the composition

// ---------------------------------------------------------------- primitives

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Deterministic noise so two runs produce byte-identical audio. */
const makeRng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
};

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * SR));

/** Mixes a mono voice into the stereo bed at `time`, with gain and pan. */
const mix = (left, right, voice, time, gain = 1, pan = 0) => {
  const start = Math.round(time * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < voice.length; i++) {
    const j = start + i;
    if (j < 0 || j >= left.length) continue;
    left[j] += voice[i] * gl;
    right[j] += voice[i] * gr;
  }
};

/** One-pole lowpass. `cutoff` may be a number or a function of progress 0..1. */
const lowpass = (buf, cutoff) => {
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    const fc = typeof cutoff === "function" ? cutoff(i / buf.length) : cutoff;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    y += (buf[i] - y) * a;
    buf[i] = y;
  }
  return buf;
};

/** One-pole highpass, used to keep transients crisp. */
const highpass = (buf, cutoff) => {
  let prevIn = 0;
  let prevOut = 0;
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = rc / (rc + 1 / SR);
  for (let i = 0; i < buf.length; i++) {
    const out = a * (prevOut + buf[i] - prevIn);
    prevIn = buf[i];
    prevOut = out;
    buf[i] = out;
  }
  return buf;
};

const saw = (phase) => 2 * (phase - Math.floor(phase)) - 1;
const square = (phase) => (phase - Math.floor(phase) < 0.5 ? 1 : -1);
const tri = (phase) => {
  const p = phase - Math.floor(phase);
  return 4 * Math.abs(p - 0.5) - 1;
};

// ------------------------------------------------------------------- drums

const kick = () => {
  const dur = 0.5;
  const b = buffer(dur);
  const rng = makeRng(7);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 48 + 140 * Math.exp(-t / 0.022);
    phase += f / SR;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.16);
    const click = rng() * Math.exp(-t / 0.0035) * 0.35;
    b[i] = body * 0.95 + click;
  }
  return b;
};

const clap = () => {
  const dur = 0.32;
  const b = buffer(dur);
  const rng = makeRng(19);
  // Three quick bursts then a short tail: reads as a clap, not a noise blip.
  const bursts = [0, 0.011, 0.023];
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let amp = 0;
    for (const off of bursts) {
      if (t >= off) amp += Math.exp(-(t - off) / 0.007);
    }
    amp += Math.exp(-t / 0.11) * 0.85;
    b[i] = rng() * amp * 0.35;
  }
  highpass(b, 900);
  return b;
};

const hat = (open = false) => {
  const dur = open ? 0.3 : 0.07;
  const b = buffer(dur);
  const rng = makeRng(open ? 31 : 29);
  let prev = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const n = rng();
    const d = n - prev; // differentiated noise sits high and stays crisp
    prev = n;
    b[i] = d * Math.exp(-t / (open ? 0.14 : 0.018)) * 0.3;
  }
  highpass(b, 6500);
  return b;
};

// ----------------------------------------------------------------- pitched

const bass = (midi, dur) => {
  const b = buffer(dur + 0.1);
  const f = midiHz(midi);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    phase += f / SR;
    const env =
      Math.min(1, t / 0.006) *
      Math.exp(-t / (dur * 0.55)) *
      (t > dur ? Math.exp(-(t - dur) / 0.03) : 1);
    b[i] = (saw(phase) * 0.7 + Math.sin(2 * Math.PI * phase) * 0.6) * env;
  }
  lowpass(b, (p) => 220 + 900 * Math.exp(-p * 3));
  return b;
};

/** Bright plucked lead. Two slightly detuned voices keep it from sounding thin. */
const pluck = (midi, dur = 0.42) => {
  const b = buffer(dur);
  const f = midiHz(midi);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    p1 += f / SR;
    p2 += (f * 1.004) / SR;
    const env = Math.min(1, t / 0.003) * Math.exp(-t / 0.13);
    const tone =
      tri(p1) * 0.55 + tri(p2) * 0.35 + Math.sin(2 * Math.PI * p1 * 2) * 0.18;
    b[i] = tone * env;
  }
  lowpass(b, 5200);
  return b;
};

const stab = (midis, dur = 0.26) => {
  const b = buffer(dur);
  for (const m of midis) {
    const f = midiHz(m);
    let phase = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      phase += f / SR;
      b[i] += saw(phase) * Math.exp(-t / 0.07) * Math.min(1, t / 0.002) * 0.3;
    }
  }
  lowpass(b, (p) => 4200 * Math.exp(-p * 1.4) + 700);
  return b;
};

const pad = (midis, dur) => {
  const b = buffer(dur + 0.6);
  for (const m of midis) {
    const f = midiHz(m);
    let p1 = 0;
    let p2 = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      p1 += f / SR;
      p2 += (f * 1.007) / SR;
      const env =
        Math.min(1, t / 0.35) * (t > dur ? Math.exp(-(t - dur) / 0.35) : 1);
      b[i] += (saw(p1) * 0.3 + saw(p2) * 0.3) * env * 0.22;
    }
  }
  lowpass(b, 1500);
  return b;
};

const arp = (midi) => {
  const b = buffer(0.16);
  const f = midiHz(midi);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    phase += f / SR;
    b[i] = square(phase) * Math.exp(-t / 0.035) * 0.22;
  }
  lowpass(b, 4800);
  return b;
};

const chime = (midi, dur = 2.2) => {
  const b = buffer(dur);
  const f = midiHz(midi);
  // Inharmonic partials are what make a bell read as a bell.
  const partials = [1, 2.01, 3.02, 4.16, 5.43];
  const gains = [1, 0.5, 0.32, 0.18, 0.1];
  for (let k = 0; k < partials.length; k++) {
    let phase = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      phase += (f * partials[k]) / SR;
      b[i] +=
        Math.sin(2 * Math.PI * phase) *
        Math.exp(-t / (0.9 / partials[k])) *
        gains[k] *
        0.24;
    }
  }
  return b;
};

// -------------------------------------------------------------------- sfx

const whoosh = (dur = 0.55, dir = "up") => {
  const b = buffer(dur);
  const rng = makeRng(101);
  let y = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const p = t / dur;
    const fc = dir === "up" ? 300 + 6500 * p * p : 6800 - 6300 * p * p;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    y += (rng() - y) * a;
    const env = Math.sin(Math.PI * Math.min(1, p)) ** 1.4;
    b[i] = y * env * 0.8;
  }
  highpass(b, 260);
  return b;
};

const impact = () => {
  const dur = 1.1;
  const b = buffer(dur);
  const rng = makeRng(211);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 130 * Math.exp(-t / 0.12) + 38;
    phase += f / SR;
    const sub = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.42);
    const crack = rng() * Math.exp(-t / 0.012) * 0.5;
    b[i] = sub * 0.95 + crack;
  }
  return b;
};

const click = () => {
  const dur = 0.09;
  const b = buffer(dur);
  const rng = makeRng(307);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    phase += (2400 * Math.exp(-t / 0.006) + 900) / SR;
    b[i] =
      (Math.sin(2 * Math.PI * phase) * 0.7 + rng() * 0.5) *
      Math.exp(-t / 0.014);
  }
  highpass(b, 1200);
  return b;
};

const riser = (dur = 2.0) => {
  const b = buffer(dur);
  const rng = makeRng(409);
  let y = 0;
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const p = t / dur;
    const fc = 400 + 7000 * p ** 2.2;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    y += (rng() - y) * a;
    phase += (200 + 1400 * p ** 2) / SR;
    const tone = Math.sin(2 * Math.PI * phase) * 0.25 * p;
    b[i] = (y * 0.85 + tone) * (0.12 + 0.88 * p ** 1.6);
  }
  highpass(b, 240);
  return b;
};

const scanSweep = (dur = 1.3) => {
  const b = buffer(dur);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const p = t / dur;
    const f = 480 + 2600 * p;
    phase += f / SR;
    const env = Math.sin(Math.PI * p) ** 1.2;
    // A slow tremolo gives it the "instrument doing work" quality.
    const trem = 0.72 + 0.28 * Math.sin(2 * Math.PI * 17 * t);
    b[i] = (Math.sin(2 * Math.PI * phase) * 0.6 + Math.sin(4 * Math.PI * phase) * 0.2) * env * trem * 0.5;
  }
  return b;
};

const pop = () => {
  const dur = 0.2;
  const b = buffer(dur);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 900 * Math.exp(-t / 0.03) + 220;
    phase += f / SR;
    b[i] = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.045) * 0.8;
  }
  return b;
};

const subDrop = () => {
  const dur = 1.6;
  const b = buffer(dur);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 180 * Math.exp(-t / 0.35) + 32;
    phase += f / SR;
    b[i] = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.55) * 0.9;
  }
  return b;
};

// -------------------------------------------------------------- arrangement

// C major, one chord per bar: C – G – Am – F.
const CHORDS = [
  { root: 48, notes: [60, 64, 67] }, // C
  { root: 43, notes: [59, 62, 67] }, // G
  { root: 45, notes: [60, 64, 69] }, // Am
  { root: 41, notes: [60, 65, 69] }, // F
];

/** Eighth-note hook, four bars. `[slot, midi]` with 8 slots per bar. */
const HOOK = [
  [[0, 67], [2, 69], [3, 67], [4, 64], [6, 60]],
  [[0, 67], [2, 71], [3, 69], [4, 67], [6, 62]],
  [[0, 69], [2, 72], [3, 71], [4, 69], [6, 64]],
  [[0, 65], [2, 69], [3, 67], [4, 65], [6, 60]],
];

const ARP = [0, 2, 1, 2, 0, 2, 1, 2];

const buildMusic = () => {
  const left = buffer(TOTAL);
  const right = buffer(TOTAL);

  const bars = Math.floor(TOTAL / BAR); // 22
  const K = kick();
  const CL = clap();
  const HC = hat(false);
  const HO = hat(true);

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * BAR;
    const chord = CHORDS[bar % 4];

    // Section flags, chosen so the arrangement turns over on the picture cuts.
    const beatsIn = t0 >= 5; // drums from the logo hit
    const arpIn = t0 >= 9 && t0 < 23;
    const hookIn = (t0 >= 14 && t0 < 23) || (t0 >= 28 && t0 < 34);
    const breakdown = t0 >= 23 && t0 < 28;
    const stabsIn = t0 >= 34 && t0 < 38;
    const buildIn = t0 >= 38 && t0 < 42;
    const outro = t0 >= 42;

    // Pad runs the whole way, quieter once the beat carries the track.
    mix(left, right, pad(chord.notes, BAR * 0.95), t0, beatsIn ? 0.5 : 0.85, 0);

    if (outro) {
      // Let the last chord ring instead of cutting the groove off dead.
      mix(left, right, pad(chord.notes.concat([72]), BAR * 1.3), t0, 0.7, 0);
      mix(left, right, K, t0, 0.9, 0);
      continue;
    }

    if (beatsIn && !breakdown) {
      for (const beat of [0, 2]) mix(left, right, K, t0 + beat * BEAT, 0.95, 0);
      if (!buildIn) mix(left, right, K, t0 + 3.5 * BEAT, 0.55, 0);
      for (const beat of [1, 3]) mix(left, right, CL, t0 + beat * BEAT, 0.62, 0);
      for (let e = 0; e < 8; e++) {
        if (e === 7) mix(left, right, HO, t0 + e * BEAT * 0.5, 0.4, 0.15);
        else mix(left, right, HC, t0 + e * BEAT * 0.5, e % 2 ? 0.3 : 0.42, -0.12);
      }
      // Driving eighth-note bass.
      for (let e = 0; e < 8; e++) {
        const m = e % 4 === 0 ? chord.root : chord.root + (e % 2 ? 0 : 12);
        mix(left, right, bass(m, BEAT * 0.45), t0 + e * BEAT * 0.5, e % 2 ? 0.34 : 0.62, 0);
      }
    }

    if (breakdown) {
      // Half-time feel: keeps the AI scene calm before the dashboard payoff.
      // Hats stay in so the pulse never disappears entirely.
      mix(left, right, K, t0, 0.7, 0);
      mix(left, right, CL, t0 + 2 * BEAT, 0.45, 0);
      mix(left, right, bass(chord.root, BAR * 0.9), t0, 0.5, 0);
      for (let e = 0; e < 8; e++) {
        mix(left, right, HC, t0 + e * BEAT * 0.5, e % 2 ? 0.14 : 0.24, -0.12);
      }
      mix(left, right, arp(chord.notes[0] + 12), t0 + 3 * BEAT, 0.3, 0.3);
      mix(left, right, arp(chord.notes[2] + 12), t0 + 3.5 * BEAT, 0.26, -0.3);
    }

    if (arpIn) {
      for (let e = 0; e < 8; e++) {
        mix(left, right, arp(chord.notes[ARP[e]] + 12), t0 + e * BEAT * 0.5, 0.5, e % 2 ? 0.35 : -0.35);
      }
    }

    if (hookIn) {
      const phrase = HOOK[bar % 4];
      for (const [slot, midi] of phrase) {
        mix(left, right, pluck(midi + 12), t0 + slot * BEAT * 0.5, 0.62, 0.06);
      }
    }

    if (stabsIn) {
      // One stab per feature tile.
      for (const slot of [0, 1.5, 3, 4.5, 6]) {
        mix(left, right, stab(chord.notes.map((n) => n + 12)), t0 + slot * BEAT * 0.5, 0.5, 0);
      }
    }

    if (buildIn) {
      for (let e = 0; e < 16; e++) {
        mix(left, right, HC, t0 + e * BEAT * 0.25, 0.2 + 0.3 * (e / 16), 0);
      }
      mix(left, right, stab(chord.notes.map((n) => n + 12)), t0, 0.45, 0);
    }
  }

  // Musical punctuation on the three accented cuts.
  mix(left, right, impact(), 5, 0.85, 0);
  mix(left, right, impact(), 14, 0.6, 0);
  mix(left, right, impact(), 28, 0.7, 0);
  mix(left, right, riser(2.0), 3, 0.4, 0);
  mix(left, right, riser(1.6), 26.4, 0.42, 0);
  mix(left, right, riser(2.0), 40, 0.5, 0);
  mix(left, right, impact(), 42, 0.9, 0);
  mix(left, right, chime(84, 2.6), 42.05, 0.5, 0.1);
  mix(left, right, chime(79, 2.6), 42.05, 0.4, -0.1);

  return [left, right];
};

// ------------------------------------------------------------------- output

/**
 * Feed-forward peak compressor over the linked channels. Raw synthesis has a
 * huge crest factor, so without this the track sits ~6 dB below where a promo
 * needs to be. Fast attack also gives the bed its pump against the kick.
 */
const compress = (chans, { threshold = 0.12, ratio = 4, attack = 0.003, release = 0.18 } = {}) => {
  const aA = Math.exp(-1 / (attack * SR));
  const aR = Math.exp(-1 / (release * SR));
  let env = 0;
  const n = chans[0].length;
  for (let i = 0; i < n; i++) {
    let peak = 0;
    for (const c of chans) peak = Math.max(peak, Math.abs(c[i]));
    env = peak > env ? aA * env + (1 - aA) * peak : aR * env + (1 - aR) * peak;
    const g = env > threshold ? (threshold + (env - threshold) / ratio) / env : 1;
    for (const c of chans) c[i] *= g;
  }
  return chans;
};

/**
 * Section levels, applied after mastering. The compressor has to squash the
 * track to reach promo loudness, and that flattens the arrangement — this puts
 * the macro dynamics back so the drop at 5s still lands like a drop.
 * `[seconds, linear gain]`, linearly interpolated.
 */
const MACRO = [
  [0, 0.3],
  [3.0, 0.36],
  [4.6, 0.52],
  [5.0, 1.0],
  [23.0, 1.0],
  [24.2, 0.6],
  [26.0, 0.62],
  [27.9, 1.0],
  [38.0, 1.0],
  [39.0, 0.86],
  [41.9, 1.0],
  [42.0, 1.0],
  [43.5, 0.92],
  [45, 0.72],
];

const applyMacro = (chans) => {
  const n = chans[0].length;
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (seg < MACRO.length - 2 && t > MACRO[seg + 1][0]) seg++;
    const [t0, g0] = MACRO[seg];
    const [t1, g1] = MACRO[seg + 1];
    const p = t1 === t0 ? 1 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const g = g0 + (g1 - g0) * p;
    for (const c of chans) c[i] *= g;
  }
  return chans;
};

const peakOf = (chans) => {
  let peak = 0;
  for (const c of chans) for (const v of c) peak = Math.max(peak, Math.abs(v));
  return peak;
};

/**
 * Normalise, soften what is left of the transients, normalise again. The
 * second pass is what recovers the headroom the waveshaper eats, so `target`
 * is the true output peak.
 */
const finish = (chans, target = 0.95, drive = 1.0) => {
  const p0 = peakOf(chans);
  const g0 = p0 > 0 ? 1 / p0 : 1;
  const norm = Math.tanh(drive);
  for (const c of chans) {
    for (let i = 0; i < c.length; i++) {
      c[i] = Math.tanh(c[i] * g0 * drive) / norm;
    }
  }
  const p1 = peakOf(chans);
  const g1 = p1 > 0 ? target / p1 : 1;
  for (const c of chans) {
    for (let i = 0; i < c.length; i++) c[i] *= g1;
  }
  return chans;
};

const toWav = (chans) => {
  const n = chans[0].length;
  const ch = chans.length;
  const bytes = n * ch * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + bytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * ch * 2, 28);
  buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(bytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), o);
      o += 2;
    }
  }
  return buf;
};

const writeSfx = async (name, mono, gain = 0.95) => {
  const copy = Float32Array.from(mono);
  // Effects keep their transients: no drive, no compressor.
  finish([copy], gain, 1.0);
  await writeFile(path.join(SFX_OUT, `${name}.wav`), toWav([copy]));
  console.log("sfx", name, (copy.length / SR).toFixed(2) + "s");
};

async function main() {
  await mkdir(SFX_OUT, { recursive: true });

  const music = applyMacro(finish(compress(buildMusic()), 0.95, 1.6));
  const wav = toWav(music);
  await writeFile(path.join(OUT, "music.wav"), wav);
  console.log("music.wav", (wav.length / 1048576).toFixed(1) + "MB", TOTAL + "s");

  await writeSfx("whoosh-up", whoosh(0.55, "up"));
  await writeSfx("whoosh-down", whoosh(0.7, "down"));
  await writeSfx("impact", impact());
  await writeSfx("click", click(), 0.8);
  await writeSfx("riser", riser(1.8));
  await writeSfx("scan", scanSweep(1.3), 0.75);
  await writeSfx("pop", pop(), 0.8);
  await writeSfx("sub-drop", subDrop());
  await writeSfx("chime", chime(84, 2.4), 0.8);

  console.log("done ->", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
