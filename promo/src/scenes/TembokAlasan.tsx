import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { ObjectionChip, PrintMenuCard } from "../components/Objection";
import { OBJECTIONS } from "../objections";
import { SubLine } from "../components/Type";
import { C, E, FONT, SAFE } from "../theme";
import { SCENES } from "../timeline";

/**
 * The wall of objections. Only the top chip is meant to be read — the other
 * five are texture. Each one gets its own beat later, so asking the viewer to
 * read six lines in three seconds would be a waste of them.
 */
export const TembokAlasan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.tembokAlasan.duration;

  // The stack drops and shrinks to hand the frame over to the headline.
  const clear = interpolate(frame, [34, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.inOut,
  });
  const headlineReveal = interpolate(frame, [46, 58], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ scale: String(interpolate(frame, [0, duration], [1, 1.03])) }}>
        {/* The printed menu, drained of colour. It comes back lit at 33s. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -160,
            translate: "-50% 0",
            opacity: interpolate(frame, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              translate: `0 ${interpolate(frame, [0, 12], [80, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: E.out,
              })}px`,
            }}
          >
            <PrintMenuCard life={0} width={620} />
          </div>
        </div>

        {/* The stack of objections. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 300,
            translate: `-50% ${clear * 60}px`,
            scale: String(interpolate(clear, [0, 1], [1, 0.84])),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: -6,
          }}
        >
          {OBJECTIONS.map((o, i) => {
            const start = 4 + i * 5;
            const enter = spring({
              frame: frame - start,
              fps,
              config: { damping: 18, stiffness: 120 },
            });
            const fromLeft = i % 2 === 0;
            return (
              <div
                key={o.text}
                style={{
                  marginTop: i === 0 ? 0 : -14,
                  zIndex: OBJECTIONS.length - i,
                  translate: `${interpolate(enter, [0, 1], [fromLeft ? -340 : 340, 0])}px 0`,
                  rotate: `${o.tilt}deg`,
                  opacity: enter > 0 ? 1 : 0,
                  // Later chips sit behind and are partly covered on purpose.
                  filter: i === 0 ? "none" : `brightness(${1 - i * 0.08})`,
                }}
              >
                <ObjectionChip text={o.text} size={i === 0 ? 46 : 40} />
              </div>
            );
          })}
        </div>

        {/* Headline block. */}
        <div
          style={{
            position: "absolute",
            left: SAFE.x,
            top: 150,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              overflow: "hidden",
              clipPath: `inset(0 ${headlineReveal}% 0 0)`,
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 118,
                letterSpacing: "-0.035em",
                color: C.white,
                whiteSpace: "nowrap",
              }}
            >
              “Nanti dulu, deh.”
            </span>
          </div>
          <SubLine text="3Diner jawab satu per satu." delay={60} size={48} maxWidth={800} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
