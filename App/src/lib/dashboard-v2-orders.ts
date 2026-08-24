import { supabaseAdmin } from "@/lib/supabase-admin";
import { PAYMENT_METHOD_LABEL } from "@/lib/payment-methods";
import type { OrderItem, OrderStatus, PaymentMethod } from "@/types";

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

const EMPTY: OrdersPage = {
  rows: [],
  filteredCount: 0,
  filteredTotal: 0,
  counts: { semua: 0, berjalan: 0, dibatalkan: 0 },
  nextCursor: null,
  offsetLabel: null,
  error: null,
};

/** Kursor keyset majemuk: "<created_at>|<id_order>".
 *
 *  created_at saja tidak cukup — dua pesanan bisa berbagi timestamp yang sama
 *  (commit atomik yang sama), dan paging dengan lt(created_at) akan melompati
 *  semua kecuali baris pertama dari grup seri. Tiebreaker id_order membuat
 *  total order deterministik. */
export function encodeCursor(row: { created_at: string; id_order: string }): string {
  return `${row.created_at}|${row.id_order}`;
}

function parseCursor(cursor: string): { createdAt: string; idOrder: string } | null {
  const sep = cursor.lastIndexOf("|");
  if (sep <= 0) return null;
  const createdAt = cursor.slice(0, sep);
  const idOrder = cursor.slice(sep + 1);
  if (!createdAt || !idOrder) return null;
  return { createdAt, idOrder };
}

/** Riwayat pesanan dengan kursor, bukan offset.
 *
 *  Daftar ini menerima baris baru saat sedang dibaca. Offset menggeser jendela
 *  setiap ada yang masuk, sehingga sebuah baris bisa terlewat sama sekali — dan
 *  pesanan yang terlewat berarti pesanan yang tidak dikerjakan. Kursor keyset
 *  pada (created_at, id_order) tidak bisa melewatkan baris.
 *
 *  Scroll tak hingga dilarang di seluruh dashboard karena alasan yang sama,
 *  ditambah satu lagi: ia tidak punya akhir, jadi "sudah saya periksa semua"
 *  tidak pernah bisa dikatakan. */
export async function getOrdersPage(
  cafeId: string | null,
  tab: OrderTab,
  cursor: string | null
): Promise<OrdersPage> {
  if (!cafeId) return { ...EMPTY, error: "Kafe belum terhubung ke akun ini." };

  const statuses = statusesForTab(tab);
  const parsedCursor = cursor ? parseCursor(cursor) : null;

  let query = supabaseAdmin
    .from("Orders")
    .select(
      "id_order,table_number,items,total,subtotal,tax_pct,tax_amount,service_pct,service_amount,status,payment_method,payment_status,created_at,notes,cancelled_reason"
    )
    .eq("cafe_id", cafeId)
    .order("created_at", { ascending: false })
    .order("id_order", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (statuses) query = query.in("status", statuses);
  if (parsedCursor) {
    // Keyset majemuk dalam SATU ekspresi or(): created_at < X ATAU
    // (created_at = X DAN id_order < Y). Nilai dikutip agar karakter timestamp
    // aman dari parser PostgREST.
    const q = `"${parsedCursor.createdAt}"`;
    query = query.or(
      `created_at.lt.${q},and(created_at.eq.${q},id_order.lt."${parsedCursor.idOrder}")`
    );
  }

  // Agregasi counts + total dipindah ke Postgres (orders_dashboard_summary).
  // Sebelumnya dua full scan Orders (semua total,status + semua status) dibawa
  // ke Node; RPC ini mengembalikan lima angka dalam satu roundtrip.
  const [pageResult, summaryResult] = await Promise.all([
    query,
    supabaseAdmin.rpc("orders_dashboard_summary", {
      p_cafe_id: cafeId,
      p_statuses: statuses ?? null,
    }),
  ]);

  if (pageResult.error) return { ...EMPTY, error: pageResult.error.message };

  const fetched = (pageResult.data ?? []) as OrderRowV2[];
  const hasMore = fetched.length > PAGE_SIZE;
  const rows = hasMore ? fetched.slice(0, PAGE_SIZE) : fetched;

  const summary = (summaryResult.data ?? {}) as Record<string, unknown>;
  const counts: Record<OrderTab, number> = {
    semua: Number(summary.count_all ?? 0),
    berjalan: Number(summary.count_running ?? 0),
    dibatalkan: Number(summary.count_cancelled ?? 0),
  };

  const filteredCount = Number(summary.filtered_count ?? 0);
  const filteredTotal = Number(summary.filtered_total ?? 0);
  const from = cursor ? null : 1;

  return {
    rows,
    filteredCount,
    filteredTotal,
    counts,
    nextCursor: hasMore && rows[rows.length - 1]
      ? encodeCursor(rows[rows.length - 1])
      : null,
    offsetLabel: from === null ? null : { from, to: rows.length },
    error: summaryResult.error ? summaryResult.error.message : null,
  };
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
