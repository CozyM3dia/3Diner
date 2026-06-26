/** Readable foreground color for a given background hex.
 *  Uses WCAG relative luminance; returns brand navy on light backgrounds,
 *  white on dark ones, so a light banner color never swallows its text. */
export function readableOn(bgHex: string): string {
  const hex = bgHex.replace("#", "").trim();
  if (hex.length !== 6) return "#FFFFFF";
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55 ? "#022C60" : "#FFFFFF";
}

/** Soft translucent version of the foreground, for secondary marks (icons, close). */
export function readableSoftOn(bgHex: string): string {
  return readableOn(bgHex) === "#022C60" ? "rgba(2,44,96,0.62)" : "rgba(255,255,255,0.78)";
}
