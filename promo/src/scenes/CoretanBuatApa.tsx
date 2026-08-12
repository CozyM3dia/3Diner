import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CoretanScene, STRIKE_DONE } from "../components/CoretanScene";
import { objection } from "../objections";
import { Dish3D } from "../components/Dish3D";
import { C, E, FONT } from "../theme";

/**
 * Objection four, answered in AR. The payoff is not "the guest is delighted" —
 * it is that staff stop being menu explainers, which is the owner's problem.
 */
export const CoretanBuatApa: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drop = spring({
    frame: frame - STRIKE_DONE,
    fps,
    config: { damping: 12, mass: 0.8 },
  });
  // The landing: shadow snaps tight over three frames at contact.
  const contact = interpolate(frame, [STRIKE_DONE + 16, STRIKE_DONE + 19], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <CoretanScene
      objection={objection("coretanBuatApa").text}
      tilt={objection("coretanBuatApa").tilt}
      headline="Tamu lihat porsinya dulu."
      // Broken by hand so "menu." does not sit alone on the second line.
      subline={"Staf bisa fokus melayani meja,\nbukan menjelaskan menu."}
      variant="full"
      headlineSize={70}
      warmth={0.5}
    >
      {/* Table plane, drawn rather than photographed. */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 520,
            // Warm and opaque enough to read as a table rather than a vignette.
            background:
              "linear-gradient(180deg, rgba(2,44,96,0) 0%, rgba(48,32,20,0.55) 26%, rgba(32,21,13,0.9) 58%, rgba(18,12,8,0.98) 100%)",
          }}
        />
        <ScanLine at={2} />
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "center" }}>
        <div style={{ position: "relative", marginRight: 150, marginTop: 60 }}>
          <div
            style={{
              translate: `0 ${interpolate(drop, [0, 1], [-220, 0])}px`,
              opacity: interpolate(frame, [STRIKE_DONE, STRIKE_DONE + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <Dish3D
              dish="steak"
              rotationY={interpolate(frame, [STRIKE_DONE + 18, 137], [0, 0.5], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: E.inOut,
              })}
              size={620}
              targetSize={2.05}
              shadow={false}
            />
          </div>
          {/* Contact shadow. Tightening it is what sells the landing. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 150,
              translate: "-50% 0",
              width: interpolate(contact, [0, 1], [140, 340]),
              height: 44,
              borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(0,0,0,0.62), rgba(0,0,0,0))",
              filter: `blur(${interpolate(contact, [0, 1], [30, 12])}px)`,
              opacity: interpolate(frame, [STRIKE_DONE + 8, STRIKE_DONE + 18], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
          <Brackets at={0} />
          <SizeCallout at={56} />
        </div>
      </AbsoluteFill>

      <ModeChip />
    </CoretanScene>
  );
};

const ScanLine: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: `${p * 100}%`,
        height: 2,
        background: `linear-gradient(90deg, rgba(0,194,168,0), rgba(0,194,168,0.7), rgba(0,194,168,0))`,
        opacity: p > 0.02 && p < 0.98 ? 1 : 0,
      }}
    />
  );
};

const Brackets: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const drift = interpolate(frame, [70, 137], [0, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const corners = [
    { top: 40, left: 40, bt: true, bl: true },
    { top: 40, right: 40, bt: true, br: true },
    { bottom: 120, left: 40, bb: true, bl: true },
    { bottom: 120, right: 40, bb: true, br: true },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 62,
            height: 62,
            top: c.top === undefined ? undefined : c.top - drift,
            bottom: c.bottom === undefined ? undefined : c.bottom - drift,
            left: c.left === undefined ? undefined : c.left - drift,
            right: c.right === undefined ? undefined : c.right - drift,
            borderTop: c.bt ? `3px solid rgba(255,255,255,0.85)` : undefined,
            borderBottom: c.bb ? `3px solid rgba(255,255,255,0.85)` : undefined,
            borderLeft: c.bl ? `3px solid rgba(255,255,255,0.85)` : undefined,
            borderRight: c.br ? `3px solid rgba(255,255,255,0.85)` : undefined,
            scale: String(interpolate(p, [0, 1], [1.15, 1])),
            opacity: p * 0.9,
          }}
        />
      ))}
    </>
  );
};

/** Measure bracket under the plate, drawn left to right. */
const SizeCallout: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [at, at + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 96,
        translate: "-50% 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 300,
          height: 20,
          borderLeft: `3px solid ${C.teal}`,
          borderRight: `3px solid ${C.teal}`,
          borderBottom: `3px solid ${C.teal}`,
          scale: `${grow} 1`,
        }}
      />
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: "0.12em",
          color: C.teal,
          opacity: interpolate(frame, [at + 17, at + 25], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {/*
          Not "ukuran asli". ARSession.tsx normalises every model to 0.35 m on
          its longest axis, multiplies by an owner-set modelScale, and the guest
          can still pinch-zoom — so a measured-size claim is not one the product
          keeps.
        */}
        PORSI DI ATAS MEJA
      </span>
    </div>
  );
};

const ModeChip: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [STRIKE_DONE, STRIKE_DONE + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.in,
  });
  return (
    <div
      style={{
        position: "absolute",
        // Inside the safe area: this pill used to reach 1828px on a 1920 frame.
        right: 175,
        top: 130,
        padding: "12px 26px",
        borderRadius: 999,
        border: `1px solid ${C.teal}`,
        background: "rgba(0,194,168,0.14)",
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 26,
        letterSpacing: "0.16em",
        color: C.teal,
        opacity: interpolate(frame, [8, 18], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `${out * 60}px 0`,
      }}
    >
      MODE AR
    </div>
  );
};
