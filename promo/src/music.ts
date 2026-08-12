import { FPS } from "./theme";

/**
 * Measured properties of the soundtrack, not guessed ones.
 *
 * Track: "Close Up" by Michael Ramir C., Mixkit #1167 (free licence, commercial
 * use, no attribution required). Tempo and first downbeat come from an onset
 * autocorrelation over the decoded file — run `node scripts/analyse-music.mjs`
 * to reproduce.
 *
 * The v1 film assumed 120 BPM and cut on whole seconds. This track is 105.25,
 * where whole seconds land off the beat. Every cut is placed on this grid.
 */
export const TRACK = {
  file: "audio/music.mp3",
  title: "Close Up",
  artist: "Michael Ramir C.",
  source: "Mixkit #1167",
  bpm: 105.25,
  /** The file's first downbeat, in seconds. Trimmed off so bar 0 == frame 0. */
  firstDownbeatSec: 0.08,
  durationSec: 95.11,
} as const;

/** Trim applied to the audio so the grid below starts on a downbeat. */
export const TRIM_BEFORE_FRAMES = Math.round(TRACK.firstDownbeatSec * FPS);

export const BEAT_SEC = 60 / TRACK.bpm; // 0.5701s
export const BAR_SEC = BEAT_SEC * 4; // 2.2803s
export const BAR_FRAMES = BAR_SEC * FPS; // 68.409

/**
 * Frame of downbeat `n`, counted from the start of the film. Accepts fractions:
 * 0.5 is the half-bar (beat 3), 0.25 is beat 2.
 */
export const barFrame = (n: number): number => Math.round(n * BAR_FRAMES);

/** Frame of beat `n`. */
export const beatFrame = (n: number): number => Math.round(n * BEAT_SEC * FPS);

/**
 * Builds a contiguous scene timetable from bar counts, so a scene boundary can
 * only ever land on the grid. Durations are derived from the boundaries rather
 * than rounded individually, which keeps the scenes gapless.
 */
export const layout = <K extends string>(
  plan: readonly { key: K; bars: number }[],
): { scenes: Record<K, { from: number; duration: number; bars: number }>; total: number } => {
  const scenes = {} as Record<K, { from: number; duration: number; bars: number }>;
  let cursor = 0;
  for (const { key, bars } of plan) {
    const from = barFrame(cursor);
    const to = barFrame(cursor + bars);
    scenes[key] = { from, duration: to - from, bars };
    cursor += bars;
  }
  return { scenes, total: barFrame(cursor) };
};
