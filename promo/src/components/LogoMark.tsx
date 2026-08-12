import { Img, staticFile } from "remotion";
import { C } from "../theme";

/**
 * The cube mark has navy faces, so on a navy field two of its three sides
 * vanish. It gets the same off-white tile the product uses for the cafe header
 * icon, which keeps every face readable.
 */
export const LogoMark: React.FC<{ size: number; glow?: boolean }> = ({ size, glow = true }) => (
  <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
    {glow ? (
      <div
        style={{
          position: "absolute",
          inset: -size * 0.32,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(253,80,2,0.42), rgba(253,80,2,0))",
          filter: "blur(16px)",
        }}
      />
    ) : null}
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: size * 0.24,
        background: C.white,
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
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
  </div>
);
