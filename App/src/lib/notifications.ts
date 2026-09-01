import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  DEFAULT_NOTIF_SETTINGS,
  isChannelOn,
  normalizeNotifSettings,
  type NotifEventType,
} from "@/lib/notification-settings";

/** Pusat notifikasi ala template (bell + panel bertab).
 *  Sumber: tabel `Notifications` per kafe. Event nyata yang menulis baris:
 *  - commit_order_atomic (order baru) -> tipe `order` di_insert by DB trigger? TIDAK —
 *    RPC ringan ini hanya mencatat; pemanggilnya: API orders (commit), payment
 *    (cash paid / qris paid), dan dapur (status siap).
 *
 *  Fungsi write: createNotifications(cafeId, event, entries). Event dikunci
 *  ke satu `NotifEventType` dan difilter preferensi kafe — kalau kafe
 *  mematikan in_app untuk event itu di Pengaturan → Notifications, baris
 *  tidak ditulis sama sekali (bukan sekadar disembunyikan). */

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

/** Tulis notifikasi in-app untuk satu event operasional, hormati preferensi
 *  kafe (matriks Pengaturan → Notifications). Preferensi rusak/NULL =
 *  normalizeNotifSettings = default (in_app menyala utk semua event) —
 *  jadi tidak ada backfill dan tidak ada notifikasi yang hilang diam-diam. */
export async function createNotifications(
  cafeId: string,
  event: NotifEventType,
  entries: Array<{ type: NotifType; title: string; body?: string; href?: string }>,
): Promise<void> {
  if (entries.length === 0) return;

  // Preferensi gagal dibaca (DB gladi, mock test, dsb.) = default — jalan
  // notifikasi tidak boleh mati karena pembacaan preferensi bermasalah.
  let settings = DEFAULT_NOTIF_SETTINGS;
  try {
    const { data } = await supabaseAdmin
      .from("Cafes")
      .select("notification_settings")
      .eq("id_cafe", cafeId)
      .maybeSingle();
    settings = normalizeNotifSettings(data?.notification_settings);
  } catch {
    /* pakai default */
  }
  if (!isChannelOn(settings, event, "in_app")) return;

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
