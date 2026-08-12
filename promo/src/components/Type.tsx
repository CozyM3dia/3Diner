import { Interactive, interpolate, useCurrentFrame } from "remotion";
import { C, E, FONT, T } from "../theme";

/**
 * Word-by-word mask reveal. Each word rides up from behind a clipping edge,
 * which reads as deliberate typesetting rather than a generic fade.
 */
export const Kinetic: React.FC<{
  text: string;
  /** Frame the first word starts on, relative to the enclosing Sequence. */
  delay?: number;
  /** Frames between consecutive words. */
  stagger?: number;
  size?: number;
  weight?: number;
  color?: string;
  lineHeight?: number;
  align?: "left" | "center";
  maxWidth?: number;
  /** Words rendered in the accent colour, matched case-insensitively. */
  accent?: string[];
  italic?: boolean;
}> = ({
  text,
  delay = 0,
  stagger = 3,
  size = T.headline,
  weight = 800,
  color = C.white,
  lineHeight = 1.06,
  align = "left",
  maxWidth,
  accent = [],
  italic = false,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const accentSet = new Set(accent.map((a) => a.toLowerCase().replace(/[.,!?]/g, "")));

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: `0 ${size * 0.26}px`,
        justifyContent: align === "center" ? "center" : "flex-start",
        maxWidth,
        fontFamily: FONT,
        fontWeight: weight,
        fontSize: size,
        lineHeight,
        letterSpacing: size > 90 ? "-0.035em" : "-0.02em",
        fontStyle: italic ? "italic" : "normal",
        textAlign: align,
      }}
    >
      {words.map((word, i) => {
        const start = delay + i * stagger;
        const isAccent = accentSet.has(word.toLowerCase().replace(/[.,!?"“”]/g, ""));
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              paddingBottom: size * 0.14,
              marginBottom: -size * 0.14,
            }}
          >
            <span
              style={{
                display: "inline-block",
                color: isAccent ? C.orange : color,
                translate: `0 ${interpolate(frame, [start, start + 22], [size * 1.1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: E.out,
                })}px`,
                opacity: interpolate(frame, [start, start + 10], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Small caps label with a leading rule. Used to name each chapter. */
export const Eyebrow: React.FC<{ text: string; delay?: number; color?: string }> = ({
  text,
  delay = 0,
  color = C.orange,
}) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Eyebrow"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        opacity: interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: color,
          width: interpolate(frame, [delay, delay + 26], [0, 64], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: E.out,
          }),
        }}
      />
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: T.eyebrow,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color,
        }}
      >
        {text}
      </span>
    </Interactive.Div>
  );
};

/** Supporting sentence. Fades and lifts as one block. */
export const SubLine: React.FC<{
  text: string;
  delay?: number;
  size?: number;
  color?: string;
  maxWidth?: number;
  align?: "left" | "center";
}> = ({ text, delay = 0, size = T.body, color = "rgba(233,238,246,0.74)", maxWidth = 900, align = "left" }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.34,
        color,
        maxWidth,
        textAlign: align,
        opacity: interpolate(frame, [delay, delay + 16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `0 ${interpolate(frame, [delay, delay + 26], [22, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: E.out,
        })}px`,
      }}
    >
      {text}
    </div>
  );
};

/** Draws an orange marker under a phrase, left to right. */
export const Underline: React.FC<{ delay?: number; width: number; thickness?: number }> = ({
  delay = 0,
  width,
  thickness = 10,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        height: thickness,
        borderRadius: thickness,
        background: `linear-gradient(90deg, ${C.orange}, ${C.orangeBright})`,
        width: interpolate(frame, [delay, delay + 24], [0, width], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: E.out,
        }),
      }}
    />
  );
};
