import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { objection } from "../objections";
import { CoretanScene, STRIKE_DONE } from "../components/CoretanScene";
import { PhoneFrame } from "../components/PhoneFrame";
import { C, E } from "../theme";

/**
 * Objection two, answered with the QR itself. No App Store badge anywhere —
 * that absence is the argument.
 *
 * The QR is the real one and resolves to the Senja Kopi menu, so a viewer can
 * scan it straight off the screen.
 */
export const CoretanInstall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneIn = spring({ frame, fps, config: { damping: 20, stiffness: 90 } });
  const sweep = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ring = interpolate(frame, [STRIKE_DONE, STRIKE_DONE + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const screenReveal = interpolate(frame, [STRIKE_DONE + 2, STRIKE_DONE + 14], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const scroll = interpolate(frame, [76, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });

  return (
    <CoretanScene
      objection={objection("coretanInstall").text}
      tilt={objection("coretanInstall").tilt}
      headline="Scan QR, menu langsung terbuka."
      subline="Tanpa install. Tanpa daftar akun."
      headlineSize={62}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 54 }}>
        <div
          style={{
            position: "relative",
            width: 260,
            height: 260,
            borderRadius: 26,
            background: C.white,
            padding: 22,
            boxShadow: "0 30px 64px rgba(0,0,0,0.45)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Img src={staticFile("qr-menu.svg")} style={{ width: "100%", height: "100%" }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${sweep * 100}%`,
              height: 4,
              background: `linear-gradient(90deg, rgba(0,194,168,0), ${C.teal}, rgba(0,194,168,0))`,
              boxShadow: `0 0 30px 8px rgba(0,194,168,0.55)`,
              opacity: sweep > 0.01 && sweep < 0.99 ? 1 : 0,
            }}
          />
          {/* Confirmation ring once the code is read. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              translate: "-50% -50%",
              width: 200,
              height: 200,
              borderRadius: "50%",
              border: `4px solid ${C.teal}`,
              scale: String(interpolate(ring, [0, 1], [0.2, 2.4])),
              opacity: 1 - ring,
            }}
          />
        </div>

        <div style={{ translate: `0 ${interpolate(phoneIn, [0, 1], [260, 0])}px` }}>
          <PhoneFrame height={620} tiltY={-8}>
            <div style={{ position: "absolute", inset: 0, background: C.paper }} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                clipPath: `inset(${screenReveal}% 0 0 0)`,
                overflow: "hidden",
              }}
            >
              <Img
                src={staticFile("shots/01-home.png")}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                  opacity: 1 - scroll,
                }}
              />
              <Img
                src={staticFile("shots/02-home-grid.png")}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                  opacity: scroll,
                }}
              />
            </div>
          </PhoneFrame>
        </div>
      </div>
    </CoretanScene>
  );
};
