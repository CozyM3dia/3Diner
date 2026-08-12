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
  // ── Pajak & service charge (K4: satu-satunya pengaturan tanpa default diam) ──
  tax_rate_pct?: number
  service_charge_pct?: number
  prices_include_tax?: boolean
  /** null = belum pernah diatur. Struk tetap mencetak baris pajak 0%, tapi
   *  dashboard menandainya sebagai "perlu dilengkapi". */
  tax_configured_at?: string | null
  /** Perubahan tarif berlaku terjadwal, tidak seketika: dua pesanan di hari
   *  yang sama tidak boleh punya perhitungan berbeda. */
  tax_pending_rate_pct?: number | null
  tax_pending_service_pct?: number | null
  tax_pending_include?: boolean | null
  tax_pending_from?: string | null
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
  /** Permintaan tamu untuk baris ini saja — "tanpa gula", "pedas sedang".
   *  Berbeda dari `Order.notes` yang berlaku untuk seluruh pesanan. Dua baris
   *  menu yang sama dengan catatan berbeda tidak boleh digabung. */
  notes?: string | null
}

/** Kunci baris kanonik. Urutan pilihan pelanggan tidak boleh menghasilkan dua
 *  baris berbeda, jadi id varian selalu diurutkan lebih dulu. Bentuknya harus
 *  sama dengan yang dipakai `create_order_with_inventory` di database.
 *
 *  Catatan per item ikut jadi bagian kunci dan ditaruh paling belakang: tanpa
 *  itu "Kopi tanpa gula" dan "Kopi biasa" jadi satu baris qty 2 dengan satu
 *  catatan, dan salah satu tamu menerima minuman yang salah. Karena ia ruas
 *  terakhir, tanda baca di dalamnya tidak bisa menabrak batas ruas. */
export function cartLineKey(
  idMenu: string,
  optionIds: string[],
  notes?: string | null,
): string {
  const trimmed = (notes ?? "").trim().slice(0, 140)
  return `${idMenu}:${[...new Set(optionIds)].sort().join(",")}:${trimmed}`
}

export type PaymentMethod = 'cash' | 'qris' | 'gopay' | 'shopeepay' | 'bank_transfer'
export type PaymentStatus = 'unpaid' | 'awaiting_payment' | 'awaiting_checkin' | 'pending' | 'paid'

/** Siklus hidup pesanan.
 *
 *  `completed` dan `cancelled` adalah terminal — pesanan keluar dari antrean
 *  kasir hanya lewat keduanya. Sebelum ini `ready` adalah akhir, sehingga
 *  antrean tidak pernah bisa mencapai nol.
 *
 *  `ready` dipertahankan sebagai tahap opsional untuk kafe yang punya runner
 *  terpisah (K1). Konsol Kasir default melompatinya: Masuk → Disiapkan → Selesai. */
export type OrderStatus =
  | 'awaiting'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'

export const TERMINAL_ORDER_STATUSES = ['completed', 'cancelled'] as const
export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number]

export function isOrderOpen(status: OrderStatus): boolean {
  return status !== 'completed' && status !== 'cancelled'
}

/** Baris pesanan sebagaimana disimpan database. Tidak punya `line_key` —
 *  penggabungan baris sudah selesai saat pesanan dibuat. */
export interface OrderItem {
  id_menu: string
  nama_menu: string
  harga_menu: number
  qty: number
  options?: SelectedOption[]
  image_url?: string | null
  /** Catatan untuk baris ini saja, dibawa dari `CartItem.notes`. */
  notes?: string | null
}

export interface Order {
  id_order: string
  cafe_id: string
  cafe_slug: string
  cafe_name: string
  table_number: string
  items: OrderItem[]
  /** Jumlah harga baris sebelum layanan dan pajak. */
  subtotal: number
  /** Tarif dipotret saat pesanan dibuat. Mengubah tarif kafe tidak boleh
   *  menulis ulang sejarah — laporan bulan lalu harus tetap bisa direkonsiliasi. */
  tax_pct: number
  tax_amount: number
  service_pct: number
  service_amount: number
  prices_include_tax: boolean
  /** Yang dibayar tamu. Sudah termasuk layanan dan pajak. */
  total: number
  status: OrderStatus
  payment_method: PaymentMethod | null
  payment_status: PaymentStatus
  /** URL gambar QRIS dinamis untuk order yang sedang menunggu pembayaran. */
  payment_qr_url?: string | null
  created_at: string
  completed_at?: string | null
  cancelled_at?: string | null
  /** Wajib terisi kalau status `cancelled` — ditegakkan constraint database.
   *  Pembatalan tanpa alasan tidak bisa diaudit. */
  cancelled_reason?: string | null
  cancelled_by?: string | null
  notes?: string | null
  customer_token?: string
  /** Kode check-in 8 karakter untuk pesanan bayar-di-kasir (`awaiting_checkin`).
   *  Null untuk pesanan online. Ditunjukkan tamu ke kasir bersama QR. */
  checkin_code?: string | null
}

// ── Staf & peran (memisahkan Konsol Kasir dari Konsol Owner) ──

export const STAFF_ROLES = ['owner', 'cashier'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export interface Staff {
  id_staff: string
  cafe_id: string
  user_id: string
  full_name: string
  role: StaffRole
  is_active: boolean
  created_at: string
  updated_at?: string | null
}

/** Hasil `get_staff_context()`. `role` null berarti user terautentikasi tapi
 *  tidak terdaftar sebagai staf kafe mana pun — beda dari gagal memuat. */
export interface StaffContext {
  cafe_id?: string
  cafe_name?: string
  cafe_slug?: string
  user_id?: string
  full_name?: string
  role: StaffRole | null
  is_active?: boolean
}

/** Tujuan setelah login ditentukan peran, bukan pilihan di layar masuk.
 *  Pemilih peran di layar login adalah pertanyaan yang jawabannya sudah
 *  dimiliki sistem, dan setiap salah pilih jadi tiket dukungan. */
export function homeRouteForRole(role: StaffRole | null): string | null {
  if (role === 'owner') return '/dashboard'
  if (role === 'cashier') return '/kasir'
  return null
}

// ── Pajak & service charge per kafe ──

export interface TaxSettings {
  tax_pct: number
  service_pct: number
  /** Harga menu sudah termasuk pajak; pajak diekstrak, bukan ditambahkan. */
  include: boolean
  /** `false` = pemilik belum pernah memutuskan. Nol yang dipilih dan nol yang
   *  kebetulan harus bisa dibedakan; hanya yang pertama boleh dicetak diam. */
  configured: boolean
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
