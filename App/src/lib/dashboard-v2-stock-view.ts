import type { InventoryUnit } from "@/types";

/** Helper VIEW stok — murni, tanpa akses database.
 *
 *  Dipisahkan dari `dashboard-v2-stock.ts` (server, membawa supabaseAdmin)
 *  supaya `StockTable` (client component) bisa memakai tipe dan penghitung yang
 *  sama tanpa menarik service-role client ke dalam bundle browser. */

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
