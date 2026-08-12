import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { objection } from "../objections";
import { CoretanScene, STRIKE_DONE } from "../components/CoretanScene";
import {
  DashboardWindow,
  KpiCard,
  OrdersPanel,
  RevenueChart,
} from "../components/Dashboard";
import { PhoneFrame } from "../components/PhoneFrame";
import { C, E, FONT } from "../theme";

/**
 * Objection five. The dashboard is rebuilt as components rather than pasted as
 * a screenshot — at 1080p a real 1512px capture is unreadable, and every panel
 * here needs its own beat. The "Data contoh" label is baked into the window
 * chrome so the sample figures are never presented as results.
 *
 * The orange dot is the only guest-to-owner bridge in the film: it leaves the
 * Pesan button on the guest's phone and lands as a row in the owner's list.
 */
export const CoretanRibet: React.FC = () => {
  return (
    <CoretanScene
      objection={objection("coretanRibet").text}
      tilt={objection("coretanRibet").tilt}
      // Wrapped by hand: at one line this headline ran under the dashboard.
      headline={"Kasir tutup,\nlaporannya sudah jadi."}
      subline="Pesanan, omzet, stok. Satu layar."
      variant="full"
      headlineSize={58}
    >
      <AbsoluteFill>
        {/* Owner's screen. Kept fully inside the frame — the "Data contoh"
            label sits in the window chrome and must never be cropped — and
            small enough to clear the copy column on the left. */}
        <div
          style={{
            position: "absolute",
            right: 60,
            top: 210,
            scale: "0.52",
            transformOrigin: "top right",
          }}
        >
          <DashboardWindow delay={0}>
            <div style={{ display: "flex", gap: 22 }}>
              <KpiCard label="Omzet hari ini" value={2_450_000} format="idr" delay={52} accent />
              <KpiCard label="Pesanan aktif" value={12} delay={60} />
              <KpiCard label="Stok kritis" value={3} delay={66} />
            </div>
            <div style={{ display: "flex", gap: 22, alignItems: "stretch" }}>
              <RevenueChart delay={74} />
              <OrdersPanel delay={40} />
            </div>
          </DashboardWindow>
        </div>

        {/* Guest's phone, well clear of the copy column above it. */}
        <div style={{ position: "absolute", left: 175, bottom: 30 }}>
          <PhoneFrame shot="05-cart" height={320} tiltY={9} glow={false} />
        </div>

        <OrderDot />
        <ClosingTimePill />
      </AbsoluteFill>
    </CoretanScene>
  );
};

/**
 * Endpoints are hardcoded: the phone and the dashboard live at different
 * scales, so deriving them from layout would fight the transforms.
 */
const P0 = { x: 320, y: 830 };
const P1 = { x: 900, y: 500 };
const P2 = { x: 1520, y: 560 };

const OrderDot: React.FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [STRIKE_DONE, STRIKE_DONE + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.inOut,
  });
  if (t <= 0 || frame > STRIKE_DONE + 24) return null;

  const x = (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t ** 2 * P2.x;
  const y = (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t ** 2 * P2.y;
  const size = interpolate(t, [0, 0.6, 1], [8, 16, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.orange,
        boxShadow: `0 0 22px 6px rgba(253,80,2,0.6)`,
      }}
    />
  );
};

/** One time pill, not a running clock — enough to place it at end of service. */
const ClosingTimePill: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        // Right side: the top left belongs to the persistent brand lockup.
        right: 175,
        top: 110,
        padding: "10px 22px",
        borderRadius: 999,
        background: "rgba(13,24,41,0.9)",
        border: "1px solid rgba(255,255,255,0.12)",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: "0.08em",
        color: "rgba(159,182,209,0.95)",
        opacity: interpolate(frame, [98, 110], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      21.10
    </div>
  );
};
