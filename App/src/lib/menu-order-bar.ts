/** Sticky "Tambah ke Pesanan" bar chrome — keep in lockstep with MenuOrderPanel:
 *  `pt-3` (12px) + `h-[52px]` control + 12px bottom padding. */
export const MENU_ORDER_BAR_PADDING_TOP_PX = 12;
export const MENU_ORDER_BAR_CONTROL_PX = 52;
export const MENU_ORDER_BAR_PADDING_BOTTOM_PX = 12;
export const MENU_ORDER_BAR_CHROME_PX =
  MENU_ORDER_BAR_PADDING_TOP_PX + MENU_ORDER_BAR_CONTROL_PX + MENU_ORDER_BAR_PADDING_BOTTOM_PX;

/** Extra air so the last in-flow control (3D CTA) is not flush with the bar. */
export const MENU_ORDER_BAR_GAP_PX = 44;

/** Reserved in-flow space below dish-detail content, excluding safe-area. */
export const MENU_ORDER_BAR_SPACE_PX = MENU_ORDER_BAR_CHROME_PX + MENU_ORDER_BAR_GAP_PX;

const SAFE_AREA_BOTTOM = "env(safe-area-inset-bottom, 0px)";

/** In-flow stand-in for the fixed order bar.
 *
 *  Height is a pixel length, not `var(--menu-order-bar-space)`: that token is
 *  easy to drop from the cascade (it is not a Tailwind utility), and an empty
 *  spacer then collapses. `content-box` keeps safe-area padding *outside* the
 *  120px so notched devices still clear the bar. */
export function menuOrderBarSpacerStyle(): {
  boxSizing: "content-box";
  height: string;
  paddingBottom: string;
} {
  return {
    boxSizing: "content-box",
    height: `${MENU_ORDER_BAR_SPACE_PX}px`,
    paddingBottom: SAFE_AREA_BOTTOM,
  };
}

export function menuOrderBarScrollMargin(extraPx = 0): string {
  return `${MENU_ORDER_BAR_SPACE_PX + extraPx}px`;
}
