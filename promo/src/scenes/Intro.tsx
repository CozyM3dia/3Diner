import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { LogoMark } from "../components/LogoMark";
import { C, E, FONT } from "../theme";
import { SCENES } from "../timeline";

/**
 * A title card before anything else. The film used to open on the dish at
 * frame 0 and cut to the objection wall two seconds later, which read as
 * starting mid-sentence.
 *
 * Nothing here competes: one mark, one name, one promise, and a beat of quiet
 * before the food arrives.
 */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.intro.duration;

  const markIn = spring({ frame: frame - 4, fps, config: { damping: 16, mass: 0.7 } });
  const wordClip = interpolate(frame, [22, 40], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const ruleGrow = interpolate(frame, [44, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  // Letterspacing settling is what makes a tagline feel placed rather than faded.
  const tracking = interpolate(frame, [50, 84], [0.5, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  // Hands over to the pre-hook rather than cutting flat.
  const handoff = interpolate(frame, [duration - 16, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop warmth={0.25} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 26,
          opacity: handoff,
          scale: String(interpolate(frame, [0, duration], [1, 1.035])),
        }}
      >
        <div
          style={{
            scale: String(interpolate(markIn, [0, 1], [0.6, 1])),
            opacity: markIn,
          }}
        >
          <LogoMark size={200} />
        </div>

        <div style={{ overflow: "hidden", clipPath: `inset(0 ${wordClip}% 0 0)` }}>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 128,
              letterSpacing: "-0.045em",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: C.orange }}>3D</span>
            <span style={{ color: C.white }}>iner</span>
          </span>
        </div>

        <div
          style={{
            height: 4,
            borderRadius: 2,
            width: 200,
            background: C.orange,
            scale: `${ruleGrow} 1`,
          }}
        />

        <span
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 40,
            letterSpacing: `${tracking}em`,
            paddingLeft: `${tracking}em`,
            textTransform: "uppercase",
            color: "rgba(233,238,246,0.85)",
            opacity: interpolate(frame, [50, 68], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Lihat Sebelum Memesan
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
