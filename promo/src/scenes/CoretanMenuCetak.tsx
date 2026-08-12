import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CoretanScene, STRIKE_DONE } from "../components/CoretanScene";
import { objection } from "../objections";
import { PhoneFrame } from "../components/PhoneFrame";
import { C, E, FONT } from "../theme";

/**
 * Prices match the live Senja Kopi menu exactly, including the screenshot on
 * the phone beside this panel. An invented Rp95.000 for the steak used to
 * contradict the Rp38.000 visible one frame away.
 */
const ROWS = [
  { photo: "steak", name: "Steak", price: "Rp38.000" },
  { photo: "pasta", name: "Pasta Meatball", price: "Rp50.000" },
  { photo: "kopi", name: "Es Kopi Susu", price: "Rp22.000" },
] as const;

/**
 * Objection six, and the only beat where the owner changes the outcome instead
 * of watching it. A schedule toggle and a discount on the owner's side produce
 * a promo card on the guest's side — the two halves of the product, connected.
 *
 * The last 1.3 seconds are deliberately still. The recap lands harder after a
 * breath than after a cut.
 */
export const CoretanMenuCetak: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const knob = spring({ frame: frame - (STRIKE_DONE + 6), fps, config: { damping: 15 } });
  const link = interpolate(frame, [STRIKE_DONE + 26, STRIKE_DONE + 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const promoIn = spring({ frame: frame - (STRIKE_DONE + 44), fps, config: { damping: 16 } });
  // The three dim dishes come back to life — the same move as the recap card.
  const life = interpolate(frame, [STRIKE_DONE + 56, STRIKE_DONE + 82], [0.2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.inOut,
  });

  return (
    <CoretanScene
      objection={objection("coretanMenuCetak").text}
      tilt={objection("coretanMenuCetak").tilt}
      headline="Menu cetak tidak bisa diubah."
      // One line: the two-line version dropped "dashboard." straight onto the
      // panel heading below it and destroyed both.
      subline="Ubah menu dan diskon kapan saja."
      variant="full"
      headlineSize={62}
    >
      <AbsoluteFill>
        {/* Owner side */}
        <div
          style={{
            position: "absolute",
            left: 160,
            bottom: 60,
            width: 700,
            padding: 26,
            borderRadius: 22,
            background: "#060E1B",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: "#9FB6D1" }}>
              Atur menu
            </span>
            {/* This panel carries sample figures too, so it carries the label. */}
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: C.white,
                background: "rgba(81,105,143,0.55)",
                border: "1px solid rgba(159,182,209,0.4)",
                borderRadius: 999,
                padding: "6px 18px",
              }}
            >
              Data contoh
            </span>
          </div>
          {ROWS.map((r, i) => {
            const enter = interpolate(frame, [i * 4, i * 4 + 14], [32, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: E.out,
            });
            return (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 14px",
                  marginBottom: 10,
                  borderRadius: 14,
                  background: "#132136",
                  translate: `0 ${enter}px`,
                  opacity: interpolate(frame, [i * 4, i * 4 + 12], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                <Img
                  src={staticFile(`photos/${r.photo}.png`)}
                  style={{
                    width: 74,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 10,
                    filter: `saturate(${life})`,
                  }}
                />
                <span
                  style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: "#E9EEF6", flex: 1 }}
                >
                  {r.name}
                </span>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 24, color: "#5A7898" }}>
                  {r.price}
                </span>
              </div>
            );
          })}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 18,
            }}
          >
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 26, color: "#9FB6D1" }}>
              Jadwal tayang
            </span>
            <div
              style={{
                width: 76,
                height: 40,
                borderRadius: 999,
                background: knob > 0.5 ? C.success : "#51698F",
                display: "flex",
                alignItems: "center",
                padding: 4,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: C.white,
                  translate: `${interpolate(knob, [0, 1], [0, 34])}px 0`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Guest side */}
        <div style={{ position: "absolute", right: 190, bottom: 40 }}>
          <PhoneFrame shot="02-home-grid" height={560} tiltY={-8} glow={false}>
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                top: 96,
                padding: "12px 16px",
                borderRadius: 14,
                background: `linear-gradient(90deg, ${C.orange}, ${C.orangeBright})`,
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 22,
                color: C.white,
                scale: String(interpolate(promoIn, [0, 1], [0.9, 1])),
                opacity: promoIn,
              }}
            >
              Promo sore · 20% OFF
            </div>
          </PhoneFrame>
        </div>

        {/* The link between the two sides. */}
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <path
            d="M 850 700 C 1050 560, 1200 520, 1400 600"
            fill="none"
            stroke={C.teal}
            strokeWidth={3}
            strokeDasharray={700}
            strokeDashoffset={700 * (1 - link)}
            opacity={0.75}
          />
        </svg>
      </AbsoluteFill>
    </CoretanScene>
  );
};
