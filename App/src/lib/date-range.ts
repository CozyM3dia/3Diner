/** Util rentang tanggal dashboard — modul NETRAL (tanpa "use client") supaya
 *  bisa dipakai server page (fallback & deteksi preset) dan komponen klien
 *  (DashboardDatePicker) sekaligus. */

export type PresetKey = "today" | "yesterday" | "7d" | "30d" | "mtd" | "custom";

/** Dashboard 3Diner memakai hari bisnis WIB. Jakarta tidak mengenal DST,
 *  jadi offset eksplisit membuat query identik di laptop UTC+7 dan Vercel UTC. */
export function dashboardRangeTimestamps(fromIso: string, toIso: string): { since: string; until: string } {
  return {
    since: new Date(`${fromIso}T00:00:00.000+07:00`).toISOString(),
    until: new Date(`${toIso}T23:59:59.999+07:00`).toISOString(),
  };
}

function wibDay(now: Date): string {
  const shifted = new Date(now.getTime() + 7 * 3600_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** "YYYY-MM-DD" → Date lokal tengah hari (komplement isoDay; aman lintas zona). */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: "today", label: "Hari ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "mtd", label: "Bulan ini" },
  { key: "custom", label: "Custom" },
];

/** Rentang [fromIso, toIso] inklusif untuk hari bisnis WIB. */
export function presetRange(key: PresetKey, now = new Date()): { from: string; to: string } {
  // Parse kembali tanggal WIB sebagai tanggal kalender lokal. Operasi berikutnya
  // adalah aritmetika hari, jadi hasilnya tetap sama di server UTC dan browser.
  const t = parseDay(wibDay(now));
  switch (key) {
    case "today":
      return { from: isoDay(t), to: isoDay(t) };
    case "yesterday": {
      const y = addDays(t, -1);
      return { from: isoDay(y), to: isoDay(y) };
    }
    case "7d":
      return { from: isoDay(addDays(t, -6)), to: isoDay(t) };
    case "30d":
      return { from: isoDay(addDays(t, -29)), to: isoDay(t) };
    case "mtd":
      return { from: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)), to: isoDay(t) };
    default:
      return { from: isoDay(addDays(t, -6)), to: isoDay(t) };
  }
}
