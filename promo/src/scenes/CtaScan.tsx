import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Backdrop } from "../components/Backdrop";
import { LogoMark } from "../components/LogoMark";
import { C, E, FONT } from "../theme";

/**
 * The close. The last frame has to stand alone as a poster: if someone
 * screenshots it and forwards it on WhatsApp, the logo, the tagline, the entry
 * price, the QR and the address are all present at once.
 *
 * The final twelve frames are completely static so the QR can actually be
 * scanned off the screen.
 */
export const CtaScan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame: frame - 8, fps, config: { damping: 18 } });
  const taglineClip = interpolate(frame, [22, 36], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const qrIn = spring({ frame: frame - 24, fps, config: { damping: 18 } });
  const brackets = interpolate(frame, [36, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });

  return (
    <AbsoluteFill>
      <Backdrop warmth={0.55} />
      <AbsoluteFill
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 130,
          padding: "0 170px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: 820 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              translate: `0 ${interpolate(logoIn, [0, 1], [-30, 0])}px`,
              opacity: logoIn,
            }}
          >
            <LogoMark size={110} />
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 104,
                letterSpacing: "-0.045em",
              }}
            >
              <span style={{ color: C.orange }}>3D</span>
              <span style={{ color: C.white }}>iner</span>
            </span>
          </div>

          <div style={{ overflow: "hidden", clipPath: `inset(0 ${taglineClip}% 0 0)` }}>
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: 44,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(233,238,246,0.88)",
                whiteSpace: "nowrap",
              }}
            >
              Lihat Sebelum Memesan
            </span>
          </div>

          <div
            style={{
              marginTop: 12,
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 58,
              lineHeight: 1.15,
              color: C.white,
              opacity: interpolate(frame, [42, 54], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: `0 ${interpolate(frame, [42, 56], [16, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: E.out,
              })}px`,
            }}
          >
            Scan QR ini,
            <br />
            coba menunya sendiri.
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 8,
              opacity: interpolate(frame, [56, 68], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 38,
                color: "rgba(159,182,209,0.95)",
              }}
            >
              3diner.vercel.app
            </span>
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 30,
                color: C.white,
                background: `linear-gradient(90deg, ${C.orange}, ${C.orangeBright})`,
                borderRadius: 999,
                padding: "10px 26px",
              }}
            >
              mulai Rp50.000 per bulan
            </span>
          </div>
        </div>

        {/* The real QR — it resolves to the Senja Kopi menu. */}
        <div
          style={{
            position: "relative",
            scale: String(interpolate(qrIn, [0, 1], [0.85, 1])),
            opacity: qrIn,
          }}
        >
          <div
            style={{
              width: 420,
              height: 420,
              borderRadius: 30,
              background: C.white,
              padding: 34,
              boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
            }}
          >
            <Img src={staticFile("qr-menu.svg")} style={{ width: "100%", height: "100%" }} />
          </div>
          {[
            { top: -18, left: -18, bt: true, bl: true },
            { top: -18, right: -18, bt: true, br: true },
            { bottom: -18, left: -18, bb: true, bl: true },
            { bottom: -18, right: -18, bb: true, br: true },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 70 * brackets,
                height: 70 * brackets,
                top: c.top,
                bottom: c.bottom,
                left: c.left,
                right: c.right,
                borderTop: c.bt ? `5px solid ${C.teal}` : undefined,
                borderBottom: c.bb ? `5px solid ${C.teal}` : undefined,
                borderLeft: c.bl ? `5px solid ${C.teal}` : undefined,
                borderRight: c.br ? `5px solid ${C.teal}` : undefined,
                borderRadius: 10,
                opacity: brackets,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
