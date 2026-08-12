import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT } from "../theme";
import { SCENES, TOTAL_FRAMES } from "../timeline";

/**
 * Persistent frame furniture. Both of these live at the Promo level and never
 * cut, which is what stops eleven scenes reading as eleven separate clips.
 */

/**
 * Small mark + wordmark, top left, present for the whole film after the title
 * card. It stays out during the intro, where the full lockup already owns the
 * frame — two of them at once just splits attention.
 */
export const BrandLockup: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [SCENES.praHook.from, SCENES.praHook.from + 16],
    [0, 0.9],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
  <div
    style={{
      position: "absolute",
      // Flush with the safe area, so it shares a left rail with every headline.
      left: 160,
      top: 88,
      display: "flex",
      alignItems: "center",
      gap: 16,
      opacity,
    }}
  >
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        background: C.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Img
        src={staticFile("logo-mark.svg")}
        style={{ width: "78%", height: "78%", objectFit: "contain" }}
      />
    </div>
    <span
      style={{
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 38,
        letterSpacing: "-0.03em",
      }}
    >
      <span style={{ color: C.orange }}>3D</span>
      <span style={{ color: C.white }}>iner</span>
    </span>
  </div>
  );
};

/**
 * A 4px rail that fills across the whole film, turning six repeats into a
 * countdown.
 *
 * Flat brand orange, not a gradient: the gradient's faded tail plus the global
 * vignette meant no pixel of the rail ever actually reached #FD5002. It is also
 * rendered above the grade for the same reason, and its height never changes —
 * a scaling pulse made it visibly thicken in the last second.
 */
export const ProgressRail: React.FC = () => {
  const frame = useCurrentFrame();
  const pct = interpolate(frame, [0, TOTAL_FRAMES], [0, 100], {
    extrapolateRight: "clamp",
  });
  // Arrival is signalled with brightness, not thickness.
  const glow = interpolate(
    frame,
    [TOTAL_FRAMES - 30, TOTAL_FRAMES - 18, TOTAL_FRAMES - 6],
    [0, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: `${pct}%`,
          height: 4,
          background: C.orange,
          boxShadow: glow > 0 ? `0 0 ${18 * glow}px ${6 * glow}px rgba(253,80,2,${0.7 * glow})` : undefined,
        }}
      />
    </AbsoluteFill>
  );
};
