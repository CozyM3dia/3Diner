import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Pusat notifikasi ala template (bell + panel bertab).
 *  Sumber: tabel `Notifications` per kafe. Event nyata yang menulis baris:
 *  - commit_order_atomic (order baru) -> tipe `order` di_insert by DB trigger? TIDAK —
 *    RPC ringan ini hanya mencatat; pemanggilnya: API orders (commit), payment
 *    (cash paid / qris paid), dan dapur (status siap).
 *
 *  Fungsi write: createNotifications(cafeId, entries). Dipanggil dari server
 *  actions / route handlers setelah event operasional terjadi. */

export type NotifType = "order" | "kitchen" | "inbox";

export interface NotifRow {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotifBucket {
  rows: NotifRow[];
  unread: number;
  unreadByType: Record<NotifType, number>;
}

/** Tabel mungkin belum dimigrasi di env lama — gagal = kosong, bukan crash. */
export const getNotifications = cache(async (cafeId: string): Promise<NotifBucket> => {
  const empty: NotifBucket = { rows: [], unread: 0, unreadByType: { order: 0, kitchen: 0, inbox: 0 } };
  const { data, error } = await supabaseAdmin
    .from("Notifications")
    .select("id,type,title,body,href,read_at,created_at")
    .eq("cafe_id", cafeId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return empty;

  const rows = data as unknown as NotifRow[];
  const unreadByType: Record<NotifType, number> = { order: 0, kitchen: 0, inbox: 0 };
  let unread = 0;
  for (const r of rows) {
    if (!r.read_at) {
      unread += 1;
      unreadByType[r.type] = (unreadByType[r.type] ?? 0) + 1;
    }
  }
  return { rows, unread, unreadByType };
});

export async function createNotifications(
  cafeId: string,
  entries: Array<{ type: NotifType; title: string; body?: string; href?: string }>,
): Promise<void> {
  if (entries.length === 0) return;
  await supabaseAdmin.from("Notifications").insert(
    entries.map(e => ({
      cafe_id: cafeId,
      type: e.type,
      title: e.title,
      body: e.body ?? null,
      href: e.href ?? null,
    })),
  );
}
