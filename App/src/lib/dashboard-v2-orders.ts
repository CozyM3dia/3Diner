import { supabaseAdmin } from "@/lib/supabase-admin";
import type { OrdersPage, OrderRowV2, OrderTab } from "@/lib/dashboard-v2-orders-view";
import { PAGE_SIZE, encodeCursor, statusesForTab } from "@/lib/dashboard-v2-orders-view";

/** Lapisan DATA riwayat pesanan (server-only lewat supabaseAdmin).
 *
 *  Helper view/tipe/pemformat hidup di `dashboard-v2-orders-view.ts` yang
 *  aman dipakai komponen klien; modul ini hanya berisi query. Re-export di
 *  bawah menjaga impor lama tetap hidup untuk kode server. */
export {
  ORDER_TABS,
  TAB_LABEL,
  parseTab,
  statusesForTab,
  PAGE_SIZE,
  encodeCursor,
  summarizeItems,
  STATUS_TEXT,
  describePayment,
} from "@/lib/dashboard-v2-orders-view";
export type { OrderTab, OrderRowV2, OrdersPage } from "@/lib/dashboard-v2-orders-view";

const EMPTY: OrdersPage = {
  rows: [],
  filteredCount: 0,
  filteredTotal: 0,
  counts: { semua: 0, berjalan: 0, dibatalkan: 0 },
  nextCursor: null,
  offsetLabel: null,
  error: null,
};

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
