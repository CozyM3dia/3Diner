/** Aturan jadwal tayang, dipisah dari komponen supaya bisa diuji langsung. */

export const WEEKDAYS = [
  { iso: "1", short: "Sn", label: "Senin" },
  { iso: "2", short: "Sl", label: "Selasa" },
  { iso: "3", short: "Rb", label: "Rabu" },
  { iso: "4", short: "Km", label: "Kamis" },
  { iso: "5", short: "Jm", label: "Jumat" },
  { iso: "6", short: "St", label: "Sabtu" },
  { iso: "7", short: "Mg", label: "Minggu" },
] as const;

/** `null` dan "semua hari terpilih" berarti hal yang sama: tayang tiap hari.
 *
 *  Menyimpan "1,2,3,4,5,6,7" alih-alih null membuat jadwal terlihat ada padahal
 *  tidak membatasi apa pun — dan pemilik yang membacanya nanti akan mengira ada
 *  aturan yang perlu dijaga. */
export function parseDays(raw: string | null): Set<string> {
  if (!raw) return new Set(WEEKDAYS.map((d) => d.iso));
  const set = new Set(
    raw
      .split(",")
      .map((d) => d.trim())
      .filter((d) => /^[1-7]$/.test(d))
  );
  return set.size === 0 ? new Set(WEEKDAYS.map((d) => d.iso)) : set;
}

export function serializeDays(days: Set<string>): string | null {
  if (days.size === 0 || days.size >= WEEKDAYS.length) return null;
  return WEEKDAYS.filter((d) => days.has(d.iso))
    .map((d) => d.iso)
    .join(",");
}

/** Kalimat yang menjelaskan jadwal apa adanya.
 *
 *  Deretan chip hari yang aktif tidak memberi tahu akibatnya. Kalimat ini yang
 *  dibaca pemilik untuk memastikan ia tidak baru saja menyembunyikan menunya
 *  dari tamu tanpa sadar. */
export function describeSchedule(params: {
  isActive: boolean;
  days: Set<string>;
  start: string | null;
  end: string | null;
}): string {
  if (!params.isActive) return "Dimatikan — tamu tidak melihat item ini sama sekali.";

  const allDays = params.days.size >= WEEKDAYS.length;
  const dayText = allDays
    ? "setiap hari"
    : WEEKDAYS.filter((d) => params.days.has(d.iso))
        .map((d) => d.short)
        .join(", ");

  if (!params.start || !params.end) return `Tayang ${dayText}, sepanjang jam buka.`;

  const overnight = params.end <= params.start;
  return overnight
    ? `Tayang ${dayText}, ${params.start}–${params.end} (melewati tengah malam).`
    : `Tayang ${dayText}, ${params.start}–${params.end}.`;
}

/** Harga setelah diskon, dibulatkan sama seperti yang dihitung database. */
export function pricePreview(price: number, discountPct: number | null): number {
  const pct = Math.min(Math.max(discountPct ?? 0, 0), 100);
  return Math.round(price * (1 - pct / 100));
}
