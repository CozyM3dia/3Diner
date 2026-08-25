/** Helper VIEW menu — murni, tanpa akses database.
 *
 *  Dipisahkan dari `dashboard-v2-menu.ts` (server, membawa supabaseAdmin)
 *  supaya `MenuTableV2` (client component) bisa memakai tipe dan penghitung
 *  yang sama tanpa menarik service-role client ke dalam bundle browser. */

export const MENU_TABS = ["aktif", "nonaktif", "semua"] as const;
export type MenuTab = (typeof MENU_TABS)[number];

export const MENU_TAB_LABEL: Record<MenuTab, string> = {
  aktif: "Aktif",
  nonaktif: "Nonaktif",
  semua: "Semua",
};

export function parseMenuTab(value: string | undefined): MenuTab {
  return MENU_TABS.includes(value as MenuTab) ? (value as MenuTab) : "aktif";
}

export interface MenuRow {
  id_menu: string;
  nama_menu: string;
  category: string | null;
  harga_menu: number;
  discount_pct: number | null;
  is_active: boolean;
  has3d: boolean;
  hasAr: boolean;
  scheduled: boolean;
  /** Bahan yang dipakai resepnya sudah di bawah minimum. */
  outOfStock: boolean;
  /** Tayang untuk tamu SEKARANG, setelah jadwal dan stok ikut dihitung. */
  liveNow: boolean;
  sort_order: number;
}

/** Keadaan model 3D, dengan penyebut siapa pemegang bola.
 *
 *  Hanya dua nilai, dan itu disengaja. Kegagalan pembuatan model tidak disimpan
 *  di mana pun, jadi "Sedang diproses" dan "Gagal, perlu file baru" tidak punya
 *  sumber data — menampilkannya berarti mengarang keadaan. Yang bisa dibuktikan
 *  adalah ada tidaknya berkas modelnya. */
export type ModelState = "siap" | "belum";

export const MODEL_STATE_LABEL: Record<ModelState, string> = {
  siap: "Siap tayang",
  belum: "Belum diunggah",
};

export function modelState(row: Pick<MenuRow, "has3d">): ModelState {
  return row.has3d ? "siap" : "belum";
}

/** Keadaan tayang, sebagai kalimat yang menyebut sebabnya.
 *
 *  "Nonaktif" saja tidak memberi tahu kenapa tamu tidak melihatnya, dan itu
 *  justru pertanyaan yang membawa pemilik ke layar ini. */
export function liveState(row: MenuRow): string {
  if (!row.is_active) return "Dimatikan";
  if (row.outOfStock) return "Bahan habis";
  if (row.scheduled) return row.liveNow ? "Tayang terjadwal" : "Di luar jam tayang";
  return "Tayang";
}

export function filterMenus(rows: MenuRow[], tab: MenuTab): MenuRow[] {
  if (tab === "aktif") return rows.filter((r) => r.is_active);
  if (tab === "nonaktif") return rows.filter((r) => !r.is_active);
  return rows;
}

export function menuCounts(rows: MenuRow[]): Record<MenuTab, number> {
  return {
    aktif: rows.filter((r) => r.is_active).length,
    nonaktif: rows.filter((r) => !r.is_active).length,
    semua: rows.length,
  };
}

/** Urutan menu adalah DATA, bukan preferensi tampilan.
 *
 *  Ini urutan yang tamu lihat di menu, jadi sortir default adalah urutan manual
 *  pemilik. Menyortirnya ulang menurut nama atau harga akan menampilkan sesuatu
 *  yang bukan menu kafe itu. */
export function sortByManualOrder(rows: MenuRow[]): MenuRow[] {
  return [...rows].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.nama_menu.localeCompare(b.nama_menu, "id");
  });
}

export function countCategories(rows: MenuRow[]): number {
  return new Set(rows.map((r) => (r.category ?? "").trim()).filter(Boolean)).size;
}

export interface MenuPage {
  rows: MenuRow[];
  counts: Record<MenuTab, number>;
  categories: number;
  error: string | null;
}
