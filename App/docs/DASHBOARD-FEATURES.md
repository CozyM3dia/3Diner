# 3Diner — Dokumentasi Fitur Dashboard

Dokumentasi lengkap seluruh fitur admin dashboard 3Diner. Dashboard adalah pusat kontrol pemilik kafe untuk memantau performa, mengelola menu, menerima pesanan, dan mengatur tampilan menu pelanggan.

- **URL produksi:** https://3diner.vercel.app/dashboard
- **Login:** https://3diner.vercel.app/login
- **Tema:** dark mode, brand 3Diner (navy + oranye `#FD5002` + teal `#00C2A8`)
- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase

---

## 0. Autentikasi & Akses

| Aspek | Detail |
|---|---|
| Login | Email + password (Supabase Auth) di `/login` |
| Proteksi | `middleware.ts` — semua `/dashboard/*` redirect ke `/login` kalau belum login |
| Multi-tenant | Kafe ditautkan ke akun lewat kolom `Cafes.owner_id` = auth user id |
| Logout | Tombol "Keluar" di bawah sidebar |
| Sesi | Cookie-based (Supabase SSR), auto-refresh via middleware |
| Performa | `getSessionUserId` + `getOwnerCafeSlug` di-`cache()` (React) — layout & page dedupe jadi 1 query auth/slug per request |

**File:** `src/app/login/page.tsx`, `src/middleware.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`

---

## 1. Shell & Navigasi

Sidebar kiri (desktop) / drawer (mobile) + area konten. Tiap navigasi tampil **skeleton instan** (`loading.tsx`) sebelum data siap.

| Menu | Route | Ikon |
|---|---|---|
| Analitik | `/dashboard` | BarChart3 |
| Penjualan | `/dashboard/revenue` | Wallet |
| Pesanan | `/dashboard/orders` | ShoppingBag |
| Menu | `/dashboard/menu` | UtensilsCrossed |
| Pengumuman | `/dashboard/announcements` | Megaphone |
| Jadwal & Diskon | `/dashboard/scheduler` | CalendarClock |
| Pengaturan | `/dashboard/settings` | Settings |

- "Lihat Menu" → buka halaman pelanggan di tab baru
- Responsif: desktop sidebar fixed 240px; mobile hamburger → drawer slide-in
- Nav aktif oranye, hover bg-slide

**File:** `src/components/dashboard/DashboardShell.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/loading.tsx`

---

## 2. Analitik (`/dashboard`)

Engagement 14 hari terakhir dari `Analytics_Logs`. Semua chart pure-SVG, animate-in, **data 100% asli** (tidak ada angka hardcoded). Query di-filter `gte(created_at, 14d)`.

### 2.1 Hero + Insight otomatis
- Header: total interaksi + rata-rata/hari + **saran aksi** kontekstual (mis. "Trafik memuncak jam 14.00, jadwalkan promo di sekitar jam itu")
- Strip insight (scrollable): **Jam tersibuk**, **Hari teramai**, **Menu paling dilirik**, **Konversi terbaik** — semua dihitung dari log

### 2.2 Kartu Statistik (4)
Angka count-up + delta minggu-ke-minggu: Tampilan Menu, Lihat 3D, Mulai Pesan, Konversi ke Pesan (%).

### 2.3 Aktivitas Harian
Line chart 14 hari — bezier halus, area gradient, garis menggambar diri, hover tooltip.

### 2.4 Corong Engagement
3 tahap (Buka Menu → Lihat 3D → Mulai Pesan) + drop-off % + ringkasan kalimat.

### 2.5 Jam Tersibuk (Heatmap)
24 sel per jam, intensitas warna, jam puncak di-outline, hover detail.

### 2.6 Per Hari (Weekday)
Bar Sen–Min, hari teramai di-highlight oranye.

### 2.7 Komposisi Interaksi
Donut proporsi 3 tipe event + legend.

### 2.8 Menu Terpopuler
Top 6: ranking, micro-bar views, views + orders.

### 2.9 Aktivitas Terbaru
Feed 8 event terakhir + waktu relatif.

**File:** `src/app/dashboard/page.tsx`, `src/lib/analytics.ts`
**Komponen:** `LineChart`, `DonutChart`, `HeatmapGrid`, `WeekdayBars`, `StatCard`, `FunnelBars`

---

## 3. Penjualan (`/dashboard/revenue`)

Analitik pendapatan 14 hari dari tabel `Orders` (terinspirasi 4D Revenue Analytics).

| Bagian | Detail |
|---|---|
| Stat (4) | Total Pendapatan (Rp + delta), Jumlah Pesanan, Rata-rata/Pesanan (AOV), Item Terjual |
| Pendapatan Harian | Bar chart rupiah 14 hari (animate, hover) |
| Status Pesanan | Donut: Baru / Diproses / Siap |
| Menu Penyumbang Pendapatan | Top 6 by revenue + qty |
| Pesanan Terbaru | 8 order terakhir + waktu relatif |

**File:** `src/app/dashboard/revenue/page.tsx`, `src/components/dashboard/RevenueChart.tsx`, `src/lib/analytics.ts` (`getRevenueData`)

---

## 4. Pesanan (`/dashboard/orders`)

Manajemen pesanan **real-time**.

| Fitur | Detail |
|---|---|
| Real-time | Supabase Realtime channel — pesanan baru/update tanpa refresh |
| Filter tab | Semua / Baru / Diproses / Siap (+ jumlah) |
| Kartu | Meja, kode order, waktu, item+qty+harga, total |
| Alur status | `received` → `preparing` → `ready` (optimistic UI) |

Warna: Baru (oranye), Diproses (kuning), Siap (teal).

**File:** `src/app/dashboard/orders/page.tsx`, `src/components/dashboard/OrdersClient.tsx` · Tabel `Orders` (RLS + realtime)

---

## 5. Menu (`/dashboard/menu`)

CRUD penuh.

### 5.1 Daftar
Tabel: foto, nama, kategori, harga, badge 3D, status, Edit. Empty state.

### 5.2 Form Tambah/Edit (`MenuForm`)
- **Dasar:** nama*, harga*, kategori, deskripsi, waktu saji, kalori, bahan
- **Media & 3D — UPLOAD FILE (drag-and-drop):**
  - Foto menu → preview thumbnail
  - Model 3D `.glb` → chip nama file
  - Model iOS `.usdz` → chip nama file
  - Upload langsung ke Supabase Storage (bucket `menu-media`, publik), maks 30MB, tombol Ganti/Hapus
- **Ketersediaan:** toggle tampil, diskon %, hari tersedia, jam mulai–selesai
- Link pesan (opsional, URL eksternal)

**Route:** `menu/new`, `menu/[id]/edit` (+ hapus dengan konfirmasi)
**File:** `MenuForm.tsx`, `FileUpload.tsx`, action `uploadMenuMedia`

---

## 6. Pengumuman (`/dashboard/announcements`)

Banner real-time di atas halaman menu pelanggan.

| Fitur | Detail |
|---|---|
| Pesan | Maks 120 char + counter |
| Warna | 5 preset |
| Pratinjau live | Render real-time saat mengetik |
| Toggle aktif | On = banner muncul di halaman kafe |

**File:** `announcements/page.tsx`, `AnnouncementForm.tsx`, `AnnouncementBanner.tsx` (customer) · Tabel `Announcements`

---

## 7. Jadwal & Diskon (`/dashboard/scheduler`)

Atur ketersediaan + diskon tiap menu inline per baris.

| Kontrol | Detail |
|---|---|
| Toggle aktif | Tampil/sembunyi dari menu pelanggan |
| Diskon % | 0–100, harga dicoret di sisi pelanggan |
| Hari aktif | Sen–Min (kosong = setiap hari) |
| Jam tayang | Mulai–selesai (support lewat tengah malam) |

Menu di luar jadwal/nonaktif **otomatis hilang** dari menu pelanggan (`isMenuAvailableNow`); diskon diterapkan ke kartu, detail, keranjang (`effectivePrice`).

**File:** `scheduler/page.tsx`, `SchedulerClient.tsx`, `src/lib/menu-availability.ts`

---

## 8. Pengaturan Kafe (`/dashboard/settings`)

**Identitas:** nama*, alamat, sapaan/tagline
**Tampilan & Tautan:** URL logo, URL cover, URL ulasan Google Maps

**File:** `settings/page.tsx`, `SettingsForm.tsx`

---

## 9. Sinkronisasi Dashboard ↔ App Pelanggan

| Aksi dashboard | Efek di halaman pelanggan |
|---|---|
| Menu nonaktif / di luar jadwal | Hilang dari daftar |
| Set diskon % | Harga dicoret + harga diskon di kartu, detail, keranjang |
| Aktifkan pengumuman | Banner muncul di atas halaman kafe |
| Edit profil kafe | Nama/logo/cover/tagline/ulasan berubah |
| Upload foto/3D menu | Langsung tampil di menu + viewer 3D/AR |

---

## 10. Desain & Interaksi

| Aspek | Detail |
|---|---|
| Tema | Dark — BG `#060E1B`, surface `#0D1829`, surface-2 `#132136`, teks `#E9EEF6`, muted `#5A7898`, aksen `#FD5002` + teal `#00C2A8` |
| Press feedback | `.dash-press` / `.dash-btn` — scale-down tiap klik |
| Hover | `.dash-nav`, `.dash-row`, `.dash-card` |
| Focus ring | `.dash-input` — ring oranye |
| Reveal | `.dash-reveal` staggered section entrance |
| Loading | `.dash-skel` shimmer + `loading.tsx` |
| Motion | Emil-restraint: <200ms, ease-out, no bounce, hormati `prefers-reduced-motion` |

**File:** `src/app/globals.css` (layer `.dash-*`)

---

## 11. Skema Database

| Tabel | Kolom |
|---|---|
| `Cafes` | `id_cafe`, `owner_id`, `nama_cafe`, `alamat_cafe`, `greeting`, `logo_url`, `cover_url`, `google_maps_review_url` |
| `Menus` | + `prep_time_minutes`, `calories`, `ingredients`, `is_active`, `discount_pct`, `schedule_days/start/end` |
| `Analytics_Logs` | `cafe_id`, `menu_id`, `event_type` (`click_menu`/`view_3d`/`click_order`), `created_at` |
| `Orders` | `id_order`, `cafe_id`, `table_number`, `items` jsonb, `total`, `status`, `payment_*`, `created_at` |
| `Announcements` | `id`, `cafe_id`, `message`, `bg_color`, `is_active`, `updated_at` |
| Storage | bucket `menu-media` (publik) — foto, .glb, .usdz |

**Migrasi:** `scripts/dashboard-migration.sql`, `migrate-menu-detail-fields.sql`, `add-gmaps-review.sql`, `orders-table.sql`

---

## 12. Server Actions

Semua mutasi lewat server actions dengan guard auth (`getAuthCafeId`) — selalu discope ke kafe milik user.

| Action | Fungsi |
|---|---|
| `createMenu` / `updateMenu` / `deleteMenu` | CRUD menu |
| `setMenuAvailability` | Toggle aktif, diskon, jadwal |
| `uploadMenuMedia` | Upload foto/3D ke Storage → return URL publik |
| `updateCafeSettings` | Simpan profil kafe |
| `saveAnnouncement` | Buat/update pengumuman |
| `updateOrderStatus` | Ubah status pesanan |

**File:** `src/lib/dashboard-actions.ts`

---

## Ringkasan Cakupan

✅ Login & auth multi-tenant (cached, cepat)
✅ Analitik visual + insight otomatis bahasa awam
✅ Penjualan / revenue analytics dari Orders
✅ Pesanan real-time + alur status
✅ Menu CRUD + **upload file drag-and-drop** (foto/glb/usdz)
✅ Pengumuman banner real-time
✅ Jadwal tayang + diskon otomatis
✅ Pengaturan kafe
✅ Sinkron penuh dashboard ↔ app
✅ Loading skeleton + animasi + interaksi (shadcn-grade + impeccable motion)
