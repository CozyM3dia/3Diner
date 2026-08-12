import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "./Backdrop";
import { ObjectionChip } from "./Objection";
import { SubLine } from "./Type";
import { C, E, FONT, SAFE } from "../theme";

/**
 * The shell every objection beat is built from. Six scenes share it, so the
 * cadence — chip, strike on the half-bar, answer, hold — is guaranteed by
 * construction instead of by remembering to repeat it.
 *
 * Timings below are relative to each 137-frame (2 bar) scene:
 *   f0–10   chip arrives
 *   f26–34  strike is drawn, completing on beat 3
 *   f34+    objection recedes, the answer takes the frame
 *   f36–48  headline
 *   f50–62  supporting line
 */
export const STRIKE_FROM = 26;
export const STRIKE_DURATION = 8;
export const STRIKE_DONE = STRIKE_FROM + STRIKE_DURATION;

/**
 * Every beat's chip starts at the same Y. Vertically centring the text block
 * instead let the anchor drift by ~50px between beats with and without a
 * supporting line, which is visible across a cut.
 */
const TEXT_TOP = 330;

export const CoretanScene: React.FC<{
  objection: string;
  tilt?: number;
  headline: string;
  subline?: string;
  /** The proof: screenshots, 3D, dashboard. Owns the right half, or all of it. */
  children: React.ReactNode;
  /** "split" keeps text left and stage right; "full" overlays text on the stage. */
  variant?: "split" | "full";
  /** Which side the copy sits on. Flipping a beat breaks up the repetition. */
  side?: "left" | "right";
  /** Headlines that need two lines get a smaller size. */
  headlineSize?: number;
  warmth?: number;
}> = ({
  objection,
  tilt = -2,
  headline,
  subline,
  children,
  variant = "split",
  side = "left",
  headlineSize = 76,
  warmth = 0,
}) => {
  const frame = useCurrentFrame();

  const chipIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const headlineClip = interpolate(frame, [36, 48], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });

  const text = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        maxWidth: variant === "full" ? 1080 : 720,
      }}
    >
      <div
        style={{
          opacity: chipIn,
          translate: `${interpolate(chipIn, [0, 1], [-70, 0])}px 0`,
          alignSelf: "flex-start",
        }}
      >
        <ObjectionChip
          text={objection}
          size={38}
          tilt={tilt}
          strikeFrom={STRIKE_FROM}
          recedeFrom={STRIKE_DONE}
        />
      </div>

      <div style={{ overflow: "hidden", clipPath: `inset(0 ${headlineClip}% 0 0)` }}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: headlineSize,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: C.white,
            display: "inline-block",
            // Scenes pass "\n" where they want the break, rather than leaving
            // it to wrap mid-word.
            whiteSpace: "pre-line",
          }}
        >
          {headline}
        </span>
      </div>

      {subline ? (
        <SubLine text={subline} delay={50} size={38} maxWidth={variant === "full" ? 900 : 660} />
      ) : null}
    </div>
  );

  if (variant === "full") {
    return (
      <AbsoluteFill>
        <Backdrop warmth={warmth} />
        <AbsoluteFill>{children}</AbsoluteFill>
        {/* Scrim so the copy survives whatever the stage is doing behind it. */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(${side === "left" ? "90deg" : "270deg"}, rgba(1,10,24,0.88) 0%, rgba(1,10,24,0.55) 34%, rgba(1,10,24,0) 62%)`,
          }}
        />
        <AbsoluteFill
          style={{
            padding: `${TEXT_TOP}px ${SAFE.x}px ${SAFE.y}px`,
            alignItems: side === "left" ? "flex-start" : "flex-end",
          }}
        >
          {text}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Backdrop warmth={warmth} />
      <AbsoluteFill
        style={{
          padding: `${TEXT_TOP}px ${SAFE.x}px ${SAFE.y}px`,
          flexDirection: side === "left" ? "row" : "row-reverse",
          alignItems: "flex-start",
          gap: 70,
        }}
      >
        <div style={{ width: 740, flexShrink: 0 }}>{text}</div>
        <div
          style={{
            position: "relative",
            flex: 1,
            alignSelf: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
