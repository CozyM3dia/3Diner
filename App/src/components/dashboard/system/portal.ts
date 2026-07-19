/** Dashboard portal root — spec portal token rule.
 *  Semua portal dashboard (Dialog/Sheet/Popover/Tooltip/Sonner) render ke
 *  elemen ini supaya token .dash-root ikut terbawa. Customer pages tidak
 *  pernah menerima token dashboard. */
export const DASH_PORTAL_ID = "dash-portal-root";

export function getDashPortal(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(DASH_PORTAL_ID);
}
