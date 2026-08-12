import { Interactive, interpolate, useCurrentFrame } from "remotion";
import { C, E, FONT } from "../theme";

/**
 * The owner dashboard, rebuilt as animated components rather than a pasted
 * screenshot: at 1080p a real 1512px-wide capture would be unreadable, and
 * every element here can carry its own motion. Tokens match
 * brand/UI_TOKENS.md so it reads as the same product.
 */

const panel: React.CSSProperties = {
  background: "#0D1829",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 20,
};

/** Counts a number up with an expo settle, formatted the Indonesian way. */
const useCountUp = (to: number, delay: number, duration = 40) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + duration], [0, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
};

const idr = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

export const KpiCard: React.FC<{
  label: string;
  value: number;
  format?: "idr" | "plain" | "percent";
  delta?: string;
  delay: number;
  accent?: boolean;
}> = ({ label, value, format = "plain", delta, delay, accent = false }) => {
  const frame = useCurrentFrame();
  const n = useCountUp(value, delay + 6);

  return (
    <Interactive.Div
      name={`KPI ${label}`}
      style={{
        ...panel,
        padding: "26px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `0 ${interpolate(frame, [delay, delay + 24], [26, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: E.out,
        })}px`,
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#5A7898",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 52,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: accent ? C.orange : "#E9EEF6",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {format === "idr" ? idr(n) : format === "percent" ? `${n.toFixed(1)}%` : Math.round(n)}
      </span>
      {delta ? (
        <span
          style={{
            alignSelf: "flex-start",
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 700,
            color: C.success,
            background: "rgba(34,211,166,0.12)",
            border: "1px solid rgba(34,211,166,0.28)",
            borderRadius: 999,
            padding: "4px 12px",
          }}
        >
          {delta}
        </span>
      ) : null}
    </Interactive.Div>
  );
};

export const RevenueChart: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const bars = [42, 55, 38, 64, 71, 58, 88, 76, 94, 82, 100, 91];

  return (
    <Interactive.Div
      name="Revenue chart"
      style={{
        ...panel,
        padding: "26px 28px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        flex: 1,
        opacity: interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: 24,
          fontWeight: 700,
          color: "#9FB6D1",
        }}
      >
        Penjualan 12 hari terakhir
      </span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 250, flex: 1 }}>
        {bars.map((h, i) => {
          const start = delay + 10 + i * 2.5;
          const grown = interpolate(frame, [start, start + 26], [0, h], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: E.out,
          });
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${grown}%`,
                borderRadius: 8,
                background:
                  i >= bars.length - 3
                    ? `linear-gradient(180deg, ${C.orangeBright}, ${C.orange})`
                    : "linear-gradient(180deg, #2C4466, #1B3352)",
              }}
            />
          );
        })}
      </div>
    </Interactive.Div>
  );
};

export const OrdersPanel: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  // Amber sat outside the palette, so the in-between state uses muted navy.
  const rows = [
    { meja: "Meja 4", item: "2× Pasta Meatball", status: "Baru", color: C.orange, fg: C.orange },
    {
      meja: "Meja 2",
      item: "1× Butter Croissant",
      status: "Disiapkan",
      color: C.navyMuted,
      fg: C.white,
    },
    { meja: "Meja 7", item: "3× Es Kopi Susu", status: "Siap", color: C.success, fg: C.success },
  ];

  return (
    <Interactive.Div
      name="Orders panel"
      style={{
        ...panel,
        padding: "26px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: 620,
        opacity: interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <span style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: "#9FB6D1" }}>
        Pesanan masuk
      </span>
      {rows.map((row, i) => {
        const start = delay + 16 + i * 12;
        return (
          <div
            key={row.meja}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              background: "#132136",
              borderRadius: 14,
              padding: "16px 20px",
              opacity: interpolate(frame, [start, start + 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: `${interpolate(frame, [start, start + 22], [40, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: E.out,
              })}px 0`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: "#E9EEF6" }}>
                {row.meja}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 21, fontWeight: 500, color: "#5A7898" }}>
                {row.item}
              </span>
            </div>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 20,
                fontWeight: 700,
                color: row.fg,
                border: `1px solid ${row.color}55`,
                background: `${row.color}33`,
                borderRadius: 999,
                padding: "6px 16px",
                whiteSpace: "nowrap",
              }}
            >
              {row.status}
            </span>
          </div>
        );
      })}
    </Interactive.Div>
  );
};

/** Dark app window chrome so the panels read as one screen, not loose cards. */
export const DashboardWindow: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: 1560,
        borderRadius: 26,
        background: "#060E1B",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 60px 120px rgba(0,0,0,0.55)",
        overflow: "hidden",
        opacity: interpolate(frame, [delay, delay + 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(frame, [delay, delay + 30], [0.96, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: E.out,
        }),
      }}
    >
      <div
        style={{
          height: 88,
          background: "#0B1728",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 24px",
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c }} />
        ))}
        <span
          style={{
            marginLeft: 22,
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 600,
            color: "#5A7898",
          }}
        >
          3diner.vercel.app/dashboard
        </span>
        {/*
          Sample figures, not a performance claim, and the disclaimer has to be
          readable at the size the window is actually shown. This window gets
          scaled to 0.60 in the scene, so 46px here lands at ~28px on screen —
          the minimum the brief sets for a label.
        */}
        <span
          style={{
            marginLeft: "auto",
            fontFamily: FONT,
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: C.white,
            background: "rgba(81,105,143,0.55)",
            border: "1px solid rgba(159,182,209,0.4)",
            borderRadius: 999,
            padding: "8px 24px",
          }}
        >
          Data contoh
        </span>
      </div>
      <div style={{ padding: 30, display: "flex", flexDirection: "column", gap: 22 }}>
        {children}
      </div>
    </div>
  );
};
