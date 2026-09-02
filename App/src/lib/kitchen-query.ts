import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";
import type { TiketDapur } from "@/lib/kitchen-model";
import type { OrderStatus } from "@/types";

/** Status yang masih jadi urusan dapur.
 *
 *  `awaiting` ikut ditarik walau dapur belum boleh mengerjakannya: pesanan
 *  yang macet menunggu check-in di kasir adalah pekerjaan yang tidak berjalan,
 *  dan menyembunyikannya dari papan berarti tidak ada seorang pun yang
 *  melihatnya macet. `completed` dan `cancelled` sudah lepas dari dapur. */
const STATUS_DAPUR: OrderStatus[] = ["awaiting", "received", "preparing", "ready"];

/** Jendela 30 hari, sama seperti halaman Pesanan: pesanan yang belum ditutup
 *  tetap pesanan terbuka walau dibuat kemarin, dan menyaring ke "hari ini"
 *  membuat papan ini kosong terus padahal antreannya nyata. */
const HARI = 30;

/** Muatan awal papan dapur.
 *
 *  Dipakai kedua rute — /dapur di perangkat dapur dan /dashboard-v2/dapur di
 *  konsol. Indeks parsial `Orders_cafe_open_idx` (cafe_id, created_at) WHERE
 *  status IN (awaiting, received, preparing, ready) harus mencakup awaiting:
 *  tiket macet di kasir tetap tampil. Satu SELECT, tanpa N+1. */
export async function ambilTiketDapur(cafeId: string): Promise<TiketDapur[]> {
  if (!cafeId) return [];

  const sejak = new Date(new Date(startOfTodayWIB()).getTime() - (HARI - 1) * 864e5).toISOString();

  const { data } = await supabaseAdmin
    .from("Orders")
    .select("id_order,created_at,status,payment_status,table_number,notes,items")
    .eq("cafe_id", cafeId)
    .in("status", STATUS_DAPUR)
    .gte("created_at", sejak)
    .order("created_at", { ascending: true })
    .limit(60);

  return (data ?? []).map(o => ({
    id_order: o.id_order,
    created_at: o.created_at,
    status: (o.status as OrderStatus) ?? "awaiting",
    payment_status: o.payment_status ?? "unpaid",
    table_number: o.table_number,
    notes: o.notes,
    items: Array.isArray(o.items) ? o.items : [],
  }));
}
