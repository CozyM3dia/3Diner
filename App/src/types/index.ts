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

// ── In-app ordering (v2 pivot) ──
export interface CartItem {
  id_menu: string
  nama_menu: string
  harga_menu: number
  image_url?: string | null
  qty: number
}

export type PaymentMethod = 'cash' | 'qris'
export type PaymentStatus = 'unpaid' | 'pending' | 'paid'
export type OrderStatus = 'received' | 'preparing' | 'ready'

export interface Order {
  id_order: string
  cafe_id: string
  cafe_slug: string
  cafe_name: string
  table_number: string
  items: CartItem[]
  total: number
  status: OrderStatus
  payment_method: PaymentMethod | null
  payment_status: PaymentStatus
  created_at: string
  notes?: string | null
}
