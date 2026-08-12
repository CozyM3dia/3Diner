import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { ObjectionChip, PrintMenuCard } from "../components/Objection";
import { SubLine } from "../components/Type";
import { C, E, FONT } from "../theme";

import { OBJECTIONS } from "../objections";

/** Where each chip flies in from, so all six arrive from different edges. */
const ENTRY = [
  { x: -520, y: -160 },
  { x: 0, y: -420 },
  { x: 520, y: -160 },
  { x: -520, y: 160 },
  { x: 0, y: 420 },
  { x: 520, y: 160 },
];

/**
 * The circle closes. All six objections return already struck, and the printed
 * menu from the second scene comes back at full colour — one CSS property
 * answering an argument opened thirty seconds earlier.
 *
 * The last two seconds hold with nothing new entering. The biggest payoff in
 * the film gets stillness rather than another cut.
 */
export const SemuanyaDijawab: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Floor raised: at 0.32 the chips became unreadable exactly when the film
  // asks the viewer to re-read all six.
  const dim = interpolate(frame, [18, 28], [1, 0.62], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const life = interpolate(frame, [20, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.inOut,
  });
  const barGrow = interpolate(frame, [28, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const headlineClip = interpolate(frame, [30, 42], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });

  return (
    <AbsoluteFill>
      <Backdrop warmth={0.3} />

      {/* The printed menu, lit again. */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end" }}>
        <div
          style={{
            // Kept clear of the frame edge so the card reads as a whole object.
            marginBottom: 40,
            translate: `0 ${interpolate(frame, [20, 46], [120, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: E.out,
            })}px`,
          }}
        >
          <PrintMenuCard life={life} width={520} />
        </div>
      </AbsoluteFill>

      {/* All six objections, struck. */}
      {/* Starts below the persistent brand lockup, which owns the top left. */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 172 }}>
        <div
          style={{
            display: "grid",
            // Three columns keep the block to two rows, which is what stops the
            // bottom row disappearing behind the headline bar. Auto columns
            // size to content, so the widest chip governs and the whole grid
            // still lands inside the safe area.
            gridTemplateColumns: "repeat(3, auto)",
            gap: "16px 24px",
            justifyItems: "center",
            opacity: dim,
            scale: String(interpolate(frame, [18, 28], [1, 0.96], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: E.out,
            })),
          }}
        >
          {OBJECTIONS.map((o, i) => {
            const enter = spring({
              frame: frame - i * 2,
              fps,
              config: { damping: 24, stiffness: 140 },
            });
            return (
              <div
                key={o.text}
                style={{
                  translate: `${interpolate(enter, [0, 1], [ENTRY[i].x, 0])}px ${interpolate(
                    enter,
                    [0, 1],
                    [ENTRY[i].y, 0],
                  )}px`,
                  opacity: enter,
                }}
              >
                {/* Already struck on arrival: nothing left to argue. */}
                <ObjectionChip text={o.text} size={32} tilt={o.tilt} strikeFrom={-10} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Headline bar, held above the menu card rather than centred on it. */}
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 350 }}
      >
        <div
          style={{
            position: "relative",
            padding: "34px 70px",
            borderRadius: 22,
            background: "rgba(1,10,24,0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            scale: `${barGrow} 1`,
            transformOrigin: "left center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: C.orange,
              opacity: barGrow,
            }}
          >
            Enam alasan tadi
          </span>
          <div style={{ overflow: "hidden", clipPath: `inset(0 ${headlineClip}% 0 0)` }}>
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 96,
                letterSpacing: "-0.035em",
                color: C.white,
                whiteSpace: "nowrap",
              }}
            >
              Semuanya sudah dijawab.
            </span>
          </div>
          <SubLine
            text="Tinggal menunya yang bekerja."
            delay={46}
            size={40}
            align="center"
            maxWidth={900}
          />
        </div>
      </AbsoluteFill>

      {/* Nothing new enters after f54. The stillness is the point. */}
    </AbsoluteFill>
  );
};
