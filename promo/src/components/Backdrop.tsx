import { AbsoluteFill, Interactive, interpolate, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";
import { C } from "../theme";

/**
 * The film's one and only background: deep navy with two slow light sources
 * drifting behind everything. Nothing here should ever compete with the
 * foreground message.
 */
export const Backdrop: React.FC<{
  /** 0 = calm navy, 1 = warm, lit from the orange side. */
  warmth?: number;
  /** Lifts the whole plate towards a light UI moment. */
  light?: boolean;
}> = ({ warmth = 0, light = false }) => {
  const frame = useCurrentFrame();

  const driftX = noise2D("backdrop-x", frame / 220, 0) * 260;
  const driftY = noise2D("backdrop-y", frame / 260, 0) * 180;

  return (
    <AbsoluteFill
      style={{
        background: light
          ? `radial-gradient(120% 90% at 50% 0%, ${C.white} 0%, ${C.paper} 55%, #E7EDF5 100%)`
          : `radial-gradient(130% 100% at 50% 8%, #0A2A5E 0%, ${C.navyDark} 42%, ${C.navyDeep} 100%)`,
      }}
    >
      <Interactive.Div
        name="Warm light source"
        style={{
          position: "absolute",
          left: -240 + driftX,
          bottom: -420 - driftY,
          width: 1500,
          height: 1500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.orange} 0%, rgba(253,80,2,0) 62%)`,
          opacity: light ? 0.1 : interpolate(warmth, [0, 1], [0.16, 0.42]),
          filter: "blur(30px)",
        }}
      />
      <Interactive.Div
        name="Cool light source"
        style={{
          position: "absolute",
          right: -320 - driftX,
          top: -520 + driftY,
          width: 1400,
          height: 1400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.teal} 0%, rgba(0,194,168,0) 60%)`,
          opacity: light ? 0.08 : 0.17,
          filter: "blur(30px)",
        }}
      />

      {/* Structural grid — barely there, but it keeps the frame from feeling empty. */}
      <AbsoluteFill
        style={{
          opacity: light ? 0.05 : 0.09,
          backgroundImage: `linear-gradient(${light ? C.navy : C.white} 1px, transparent 1px), linear-gradient(90deg, ${light ? C.navy : C.white} 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
          maskImage:
            "radial-gradient(75% 70% at 50% 45%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "radial-gradient(75% 70% at 50% 45%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Film grain + vignette. Sits above every scene, below nothing. */
export const FilmFinish: React.FC = () => {
  const frame = useCurrentFrame();
  // Re-seeding the pattern offset each frame is what sells the grain as film
  // rather than a static texture.
  const ox = Math.round(noise2D("grain-x", frame, 0) * 220);
  const oy = Math.round(noise2D("grain-y", 0, frame) * 220);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          opacity: 0.05,
          mixBlendMode: "overlay",
          backgroundPosition: `${ox}px ${oy}px`,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(78% 68% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
