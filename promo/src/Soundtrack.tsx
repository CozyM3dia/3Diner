import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile } from "remotion";
import { TRACK, TRIM_BEFORE_FRAMES } from "./music";
import { SCENES, TOTAL_FRAMES } from "./timeline";
import { STRIKE_DONE } from "./components/CoretanScene";

/**
 * Music and effects.
 *
 * Music: "Close Up" by Michael Ramir C. (Mixkit #1167). Free licence,
 * commercial use, no attribution required. Downloaded by scripts/fetch-audio.mjs.
 *
 * The track is an underscore: steady all the way through, with no drop of its
 * own. Every bit of dynamics in this film therefore comes from the automation
 * curve below plus the effect cues — not from the song.
 */

/** [frame, gain]. Linearly interpolated; see the note above. */
const MUSIC_CURVE: [number, number][] = [
  [0, 0.2], //                           title card: barely there
  [SCENES.harga.from, 0.78], //          make room for one number
  [SCENES.praHook.from, 0.42], //        lifts as the dish arrives
  [SCENES.tembokAlasan.from, 0.82], //   the objections arrive
  [SCENES.coretanMahal.from, 0.95], //   groove settles for the six beats
  [SCENES.coretanRibet.from, 0.9], //    ease back under the dashboard
  [SCENES.semuanyaDijawab.from, 1.0], // the payoff
  [SCENES.ctaScan.from, 0.92],
  [TOTAL_FRAMES - 26, 0.92],
  [TOTAL_FRAMES, 0], //                  out clean, no hard stop
];

const musicVolume = (frame: number): number =>
  interpolate(
    frame,
    MUSIC_CURVE.map(([f]) => f),
    MUSIC_CURVE.map(([, v]) => v),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

type Cue = { at: number; sfx: string; volume: number; name: string };

/**
 * Effects are tied to something visible. The strike-throughs are deliberately
 * not all scored: only the first gets a hit, so the device stays a rhythm
 * rather than becoming a tic.
 */
const CUES: Cue[] = [
  { at: SCENES.intro.from + 6, sfx: "tech-slide", volume: 0.34, name: "logo mendarat" },
  { at: SCENES.harga.from + 8, sfx: "impact-soft", volume: 0.42, name: "angka harga" },
  { at: SCENES.praHook.from + 10, sfx: "pop", volume: 0.5, name: "croissant muncul" },
  { at: SCENES.tembokAlasan.from + 4, sfx: "whoosh-down", volume: 0.55, name: "chip berdatangan" },
  {
    at: SCENES.coretanMahal.from + STRIKE_DONE,
    sfx: "impact-soft",
    volume: 0.5,
    name: "coretan pertama",
  },
  { at: SCENES.coretanInstall.from + 18, sfx: "scan", volume: 0.42, name: "QR dipindai" },
  { at: SCENES.coretanInstall.from + 36, sfx: "confirm", volume: 0.4, name: "menu terbuka" },
  { at: SCENES.coretanModel3D.from + 14, sfx: "ai-process", volume: 0.5, name: "AI memindai foto" },
  { at: SCENES.coretanModel3D.from + 42, sfx: "whoosh-up", volume: 0.6, name: "model menembus bezel" },
  { at: SCENES.coretanBuatApa.from + 50, sfx: "impact-soft", volume: 0.45, name: "steak mendarat" },
  { at: SCENES.coretanRibet.from + 52, sfx: "click", volume: 0.42, name: "pesanan masuk" },
  { at: SCENES.coretanMenuCetak.from + 40, sfx: "click-alt", volume: 0.4, name: "toggle jadwal" },
  { at: SCENES.coretanMenuCetak.from + 78, sfx: "pop", volume: 0.42, name: "promo muncul" },
  { at: SCENES.semuanyaDijawab.from, sfx: "tech-slide", volume: 0.5, name: "enam chip kembali" },
  { at: SCENES.ctaScan.from + 36, sfx: "chime", volume: 0.45, name: "QR terkunci" },
];

export const Soundtrack: React.FC = () => (
  <>
    <Sequence name={`Musik · ${TRACK.title}`} layout="none">
      <Audio
        src={staticFile(TRACK.file)}
        // Trimmed so the track's first downbeat sits on frame 0, which is what
        // makes every scene boundary in ./timeline land on a bar line.
        trimBefore={TRIM_BEFORE_FRAMES}
        volume={(frame) => musicVolume(frame)}
      />
    </Sequence>

    {CUES.map((cue, i) => (
      <Sequence
        key={`${cue.sfx}-${cue.at}-${i}`}
        name={`SFX ${cue.name}`}
        from={cue.at}
        layout="none"
      >
        <Audio src={staticFile(`audio/sfx/${cue.sfx}.wav`)} volume={() => cue.volume} />
      </Sequence>
    ))}
  </>
);
