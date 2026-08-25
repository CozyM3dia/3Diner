import { PAYMENT_METHOD_LABEL } from "@/lib/payment-methods";
import type { OrderItem, OrderStatus, PaymentMethod } from "@/types";

/** Helper VIEW riwayat pesanan — murni, tanpa akses database.
 *
 *  Dipisahkan dari `dashboard-v2-orders.ts` (server, membawa supabaseAdmin)
 *  supaya komponen klien bisa memakai tipe dan pemformat yang sama tanpa
 *  menarik service-role client ke dalam bundle browser. Guard `server-only`
 *  yang gagal build saat Phase 0 adalah yang menemukan campuran ini. */

export const ORDER_TABS = ["semua", "berjalan", "dibatalkan"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export const TAB_LABEL: Record<OrderTab, string> = {
  semua: "Semua",
  berjalan: "Berjalan",
  dibatalkan: "Dibatalkan",
};

/** Tab dibaca dari URL, bukan dari state komponen.
 *
 *  Seluruh keadaan daftar hidup di URL supaya halaman yang sedang dilihat bisa
 *  dikirim apa adanya — ke akuntan, atau ke diri sendiri besok pagi. Nilai yang
 *  tidak dikenal jatuh ke default alih-alih menampilkan daftar kosong yang
 *  membingungkan. */
export function parseTab(value: string | undefined): OrderTab {
  return ORDER_TABS.includes(value as OrderTab) ? (value as OrderTab) : "semua";
}

export function statusesForTab(tab: OrderTab): OrderStatus[] | null {
  if (tab === "berjalan") return ["received", "preparing", "ready"];
  if (tab === "dibatalkan") return ["cancelled"];
  return null;
}

export const PAGE_SIZE = 25;

export interface OrderRowV2 {
  id_order: string;
  table_number: string;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  tax_pct?: number;
  tax_amount?: number;
  service_pct?: number;
  service_amount?: number;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  payment_status: string;
  created_at: string;
  notes?: string | null;
  cancelled_reason?: string | null;
}

export interface OrdersPage {
  rows: OrderRowV2[];
  /** Total dan cacah untuk SELURUH tab yang aktif, bukan hanya halaman ini.
   *
   *  Ringkasan yang hanya menjumlah halaman terlihat seperti total dan bukan
   *  total — dua angka berbeda di satu layar menghancurkan kepercayaan pada
   *  keduanya. */
  filteredCount: number;
  filteredTotal: number;
  counts: Record<OrderTab, number>;
  /** Kursor untuk halaman berikutnya, atau null kalau ini yang terakhir. */
  nextCursor: string | null;
  /** Nomor urut baris pertama halaman ini, untuk "Menampilkan a–b dari N". */
  offsetLabel: { from: number; to: number } | null;
  error: string | null;
}

/** Kursor keyset majemuk: "<created_at>|<id_order>".
 *
 *  created_at saja tidak cukup — dua pesanan bisa berbagi timestamp yang sama
 *  (commit atomik yang sama), dan paging dengan lt(created_at) akan melompati
 *  semua kecuali baris pertama dari grup seri. Tiebreaker id_order membuat
 *  total order deterministik. */
export function encodeCursor(row: { created_at: string; id_order: string }): string {
  return `${row.created_at}|${row.id_order}`;
}

/** Ringkasan item untuk satu baris tabel setinggi 44px. */
export function summarizeItems(items: OrderItem[]): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return items.map((i) => `${i.qty}× ${i.nama_menu}`).join(", ");
}

export const STATUS_TEXT: Record<OrderStatus, string> = {
  awaiting: "Menunggu",
  received: "Baru",
  preparing: "Disiapkan",
  ready: "Siap",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

/** Metode pembayaran ditulis bersama keadaannya.
 *
 *  "QRIS" saja tidak memberi tahu apakah uangnya sudah masuk, dan itu justru
 *  satu-satunya hal yang ingin diketahui pemilik saat membaca riwayat. */
export function describePayment(method: PaymentMethod | null, status: string): string {
  const name = method ? PAYMENT_METHOD_LABEL[method] : "Belum dipilih";
  if (status === "paid") return `${name} · lunas`;
  return `${name} · belum bayar`;
}
