/** Util rentang tanggal dashboard — modul NETRAL (tanpa "use client") supaya
 *  bisa dipakai server page (fallback & deteksi preset) dan komponen klien
 *  (DashboardDatePicker) sekaligus. */

export type PresetKey = "today" | "yesterday" | "7d" | "30d" | "mtd" | "custom";

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

export const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: "today", label: "Hari ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "mtd", label: "Bulan ini" },
  { key: "custom", label: "Custom" },
];

/** Rentang [fromIso, toIso] inklusif untuk preset (zona jam lokal browser/server). */
export function presetRange(key: PresetKey, now = new Date()): { from: string; to: string } {
  const t = startOfDay(now);
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
