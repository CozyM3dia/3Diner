import type { OrderItem, OrderStatus } from "@/types";

/** ASUMSI-A4 — ambang ini dikonfigurasi per outlet nanti. Mengubahnya mengubah
 *  urutan dan label, bukan mekanismenya. */
export const NEARING_MINUTES = 10;
export const LATE_MINUTES = 15;

/** Umur dipetakan ke tingkat bernama, bukan dibandingkan sebagai durasi mentah.
 *
 *  Manusia buruk membandingkan "14 mnt" dengan "11 mnt" lintas dua puluh baris.
 *  Tiga tingkat bernama memindahkan perbandingan dari aritmetika ke pengenalan
 *  pola — dan tingkat bisa difilter, durasi mentah tidak. */
export type AgeLevel = "normal" | "nearing" | "late";

export const AGE_LABEL: Record<AgeLevel, string> = {
  normal: "",
  nearing: "Mendekati",
  late: "Terlambat",
};

export function ageLevel(minutes: number): AgeLevel {
  if (minutes >= LATE_MINUTES) return "late";
  if (minutes >= NEARING_MINUTES) return "nearing";
  return "normal";
}

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** Umur ditulis dalam satuan yang masih bisa dibaca sekilas.
 *
 *  "3883 mnt" secara teknis benar dan praktis tidak berarti apa-apa: mata harus
 *  membagi sendiri sebelum tahu itu hampir tiga hari. Menit hanya berguna
 *  selama masih di bawah satu jam, dan justru di rentang itulah kasir memakai
 *  angkanya. */
export function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

interface PayableOrder {
  payment_status: string;
  payment_method: string | null;
}

/** Uang tunai hanya ditagih untuk pesanan bermetode 'cash'. Semua metode online
 *  (qris/gopay/shopeepay/bank_transfer) dilunasi webhook Midtrans, bukan kasir. */
export function needsCash(o: PayableOrder): boolean {
  return o.payment_status !== "paid" && o.payment_method === "cash";
}

/** Ringkasan item untuk satu baris setinggi 44px.
 *
 *  Catatan per item ikut ditampilkan, tidak disembunyikan di lapis 2: ia
 *  mengubah cara memasak, jadi harus terbaca sebelum baris dibuka. */
export function itemSummary(items: OrderItem[]): string {
  return items
    .map((i) => {
      const opts = i.options?.length ? ` (${i.options.map((o) => o.name).join(", ")})` : "";
      const note = i.notes ? ` · “${i.notes}”` : "";
      return `${i.qty}× ${i.nama_menu}${opts}${note}`;
    })
    .join(", ");
}

/** Status yang masih menempati antrean kasir. */
export const OPEN_STATUSES: OrderStatus[] = ["received", "preparing", "ready"];

export function belongsInQueue(status: OrderStatus): boolean {
  return OPEN_STATUSES.includes(status);
}
