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
}

export interface AnalyticsLog {
  id_log: string
  cafe_id: string
  menu_id: string
  event_type: 'click_menu' | 'view_3d' | 'click_order'
  duration: number
  created_at: string
}
