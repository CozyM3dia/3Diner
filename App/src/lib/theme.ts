/** Tema aplikasi 3Diner — kontrak terkunci:
 *  - Tema aktif direfleksikan sebagai atribut <html data-theme="light" | "dark">.
 *  - Pilihan pengguna disimpan di localStorage key "tema-3diner"
 *    dengan nilai "light" | "dark" | "system".
 *  - Tanpa nilai tersimpan: ikuti prefers-color-scheme.
 *  - Anti-FOUC: skrip inline di layout root men-set data-theme sebelum paint;
 *    modul ini dipakai untuk perubahan runtime (mis. toggle, settings).
 *  Murni client-side — tanpa import server, aman diimpor komponen mana pun. */

export type Theme = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "tema-3diner";

/** Resolusi tema efektif dari pilihan + kondisi sistem. */
export function resolveTheme(theme: Theme, prefersDark: boolean): EffectiveTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

/** Baca pilihan tersimpan; nilai tidak dikenal / storage gagal → "system". */
export function getStoredTheme(): Theme {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage diblokir (private mode) — fallback ke system */
  }
  return "system";
}

/** Simpan pilihan dan terapkan ke <html data-theme>. Return tema efektif. */
export function setTheme(theme: Theme): EffectiveTheme {
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effective = resolveTheme(theme, prefersDark);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage penuh/terkunci — tema tetap berlaku untuk sesi ini */
  }
  document.documentElement.dataset.theme = effective;
  return effective;
}
