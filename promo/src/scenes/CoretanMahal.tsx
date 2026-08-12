import { interpolate, useCurrentFrame } from "remotion";
import { objection } from "../objections";
import { CoretanScene, STRIKE_DONE } from "../components/CoretanScene";
import { DigitRoll } from "../components/Objection";
import { C, E, FONT } from "../theme";

/**
 * Objection one, and the reason this direction won: the price is answered at
 * six seconds, not at thirty-eight. "Pasti mahal" is what kills the reply
 * before it is typed.
 */
export const CoretanMahal: React.FC = () => {
  const frame = useCurrentFrame();

  const ruleGrow = interpolate(frame, [56, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const breathe = interpolate(frame, [68, 137], [1, 1.012], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <CoretanScene
      objection={objection("coretanMahal").text}
      tilt={objection("coretanMahal").tilt}
      headline="Mulai dari"
      headlineSize={64}
      warmth={0.25}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          scale: String(breathe),
        }}
      >
        {/* No gap: the film writes "Rp50.000" closed up, everywhere. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 96,
              color: C.orange,
              letterSpacing: "-0.04em",
            }}
          >
            Rp
          </span>
          <DigitRoll value={50000} from={STRIKE_DONE + 4} duration={20} size={168} color={C.orange} />
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            width: 420,
            background: `linear-gradient(90deg, ${C.orange}, ${C.orangeBright})`,
            scale: `${ruleGrow} 1`,
          }}
        />
        <span
          style={{
            marginTop: 6,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 40,
            letterSpacing: "0.06em",
            color: "rgba(159,182,209,0.9)",
            opacity: interpolate(frame, [64, 76], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          per bulan
        </span>
      </div>
    </CoretanScene>
  );
};
