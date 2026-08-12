import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Dish3D } from "../components/Dish3D";
import { PhoneFrame } from "../components/PhoneFrame";
import { C, E } from "../theme";
import { SCENES } from "../timeline";

const PHONE_H = 880;

/**
 * Two seconds of food after the early price beat. The audience sells food for
 * a living — they should see the product before the objection wall arrives.
 *
 * The croissant here is the same model that breaks out of the phone at 15s, so
 * the opening shot is quietly explained later.
 */
export const PraHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.praHook.duration;

  const rise = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 0.6 } });
  const push = interpolate(frame, [0, duration], [1, 1.03]);
  const breathe = interpolate(frame, [0, 8], [1, 1.005], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop warmth={0.35} />
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", scale: String(push) }}
      >
        {/* Centred: with the title card ahead of it this beat owns the frame. */}
        <div style={{ position: "relative", scale: String(breathe) }}>
          <PhoneFrame shot="03-dish-detail" height={PHONE_H} tiltY={-6}>
            {/* Darkening the screenshot lets the lit model read against it. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: C.navyDark,
                opacity: interpolate(frame, [10, 34], [0, 0.5], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                translate: `0 ${interpolate(rise, [0, 1], [90, 0])}px`,
                scale: String(interpolate(rise, [0, 1], [0.35, 1])),
              }}
            >
              <Dish3D
                dish="croissant"
                rotationY={Math.max(0, frame - 34) * 0.045}
                size={PHONE_H * 0.46}
                targetSize={2.1}
                shadow={false}
              />
            </div>

            {/* Tap ripple on the real "Lihat Model 3D" button in the screenshot. */}
            <TapRing at={6} />
          </PhoneFrame>

          {/* Contact shadow widens as the dish settles. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -34,
              translate: "-50% 0",
              width: 420,
              height: 46,
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)",
              filter: "blur(14px)",
              scale: `${interpolate(frame, [34, duration], [0.2, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: E.out,
              })} 1`,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const TapRing: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  return (
    <div
      style={{
        position: "absolute",
        // Matches the "Lihat Model 3D" button in shots/03-dish-detail.png.
        left: "50%",
        top: "63%",
        translate: "-50% -50%",
        width: 120,
        height: 120,
        borderRadius: "50%",
        border: `4px solid ${C.orange}`,
        scale: String(interpolate(p, [0, 1], [0.6, 1.4])),
        opacity: 1 - p,
      }}
    />
  );
};
