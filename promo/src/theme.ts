import { loadFont } from "@remotion/google-fonts/Poppins";
import { Easing } from "remotion";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const FONT = fontFamily;

/** Brand contract — mirrors brand/UI_TOKENS.md. */
export const C = {
  navy: "#022C60",
  navyDark: "#002355",
  navyDeep: "#010A18",
  navySoft: "#254473",
  navyMuted: "#51698F",
  orange: "#FD5002",
  orangeBright: "#FC6A41",
  orangeTint: "#FDD8C3",
  white: "#FDFDFD",
  paper: "#F6F8FB",
  border: "#CFD9E4",
  teal: "#00C2A8",
  success: "#22D3A6",
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

/**
 * One easing vocabulary for the whole film, so every move feels like it came
 * from the same hand.
 */
export const E = {
  /** Expo-out. Default for anything entering the frame. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Quint-out, a touch softer than `out` for large travelling objects. */
  glide: Easing.bezier(0.22, 1, 0.36, 1),
  /** Overshoot. For accents that should land with a snap. */
  snap: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Symmetric. For cross-scene camera moves. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Fast start, long settle. For exits. */
  in: Easing.bezier(0.7, 0, 0.84, 0),
} as const;

/** Type scale tuned for a 1920×1080 frame viewed at a distance. */
export const T = {
  eyebrow: 30,
  hero: 132,
  headline: 108,
  title: 76,
  body: 46,
  label: 32,
  metric: 88,
} as const;

export const SAFE = { x: 160, y: 120 } as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// The scene table lives in ./timeline, which derives it from the soundtrack's
// bar grid in ./music. Keeping it out of here avoids a circular import.
