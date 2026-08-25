/** Helper VIEW laporan yang dipakai komponen klien (BarSeries).
 *
 *  Dipisahkan dari `dashboard-v2-reports.ts` (server, membawa supabaseAdmin)
 *  supaya chart klien bisa memakai tipe dan penghitung yang sama tanpa
 *  menarik service-role client ke dalam bundle browser. */

export interface DailyPoint {
  /** Tanggal WIB, "yyyy-mm-dd". */
  day: string;
  label: string;
  value: number;
}

/** Batang yang disorot: satu, dan yang tertinggi.
 *
 *  Efferd dan dua referensi lain melakukan hal yang sama — grafik monokrom
 *  dengan satu batang digelapkan. Sorotan itu bukan kategori; ia menjawab
 *  "mana yang paling menonjol" tanpa menambah hue. */
export function peakIndex(points: DailyPoint[]): number {
  let best = -1;
  let bestValue = 0;
  points.forEach((p, i) => {
    if (p.value > bestValue) {
      bestValue = p.value;
      best = i;
    }
  });
  return best;
}
