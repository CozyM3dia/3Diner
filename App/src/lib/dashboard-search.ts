"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStaffCafeId } from "@/lib/staff-context";

/** Global search ala modal "Search" Dream POS — tab Orders & Kitchen saja
 *  (tab Customer template tidak dipakai: 3Diner tidak punya entitas customer).
 *  Semua query terkunci ke cafe sesi login (getStaffCafeId), bukan RLS. */

export interface SearchOrderRow {
  id_order: string;
  table_number: string | null;
  total: number | null;
  status: string | null;
  payment_status: string | null;
  created_at: string;
}

export interface SearchMenuRow {
  id_menu: string;
  nama_menu: string;
  harga_menu: number;
  discount_pct: number | null;
  image_url: string | null;
  category: string | null;
  is_active: boolean | null;
}

export interface SearchResults {
  orders: SearchOrderRow[];
  menus: SearchMenuRow[];
}

const EMPTY: SearchResults = { orders: [], menus: [] };

/** Whitelist karakter untuk pola ILIKE — mencegel injeksi sintaks `.or()`
 *  (koma, kurung, %, _) sekaligus membatasi panjang. */
function sanitizeNeedle(raw: string): string {
  return raw
    .trim()
    .slice(0, 60)
    .replace(/[^\p{L}\p{N}#\- ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchDashboard(
  q: string,
  scope: "orders" | "kitchen",
): Promise<SearchResults> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return EMPTY;
  const needle = sanitizeNeedle(q);
  if (!needle) return EMPTY;
  // Wildcard ILIKE di dalam `.or()` PostgREST adalah `*` (bukan `%` — terverifikasi
  // empiris: `%x%` di dalam or() dikembalikan sebagai literal → hasil kosong).
  const like = `*${needle}*`;

  if (scope === "orders") {
    // Cocokkan nomor pesanan (prefix hex-nya), nomor meja, atau catatan.
    const { data } = await supabaseAdmin
      .from("Orders")
      .select("id_order,table_number,total,status,payment_status,created_at")
      .eq("cafe_id", cafeId)
      .or(`id_order.ilike.${like},table_number.ilike.${like},notes.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(8);
    return { ...EMPTY, orders: (data ?? []) as SearchOrderRow[] };
  }

  // Kitchen: katalog menu (aktif & nonaktif — nonaktif ditandai di UI).
  const { data } = await supabaseAdmin
    .from("Menus")
    .select("id_menu,nama_menu,harga_menu,discount_pct,image_url,category,is_active")
    .eq("cafe_id", cafeId)
    .or(`nama_menu.ilike.${like},category.ilike.${like}`)
    .order("nama_menu", { ascending: true })
    .limit(8);
  return { ...EMPTY, menus: (data ?? []) as SearchMenuRow[] };
}
