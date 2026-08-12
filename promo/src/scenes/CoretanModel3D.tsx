import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CoretanScene, STRIKE_DONE } from "../components/CoretanScene";
import { objection } from "../objections";
import { Dish3D } from "../components/Dish3D";
import { PhoneFrame } from "../components/PhoneFrame";
import { C, FONT } from "../theme";

const PHONE_H = 640;
const PHONE_W = PHONE_H * (414 / 896);
/** Where the phone sits in the 1920×1080 frame. */
const PHONE_CX = 1330;
const PHONE_CY = 560;

/**
 * The hero beat. A photo is scanned into a mesh, then the real croissant model
 * breaks out of the phone bezel and takes the whole frame — the same model that
 * opened the film, which retroactively explains that first shot.
 *
 * The breakout is a clip-path animating from the phone's screen rect to the
 * full frame. One canvas the whole time; the rotation runs linearly straight
 * through the transition so the spin never stutters when the clip releases.
 */
export const CoretanModel3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = interpolate(frame, [0, 12], [-420, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const scan = interpolate(frame, [14, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dissolve = interpolate(frame, [STRIKE_DONE, STRIKE_DONE + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const modelIn = spring({ frame: frame - STRIKE_DONE, fps, config: { damping: 15 } });

  // The breakout itself.
  const breakout = interpolate(frame, [42, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const clip = {
    top: interpolate(breakout, [0, 1], [PHONE_CY - PHONE_H / 2, 0]),
    right: interpolate(breakout, [0, 1], [1920 - (PHONE_CX + PHONE_W / 2), 0]),
    bottom: interpolate(breakout, [0, 1], [1080 - (PHONE_CY + PHONE_H / 2), 0]),
    left: interpolate(breakout, [0, 1], [PHONE_CX - PHONE_W / 2, 0]),
  };

  return (
    <CoretanScene
      objection={objection("coretanModel3D").text}
      tilt={objection("coretanModel3D").tilt}
      // Broken by hand: left to wrap, "3D-nya." splits across the hyphen.
      headline={"Upload foto.\nAI yang bikin 3D-nya."}
      subline="Tanpa alat scan, tanpa desainer 3D."
      variant="full"
      headlineSize={64}
      warmth={0.4}
    >
      {/* The phone, holding the uploaded photo. It recedes as the model escapes. */}
      <AbsoluteFill
        style={{
          scale: String(interpolate(breakout, [0, 1], [1, 0.84])),
          translate: `0 ${interpolate(breakout, [0, 1], [0, 40])}px`,
          filter: `blur(${interpolate(breakout, [0, 1], [0, 4])}px)`,
          opacity: interpolate(breakout, [0, 1], [1, 0.35]),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: PHONE_CX,
            top: PHONE_CY,
            translate: "-50% -50%",
          }}
        >
          <PhoneFrame height={PHONE_H} glow={false}>
            <div style={{ position: "absolute", inset: 0, background: "#0B1728" }} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                translate: `${cardIn}px 0`,
                opacity: 1 - dissolve,
                filter: `blur(${dissolve * 10}px)`,
              }}
            >
              <Img
                src={staticFile("photos/croissant.png")}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {/* Wireframe fills in behind the scanning bar, never ahead of it. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.8,
                  backgroundImage: `linear-gradient(rgba(0,194,168,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(0,194,168,0.7) 1px, transparent 1px)`,
                  backgroundSize: "26px 26px",
                  clipPath: `inset(0 0 ${(1 - scan) * 100}% 0)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${scan * 100}%`,
                  height: 6,
                  background: `linear-gradient(90deg, rgba(0,194,168,0), ${C.teal}, rgba(0,194,168,0))`,
                  boxShadow: "0 0 34px 10px rgba(0,194,168,0.5)",
                  opacity: scan > 0.01 && scan < 0.99 ? 1 : 0,
                }}
              />
              <FileChip />
            </div>
          </PhoneFrame>
        </div>
      </AbsoluteFill>

      {/* The model. Clipped to the phone screen until the breakout releases it. */}
      <AbsoluteFill
        style={{
          clipPath: `inset(${clip.top}px ${clip.right}px ${clip.bottom}px ${clip.left}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: interpolate(breakout, [0, 1], [PHONE_CX, 1210]),
            top: interpolate(breakout, [0, 1], [PHONE_CY, 560]),
            translate: "-50% -50%",
            scale: String(interpolate(modelIn, [0, 1], [0.7, 1])),
            opacity: modelIn,
          }}
        >
          <Dish3D
            dish="croissant"
            // Linear on purpose: the spin must not hitch when the clip releases.
            rotationY={Math.max(0, frame - STRIKE_DONE) * 0.05}
            size={interpolate(breakout, [0, 1], [300, 900])}
            targetSize={2.15}
            shadow={breakout > 0.6}
          />
        </div>
      </AbsoluteFill>

      <CreditChip />
    </CoretanScene>
  );
};

const FileChip: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        top: 16,
        padding: "8px 16px",
        borderRadius: 999,
        background: "rgba(6,14,27,0.82)",
        border: "1px solid rgba(255,255,255,0.16)",
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 20,
        color: "rgba(233,238,246,0.9)",
        opacity: interpolate(frame, [6, 16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      croissant.jpg
    </div>
  );
};

/** No figure on this chip, so there is no sample number needing a label. */
const CreditChip: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [82, 94], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <div
      style={{
        position: "absolute",
        right: 175,
        bottom: 130,
        padding: "14px 28px",
        borderRadius: 999,
        background: "rgba(0,194,168,0.12)",
        border: `1px solid rgba(0,194,168,0.45)`,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: "0.06em",
        color: C.teal,
        translate: `${interpolate(p, [0, 1], [80, 0])}px 0`,
        opacity: p,
      }}
    >
      Kredit AI sesuai paket
    </div>
  );
};
