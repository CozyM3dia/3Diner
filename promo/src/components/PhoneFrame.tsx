import { Img, staticFile } from "remotion";
import { C } from "../theme";

const SCREEN_RATIO = 414 / 896;

/**
 * A restrained device mockup. No brand logos, no glossy 3D — its only job is to
 * frame a real product screenshot and make it read as a phone in one glance.
 */
export const PhoneFrame: React.FC<{
  /** File under public/shots, without the .png. */
  shot?: string;
  /** Second screen state to cross-fade to, for showing the app respond. */
  shotB?: string;
  /** 0 = `shot`, 1 = `shotB`. */
  mix?: number;
  height: number;
  /** Degrees of Y-rotation for a subtle perspective. 0 = flat on. */
  tiltY?: number;
  tiltX?: number;
  /** Screen content that is not a screenshot. */
  children?: React.ReactNode;
  /** Adds a warm rim glow behind the device. */
  glow?: boolean;
  screenOpacity?: number;
}> = ({
  shot,
  shotB,
  mix = 0,
  height,
  tiltY = 0,
  tiltX = 0,
  children,
  glow = true,
  screenOpacity = 1,
}) => {
  const width = height * SCREEN_RATIO;
  const bezel = Math.max(6, height * 0.011);
  const radius = width * 0.115;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        perspective: 2600,
      }}
    >
      {glow ? (
        <div
          style={{
            position: "absolute",
            inset: -height * 0.16,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, rgba(253,80,2,0.30) 0%, rgba(253,80,2,0) 72%)`,
            filter: "blur(24px)",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          rotate: `y ${tiltY}deg`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            rotate: `x ${tiltX}deg`,
            borderRadius: radius + bezel,
            padding: bezel,
            background: `linear-gradient(155deg, #2B3C55 0%, #0C1626 38%, #060E1B 100%)`,
            boxShadow: `0 ${height * 0.05}px ${height * 0.11}px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.09) inset`,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: radius,
              overflow: "hidden",
              background: C.paper,
            }}
          >
            {shot ? (
              <Img
                src={staticFile(`shots/${shot}.png`)}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                  opacity: screenOpacity,
                }}
              />
            ) : null}
            {shotB ? (
              <Img
                src={staticFile(`shots/${shotB}.png`)}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                  opacity: screenOpacity * mix,
                }}
              />
            ) : null}
            {children}

            {/* Screen glare — one soft diagonal band, nothing more. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(118deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 68%, rgba(255,255,255,0.06) 100%)",
              }}
            />

            {/* Dynamic island */}
            <div
              style={{
                position: "absolute",
                top: height * 0.014,
                left: "50%",
                translate: "-50% 0",
                width: width * 0.27,
                height: height * 0.0175,
                borderRadius: 999,
                background: "#05080F",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
