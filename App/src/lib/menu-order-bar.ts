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

/** CSS height for the dish-detail spacer / scroll-margin.
 *
 *  Inline `var(--menu-order-bar-space)` is not enough: that token is easy to
 *  drop from the cascade (it is not a Tailwind utility), and an empty spacer
 *  then collapses. Always emit a `calc()` with a pixel fallback. */
export function menuOrderBarSpaceCalc(extraPx = 0): string {
  return `calc(env(safe-area-inset-bottom, 0px) + ${MENU_ORDER_BAR_SPACE_PX + extraPx}px)`;
}
