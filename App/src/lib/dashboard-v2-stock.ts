import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InventoryUnit } from "@/types";

export const STOCK_TABS = ["menipis", "habis", "semua"] as const;
export type StockTab = (typeof STOCK_TABS)[number];

export const STOCK_TAB_LABEL: Record<StockTab, string> = {
  menipis: "Menipis",
  habis: "Habis",
  semua: "Semua",
};

export function parseStockTab(value: string | undefined): StockTab {
  return STOCK_TABS.includes(value as StockTab) ? (value as StockTab) : "menipis";
}

export interface StockRow {
  id_inventory_item: string;
  name: string;
  unit: InventoryUnit;
  current_qty: number;
  minimum_qty: number;
  /** Berapa menu yang mati kalau bahan ini habis. */
  affectedMenus: number;
}

/** Keadaan bahan, dibawa kata — bukan hanya warna.
 *
 *  Merah-hijau sebagai pembeda utama dilarang, dan baris ini harus tetap terbaca
 *  saat dicetak hitam-putih. */
export type StockLevel = "habis" | "menipis" | "aman";

export function stockLevel(row: Pick<StockRow, "current_qty" | "minimum_qty">): StockLevel {
  if (row.current_qty <= 0) return "habis";
  if (row.current_qty <= row.minimum_qty) return "menipis";
  return "aman";
}

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  habis: "Habis",
  menipis: "Menipis",
  aman: "Aman",
};

/** Urutan default: paling mendesak lebih dulu.
 *
 *  Bukan abjad. Abjad menyembunyikan hal yang mendesak di huruf Z, dan daftar
 *  bahan dibuka justru untuk menemukan yang mendesak. Rasio dipakai, bukan
 *  selisih: sisa 1 dari minimum 2 lebih genting daripada sisa 8 dari minimum 10,
 *  walau selisihnya sama-sama membuatnya lewat ambang.
 *
 *  Saat rasionya seri, bahan yang mematikan lebih banyak menu naik lebih dulu. */
export function sortByUrgency(rows: StockRow[]): StockRow[] {
  const ratio = (r: StockRow) => (r.minimum_qty <= 0 ? (r.current_qty <= 0 ? 0 : 99) : r.current_qty / r.minimum_qty);
  return [...rows].sort((a, b) => {
    const d = ratio(a) - ratio(b);
    if (d !== 0) return d;
    if (b.affectedMenus !== a.affectedMenus) return b.affectedMenus - a.affectedMenus;
    return a.name.localeCompare(b.name, "id");
  });
}

export function filterByTab(rows: StockRow[], tab: StockTab): StockRow[] {
  if (tab === "habis") return rows.filter((r) => stockLevel(r) === "habis");
  if (tab === "menipis") return rows.filter((r) => stockLevel(r) !== "aman");
  return rows;
}

export function countsByTab(rows: StockRow[]): Record<StockTab, number> {
  return {
    menipis: rows.filter((r) => stockLevel(r) !== "aman").length,
    habis: rows.filter((r) => stockLevel(r) === "habis").length,
    semua: rows.length,
  };
}

/** Ringkasan kaki tabel.
 *
 *  Menjumlahkan kolom Sisa akan menambahkan kilogram ke liter dan menghasilkan
 *  angka palsu. Yang bisa dijumlahkan dan berarti adalah berapa menu unik yang
 *  terdampak — dan itu juga yang menentukan seberapa mendesak belanjanya. */
export function summarize(rows: StockRow[], menusByItem: Map<string, Set<string>>) {
  const unique = new Set<string>();
  for (const r of rows) {
    for (const m of menusByItem.get(r.id_inventory_item) ?? []) unique.add(m);
  }
  return { itemCount: rows.length, affectedMenus: unique.size };
}

export interface StockPage {
  rows: StockRow[];
  counts: Record<StockTab, number>;
  menusByItem: Map<string, Set<string>>;
  /** Kapan stok terakhir disesuaikan manusia. Angka stok yang tidak menyebut
   *  kapan terakhir disentuh adalah angka yang tidak bisa dipercaya. */
  lastAdjustedAt: string | null;
  error: string | null;
}

export async function getStockPage(cafeId: string | null): Promise<StockPage> {
  const empty: StockPage = {
    rows: [],
    counts: { menipis: 0, habis: 0, semua: 0 },
    menusByItem: new Map(),
    lastAdjustedAt: null,
    error: null,
  };
  if (!cafeId) return { ...empty, error: "Kafe belum terhubung ke akun ini." };

  const [itemsResult, recipesResult, lastMove] = await Promise.all([
    supabaseAdmin
      .from("Inventory_Items")
      .select("id_inventory_item,name,unit,current_qty,minimum_qty")
      .eq("cafe_id", cafeId),
    supabaseAdmin.from("Menu_Recipes").select("menu_id,inventory_item_id").eq("cafe_id", cafeId),
    supabaseAdmin
      .from("Inventory_Movements")
      .select("created_at")
      .eq("cafe_id", cafeId)
      .in("movement_type", ["manual_add", "manual_subtract", "manual_set"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (itemsResult.error) return { ...empty, error: itemsResult.error.message };

  const menusByItem = new Map<string, Set<string>>();
  for (const r of recipesResult.data ?? []) {
    const set = menusByItem.get(r.inventory_item_id) ?? new Set<string>();
    set.add(r.menu_id);
    menusByItem.set(r.inventory_item_id, set);
  }

  const rows: StockRow[] = (itemsResult.data ?? []).map((i) => ({
    id_inventory_item: i.id_inventory_item,
    name: i.name,
    unit: i.unit as InventoryUnit,
    current_qty: Number(i.current_qty),
    minimum_qty: Number(i.minimum_qty),
    affectedMenus: menusByItem.get(i.id_inventory_item)?.size ?? 0,
  }));

  return {
    rows,
    counts: countsByTab(rows),
    menusByItem,
    lastAdjustedAt: lastMove.data?.created_at ?? null,
    error: null,
  };
}

/** Mengurai jumlah yang diketik, atau null kalau bukan angka.
 *
 *  `Number("")` menghasilkan 0, bukan NaN. Tanpa penjaga ini, menekan Simpan
 *  dengan kolom hitungan kosong akan menyetel stok ke NOL — kehilangan diam-diam
 *  yang baru ketahuan saat menu mati sendiri. Koma diterima karena papan ketik
 *  Indonesia menuliskannya begitu. */
export function parseQty(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
