import { layout } from "./music";

/**
 * The film, measured in bars of the soundtrack rather than in seconds.
 *
 * Half-bar granularity (0.5) is allowed — that is beat 3, which still reads as
 * a deliberate cut. Anything finer drifts off the pulse.
 *
 * Six objection beats get an identical 2 bars each. That even cadence is the
 * spine of the piece: the viewer learns the rhythm on the first strike-through
 * and can feel the next one coming.
 */
const PLAN = [
  { key: "intro", bars: 2 }, //          title card, so the film does not start mid-sentence
  { key: "harga", bars: 1.5 }, //        price lands early, while the decision is still live
  { key: "praHook", bars: 2 }, //        real croissant after the early price beat
  { key: "tembokAlasan", bars: 1.5 }, // the six objections stack up
  { key: "coretanMahal", bars: 2 }, //   "Mahal."
  { key: "coretanInstall", bars: 2 }, // "Tamu harus install aplikasi?"
  { key: "coretanModel3D", bars: 2 }, // "Saya tidak punya model 3D."
  { key: "coretanBuatApa", bars: 2 }, // "Buat apa, sih?"
  { key: "coretanRibet", bars: 2 }, //   "Ribet ngurusnya."
  { key: "coretanMenuCetak", bars: 2 }, // "Sudah ada menu cetak, kok."
  { key: "semuanyaDijawab", bars: 2 }, // the recap, and a breath
  { key: "ctaScan", bars: 2 },
] as const;

const built = layout(PLAN);

export const SCENES = built.scenes;
export const TOTAL_FRAMES = built.total;

export type SceneKey = keyof typeof SCENES;

/** Frame at which each objection's strike-through completes. */
export const strikeFrame = (key: SceneKey): number =>
  SCENES[key].from + Math.round(SCENES[key].duration * 0.42);
