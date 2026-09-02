/** Kontrak tema papan dapur.
 *
 *  Terpisah dari `tema-3diner` milik konsol dan disimpan sebagai `data-kds`
 *  di <html>, bukan `data-theme`. Dua alasan, keduanya operasional:
 *
 *  1. `ThemeSync` global menegakkan ulang `data-theme` setelah hidrasi. Apa
 *     pun yang papan ini setel di sana akan dikembalikan beberapa milidetik
 *     kemudian — jadi papan butuh atributnya sendiri, bukan lomba menulis.
 *
 *  2. Tablet di dinding dapur dan laptop pemilik adalah dua perangkat dengan
 *     dua kebutuhan cahaya. Pemilik yang menyalakan mode terang dari rumah
 *     tidak seharusnya menyilaukan dapur yang sedang buka sampai tengah malam.
 */

export const KUNCI_TEMA_DAPUR = "tema-dapur";

export type TemaDapur = "gelap" | "terang";

/** Pre-paint untuk rute dapur standalone. Gelap adalah bawaannya. */
export const SKRIP_TEMA_DAPUR = `(function(){try{var t=localStorage.getItem("${KUNCI_TEMA_DAPUR}");document.documentElement.dataset.kds=(t==="terang")?"terang":"gelap";}catch(e){document.documentElement.dataset.kds="gelap";}})();`;

/** Pre-paint untuk papan di dalam konsol: cerminkan tema konsol, supaya panel
 *  ini tidak jadi satu-satunya kotak gelap di halaman yang terang. */
export const SKRIP_TEMA_KONSOL = `(function(){try{var t=localStorage.getItem("tema-3diner");var d=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var m=(t==="light"||t==="dark")?t:(d?"dark":"light");document.documentElement.dataset.kds=(m==="light")?"terang":"gelap";}catch(e){document.documentElement.dataset.kds="gelap";}})();`;

export function bacaTemaDapur(): TemaDapur {
  if (typeof document === "undefined") return "gelap";
  return document.documentElement.dataset.kds === "terang" ? "terang" : "gelap";
}

export function pasangTemaDapur(tema: TemaDapur) {
  document.documentElement.dataset.kds = tema;
  try {
    localStorage.setItem(KUNCI_TEMA_DAPUR, tema);
  } catch {
    /* storage diblokir — tema tetap berlaku untuk sesi ini */
  }
}
