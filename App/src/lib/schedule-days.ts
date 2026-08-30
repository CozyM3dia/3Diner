/** Utilitas jadwal tayang menu — dipakai form editor & server action.
 *
 *  Format kolom (kontrak sisi pelanggan `menu-availability.ts`):
 *  `schedule_days` = koma ISO weekday "1,2,3" (1=Sen..7=Min); kosong/null =
 *  tiap hari. `schedule_start`/`schedule_end` = "HH:MM", dua-duanya ada
 *  atau dua-duanya kosong. */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

/** Urutkan + unik angka hari valid (1..7). [] atau 7 hari = null (tiap hari). */
export function buildScheduleDays(raw: string | null | undefined): string | null {
  const days = (raw ?? "")
    .split(",")
    .map(d => Number(d.trim()))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 7);
  const uniq = [...new Set(days)].sort((a, b) => a - b);
  if (uniq.length === 0 || uniq.length === 7) return null;
  return uniq.join(",");
}

/** Validasi pasangan jam. Salah satu terisi saja = error, bukan diam-diam
 *  setengah jadwal (jadwal setengah membuat menu hilang tanpa sebab). */
export function validateSchedulePair(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const s = start?.trim() || null;
  const e = end?.trim() || null;
  if ((s && !e) || (e && !s)) {
    return "Isi jam mulai dan jam selesai dua-duanya, atau kosongkan keduanya.";
  }
  if (s && !HHMM.test(s)) return "Jam mulai harus berformat HH:MM.";
  if (e && !HHMM.test(e)) return "Jam selesai harus berformat HH:MM.";
  return null;
}

/** Susun field kolom schedule untuk payload DB dari input mentah form. */
export function buildScheduleFields(
  daysRaw: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
): { schedule_days: string | null; schedule_start: string | null; schedule_end: string | null; error?: string } {
  const pairError = validateSchedulePair(start, end);
  if (pairError) return { schedule_days: null, schedule_start: null, schedule_end: null, error: pairError };
  return {
    schedule_days: buildScheduleDays(daysRaw),
    schedule_start: start?.trim() || null,
    schedule_end: end?.trim() || null,
  };
}
