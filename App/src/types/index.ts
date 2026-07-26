export type SubscriptionType = 'Tier 50k' | 'Tier 100k' | 'Tier 150k'

export interface Cafe {
  id_cafe: string
  nama_cafe: string
  alamat_cafe: string
  slug_url: string
  qr_token_customer: string
  subscription_type: SubscriptionType
  status_lunas: boolean
  created_at: string
  // ── Jatah AI image-to-3D & ekstraksi menu (reset per bulan kalender) ──
  ai_credits_quota?: number
  ai_credits_used?: number
  ai_credits_period_start?: string
  // ── Branding per-cafe (opsional) ──
  logo_url?: string | null
  cover_url?: string | null
  greeting?: string | null
  brand_color?: string | null
  // ── External links ──
  google_maps_review_url?: string | null
}

export interface Menu {
  id_menu: string
  cafe_id: string
  nama_menu: string
  harga_menu: number
  description_menu: string | null
  model_3d_url: string
  redirect_link: string
  created_at: string
  // ── Visual + grouping ──
  image_url?: string | null
  category?: string | null
  usdz_url?: string | null
  // ── Detail info ──
  prep_time_minutes?: number | null
  calories?: number | null
  ingredients?: string | null   // comma-separated, e.g. "Pasta, Daging Sapi, Saus Tomat"
  // ── Availability & scheduling ──
  is_active?: boolean
  discount_pct?: number | null
  schedule_days?: string | null   // comma ISO weekday nums "1,2,3" (1=Mon..7=Sun)
  schedule_start?: string | null  // "HH:MM"
  schedule_end?: string | null    // "HH:MM"
  // ── Display order (dashboard drag-to-reorder) ──
  sort_order?: number | null
  // ── Default 3D model scale set by admin (multiplier, base for viewer/AR) ──
  model_scale?: number | null
}

export interface Announcement {
  id: string
  cafe_id: string
  message: string
  bg_color: string
  type?: "info" | "promo" | "event" | "warning"
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface AnalyticsLog {
  id_log: string
  cafe_id: string
  menu_id: string
  event_type: 'click_menu' | 'view_3d' | 'click_order'
  duration: number
  created_at: string
}

// ── Varian & add-on menu ──

/** Satu grup pilihan pada sebuah menu, mis. "Ukuran" atau "Level Gula".
 *  `max_select` = 1 berarti pilihan tunggal (radio); > 1 berarti ganda (checkbox).
 *  `min_select` = 0 berarti grup opsional. */
export interface MenuOptionGroup {
  id_option_group: string
  cafe_id: string
  menu_id: string
  name: string
  min_select: number
  max_select: number
  sort_order: number
  values?: MenuOptionValue[]
}

export interface MenuOptionValue {
  id_option_value: string
  cafe_id: string
  option_group_id: string
  name: string
  /** Selisih harga per unit dalam rupiah. Boleh negatif (mis. ukuran kecil). */
  price_delta: number
  is_active: boolean
  sort_order: number
  recipes?: MenuOptionRecipe[]
}

export interface MenuOptionRecipe {
  id_option_recipe?: string
  cafe_id?: string
  option_value_id?: string
  inventory_item_id: string
  qty_per_menu: number
  inventory_item?: Pick<InventoryItem, "name" | "unit">
}

/** Varian yang sudah dipilih, dibekukan ke dalam baris pesanan. Nama dan
 *  selisih harga disalin supaya riwayat pesanan tidak berubah saat menu diedit. */
export interface SelectedOption {
  id_option_value: string
  group_name: string
  name: string
  price_delta: number
}

// ── In-app ordering (v2 pivot) ──
export interface CartItem {
  /** Identitas baris keranjang: menu + himpunan varian terpilih. Dua baris menu
   *  yang sama dengan varian berbeda adalah dua baris terpisah. */
  line_key: string
  id_menu: string
  nama_menu: string
  /** Harga satuan sudah termasuk seluruh price_delta varian terpilih. */
  harga_menu: number
  image_url?: string | null
  qty: number
  options?: SelectedOption[]
}

/** Kunci baris kanonik. Urutan pilihan pelanggan tidak boleh menghasilkan dua
 *  baris berbeda, jadi id varian selalu diurutkan lebih dulu. Bentuknya harus
 *  sama dengan yang dipakai `create_order_with_inventory` di database. */
export function cartLineKey(idMenu: string, optionIds: string[]): string {
  return `${idMenu}:${[...new Set(optionIds)].sort().join(",")}`
}

export type PaymentMethod = 'cash' | 'qris'
export type PaymentStatus = 'unpaid' | 'pending' | 'paid'
export type OrderStatus = 'received' | 'preparing' | 'ready'

/** Baris pesanan sebagaimana disimpan database. Tidak punya `line_key` —
 *  penggabungan baris sudah selesai saat pesanan dibuat. */
export interface OrderItem {
  id_menu: string
  nama_menu: string
  harga_menu: number
  qty: number
  options?: SelectedOption[]
  image_url?: string | null
}

export interface Order {
  id_order: string
  cafe_id: string
  cafe_slug: string
  cafe_name: string
  table_number: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  payment_method: PaymentMethod | null
  payment_status: PaymentStatus
  created_at: string
  notes?: string | null
  customer_token?: string
}

export const INVENTORY_UNITS = ["gram", "kg", "ml", "liter", "pcs", "pack", "botol"] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export type InventoryStatus = "safe" | "low" | "empty";

export interface InventoryItem {
  id_inventory_item: string;
  cafe_id: string;
  name: string;
  unit: InventoryUnit;
  current_qty: number;
  minimum_qty: number;
  estimated_unit_cost: number;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MenuRecipe {
  id_menu_recipe: string;
  cafe_id: string;
  menu_id: string;
  inventory_item_id: string;
  qty_per_menu: number;
  created_at: string;
  updated_at?: string;
  inventory_item?: InventoryItem;
}

export type InventoryMovementType =
  | "manual_add"
  | "manual_subtract"
  | "manual_set"
  | "order_deduction";

export interface InventoryMovement {
  id_inventory_movement: string;
  cafe_id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  delta_qty: number;
  qty_before: number;
  qty_after: number;
  unit: InventoryUnit;
  unit_cost?: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
  note?: string | null;
  created_at: string;
  inventory_item?: Pick<InventoryItem, "name" | "unit">;
}
