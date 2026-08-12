import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { DigitRoll } from "../components/Objection";
import { Eyebrow, SubLine } from "../components/Type";
import { C, E, FONT } from "../theme";

/**
 * The decision point, so the frame carries one number. The other two tiers are
 * present but deliberately inert — no motion, no colour — because splitting
 * attention here costs replies.
 */
export const Harga: React.FC = () => {
  const frame = useCurrentFrame();

  const ruleGrow = interpolate(frame, [20, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const breathe = interpolate(frame, [40, 102], [1, 1.012], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop warmth={0.45} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Eyebrow text="Satu meja pun sudah jalan." delay={2} />

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 0,
            scale: String(breathe),
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 110,
              color: C.orange,
              letterSpacing: "-0.04em",
            }}
          >
            Rp
          </span>
          <DigitRoll value={50000} from={8} duration={18} size={200} color={C.orange} />
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 56,
              color: "rgba(233,238,246,0.72)",
              marginLeft: 22,
            }}
          >
            per bulan
          </span>
        </div>

        <div
          style={{
            height: 6,
            borderRadius: 3,
            width: 560,
            background: `linear-gradient(90deg, ${C.orange}, ${C.orangeBright})`,
            scale: `${ruleGrow} 1`,
          }}
        />

        <div style={{ marginTop: 10 }}>
          <SubLine
            text="Bedanya: jumlah menu 3D dan kredit AI."
            delay={30}
            size={42}
            align="center"
            maxWidth={1000}
          />
        </div>

        {/* Present, but silent. */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 20,
            opacity: interpolate(frame, [22, 34], [0, 0.45], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {["Rp100.000", "Rp150.000"].map((tier) => (
            <div
              key={tier}
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: 32,
                color: "rgba(159,182,209,0.9)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 999,
                padding: "12px 32px",
              }}
            >
              {tier}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
