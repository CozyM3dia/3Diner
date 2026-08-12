import { Img, Interactive, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, E, FONT } from "../theme";

/**
 * The film's one repeated mechanic: an objection, then a line drawn through it.
 * Six beats share this component, which is what makes them read as one system
 * rather than six separate scenes.
 */

/**
 * The strike, drawn left to right.
 *
 * Sized by the chip it sits in rather than by a guess at the text width — the
 * earlier version measured characters and consistently overshot the pill.
 */
export const Strike: React.FC<{
  /** Frame the stroke starts on, relative to the enclosing Sequence. */
  from: number;
  /** Frames the stroke takes to complete. */
  duration?: number;
  thickness?: number;
  /** Degrees. A slight tilt stops it reading as a text-decoration. */
  tilt?: number;
  color?: string;
  /** Distance from the chip's edges, so the line stops inside the rounded ends. */
  inset?: number;
}> = ({ from, duration = 8, thickness = 8, tilt = -1, color = C.orange, inset = 10 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [from, from + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: inset,
        right: inset,
        top: "50%",
        height: thickness,
        translate: "0 -50%",
        rotate: `${tilt}deg`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          borderRadius: thickness,
          background: color,
        }}
      />
    </div>
  );
};

/** The objection itself. Navy muted, never red — "answered", not "wrong". */
export const ObjectionChip: React.FC<{
  text: string;
  size?: number;
  /** Set to draw the strike; frame is relative to the enclosing Sequence. */
  strikeFrom?: number;
  tilt?: number;
  /** Dims and shrinks the chip once its answer has taken over. */
  recedeFrom?: number;
}> = ({ text, size = 40, strikeFrom, tilt = -2, recedeFrom }) => {
  const frame = useCurrentFrame();
  const recede =
    recedeFrom === undefined
      ? 0
      : interpolate(frame, [recedeFrom, recedeFrom + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: E.out,
        });

  return (
    <Interactive.Div
      name={`Chip ${text}`}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        padding: `${size * 0.34}px ${size * 0.7}px`,
        borderRadius: 999,
        // Darker fill than the text it holds, so a struck chip stays legible.
        background: "rgba(0,27,69,0.55)",
        border: `1px solid rgba(159,182,209,0.30)`,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: size,
        color: `rgba(233,238,246,${1 - recede * 0.35})`,
        whiteSpace: "nowrap",
        opacity: 1 - recede * 0.2,
        scale: String(1 - recede * 0.06),
      }}
    >
      {text}
      {strikeFrom === undefined ? null : (
        <Strike from={strikeFrom} thickness={size * 0.2} tilt={tilt} inset={size * 0.3} />
      )}
    </Interactive.Div>
  );
};

/**
 * A number that rises into place behind a mask.
 *
 * Prices do NOT count up. A counter puts real-looking wrong prices on screen —
 * "Rp14.053" was visible mid-roll — so by default the final figure is set from
 * the first frame and only the mask animates. `count` re-enables the tick for
 * dashboard metrics, where an intermediate value is honest.
 */
export const DigitRoll: React.FC<{
  value: number;
  from: number;
  duration?: number;
  size?: number;
  color?: string;
  prefix?: string;
  weight?: number;
  count?: boolean;
}> = ({
  value,
  from,
  duration = 18,
  size = 150,
  color = C.white,
  prefix = "",
  weight = 800,
  count = false,
}) => {
  const frame = useCurrentFrame();
  const n = count
    ? interpolate(frame, [from, from + duration], [0, value], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: E.out,
      })
    : value;
  const lift = interpolate(frame, [from, from + 14], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });

  return (
    <span
      style={{
        display: "inline-block",
        overflow: "hidden",
        paddingBottom: size * 0.12,
        marginBottom: -size * 0.12,
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontFamily: FONT,
          fontWeight: weight,
          fontSize: size,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color,
          fontVariantNumeric: "tabular-nums",
          translate: `0 ${lift}%`,
        }}
      >
        {prefix}
        {Math.round(n).toLocaleString("id-ID")}
      </span>
    </span>
  );
};

const PHOTOS = ["croissant", "steak", "pasta", "kopi"] as const;

/**
 * The printed menu card. Introduced dim in the second scene and brought back to
 * full colour in the recap — one CSS property closing an argument 30s later.
 */
export const PrintMenuCard: React.FC<{
  /** 0 = fully drained, 1 = full colour. */
  life: number;
  width?: number;
}> = ({ life, width = 560 }) => (
  <div
    style={{
      width,
      padding: 22,
      borderRadius: 24,
      background: C.paper,
      boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
      opacity: interpolate(life, [0, 1], [0.35, 1]),
    }}
  >
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {PHOTOS.map((p) => (
        <Img
          key={p}
          src={staticFile(`photos/${p}.png`)}
          style={{
            width: "100%",
            height: width * 0.32,
            objectFit: "cover",
            borderRadius: 14,
            filter: `saturate(${interpolate(life, [0, 1], [0.12, 1])})`,
          }}
        />
      ))}
    </div>
    <div
      style={{
        marginTop: 16,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: C.navyMuted,
        textAlign: "center",
      }}
    >
      Menu Cetak
    </div>
  </div>
);
