# 3Diner — Dokumentasi Fitur Dashboard

Dokumentasi lengkap seluruh fitur admin dashboard 3Diner. Dashboard adalah pusat kontrol pemilik kafe untuk memantau performa, mengelola menu, menerima pesanan, dan mengatur tampilan menu pelanggan.

- **URL produksi:** https://3diner.vercel.app/dashboard
- **Login:** https://3diner.vercel.app/login
- **Tema:** dark mode, brand 3Diner (navy + oranye `#FD5002`)
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

**Alur:** login → middleware verifikasi sesi → `getOwnerCafeSlug(user.id)` cari kafe milik user → semua data dashboard discope ke kafe itu.

**File:** `src/app/login/page.tsx`, `src/middleware.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`

---

## 1. Shell & Navigasi

Kerangka dashboard: sidebar kiri (desktop) / drawer (mobile) + area konten.

**Isi sidebar:**
- Brand: logo kafe + nama kafe + label "Dashboard"
- 6 menu navigasi (lihat di bawah)
- "Lihat Menu" → buka halaman menu pelanggan di tab baru
- "Keluar" → logout

**Responsif:**
- Desktop (≥1024px): sidebar fixed 240px
- Mobile: hamburger → drawer slide-in + overlay
- Nav link: hover bg-slide, state aktif oranye

**File:** `src/components/dashboard/DashboardShell.tsx`, `src/app/dashboard/layout.tsx`

| Menu | Route | Ikon |
|---|---|---|
| Analitik | `/dashboard` | BarChart3 |
| Pesanan | `/dashboard/orders` | ShoppingBag |
| Menu | `/dashboard/menu` | UtensilsCrossed |
| Pengumuman | `/dashboard/announcements` | Megaphone |
| Jadwal & Diskon | `/dashboard/scheduler` | CalendarClock |
| Pengaturan | `/dashboard/settings` | Settings |

---

## 2. Analitik (`/dashboard`)

Halaman utama. Visualisasi engagement 14 hari terakhir dari tabel `Analytics_Logs`. Semua chart pure-SVG, animate-in saat load (no library eksternal).

### 2.1 Kartu Statistik (4)
Tiap kartu: angka count-up + label + ikon + indikator delta minggu-ke-minggu.

| Kartu | Sumber | Caption |
|---|---|---|
| Tampilan Menu | total `click_menu` | delta % vs minggu lalu |
| Lihat Model 3D | total `view_3d` | delta % vs minggu lalu |
| Mulai Pesan | total `click_order` | delta % vs minggu lalu |
| Konversi ke Pesan | `click_order / click_menu` (%) | % yang buka model 3D |

### 2.2 Grafik Aktivitas Harian
Line chart 14 hari — kurva bezier halus, area gradient, garis menggambar diri kiri→kanan, dot di titik akhir, hover tooltip per titik, label sumbu X/Y.

### 2.3 Corong Engagement (Funnel)
3 tahap bar animasi: Buka Menu → Lihat 3D → Mulai Pesan, dengan persentase drop-off antar tahap + kalimat ringkasan.

### 2.4 Jam Tersibuk (Heatmap)
24 sel (per jam) — intensitas warna sesuai jumlah interaksi, jam puncak di-outline, hover tampil jam + jumlah.

### 2.5 Komposisi Interaksi (Donut)
Donut chart proporsi 3 tipe event + legend persentase + total di tengah.

### 2.6 Menu Terpopuler
Tabel padat top 6 menu: ranking, nama, micro-bar views, jumlah views + orders (warna-coded).

### 2.7 Aktivitas Terbaru
Feed 8 event terakhir: tipe event (dot warna) + nama menu + waktu relatif ("5 mnt lalu").

**File:** `src/app/dashboard/page.tsx`, `src/lib/analytics.ts`
**Komponen chart:** `LineChart.tsx`, `DonutChart.tsx`, `HeatmapGrid.tsx`, `StatCard.tsx`, `FunnelBars.tsx`

---

## 3. Pesanan (`/dashboard/orders`)

Manajemen pesanan masuk secara **real-time**.

| Fitur | Detail |
|---|---|
| Real-time | Supabase Realtime channel — pesanan baru/update muncul tanpa refresh |
| Filter tab | Semua / Baru / Diproses / Siap (dengan jumlah per status) |
| Kartu pesanan | Nomor meja, kode order, waktu relatif, daftar item + qty + harga, total |
| Alur status | `received` → `preparing` → `ready` (tombol "Mulai Proses" → "Tandai Siap") |
| Update optimistic | Status berubah instan di UI, lalu sync ke DB |
| Empty state | Ikon + pesan kalau belum ada pesanan |

**Warna status:** Baru (oranye), Diproses (kuning), Siap (teal).

**File:** `src/app/dashboard/orders/page.tsx`, `src/components/dashboard/OrdersClient.tsx`
**Tabel DB:** `Orders` (RLS + realtime aktif)

---

## 4. Menu (`/dashboard/menu`)

CRUD penuh menu kafe.

### 4.1 Daftar Menu
Tabel: foto, nama, kategori, harga, badge 3D, status aktif/nonaktif, tombol Edit. Empty state kalau belum ada menu.

### 4.2 Tambah / Edit Menu
Form lengkap (`MenuForm`), field:

**Dasar:** nama*, harga*, kategori, deskripsi, waktu saji (menit), kalori, bahan (comma-separated)
**Media & 3D:** URL gambar, URL model 3D (.glb), URL model iOS (.usdz), link pesan
**Ketersediaan:** toggle tampil/sembunyi, diskon %, hari tersedia (Sen–Min), jam mulai–selesai

- Tambah: `/dashboard/menu/new`
- Edit: `/dashboard/menu/[id]/edit` (+ tombol Hapus dengan konfirmasi)
- Validasi: nama wajib; aksi discope ke `cafe_id` pemilik

**File:** `src/app/dashboard/menu/page.tsx`, `menu/new/page.tsx`, `menu/[id]/edit/page.tsx`, `src/components/dashboard/MenuForm.tsx`

---

## 5. Pengumuman (`/dashboard/announcements`)

Banner real-time yang tampil di atas halaman menu pelanggan.

| Fitur | Detail |
|---|---|
| Pesan | Teks pengumuman (maks 120 char) dengan counter |
| Warna latar | 5 preset (oranye/navy/teal/merah/hitam) |
| Pratinjau live | Banner ter-render real-time saat mengetik |
| Toggle aktif | On/off — kalau on, banner muncul di halaman kafe |
| Sinkron | Disimpan di tabel `Announcements`, dibaca anon di sisi pelanggan |

**File:** `src/app/dashboard/announcements/page.tsx`, `src/components/dashboard/AnnouncementForm.tsx`, `src/components/AnnouncementBanner.tsx` (customer)
**Tabel DB:** `Announcements`

---

## 6. Jadwal & Diskon (`/dashboard/scheduler`)

Atur ketersediaan & diskon tiap menu dalam satu layar (inline per baris).

| Kontrol per menu | Detail |
|---|---|
| Toggle aktif | Tampil/sembunyi dari menu pelanggan |
| Diskon % | 0–100, harga otomatis dicoret + diskon di sisi pelanggan |
| Hari aktif | Pilih Sen–Min (kosong = setiap hari) |
| Jam tayang | Jam mulai–selesai (mendukung window lewat tengah malam) |
| Simpan per baris | Tombol "Simpan" muncul saat ada perubahan |

**Logika sinkron:** menu di luar jadwal / nonaktif **otomatis hilang** dari menu pelanggan (`isMenuAvailableNow`). Diskon diterapkan ke kartu, halaman detail, dan keranjang (`effectivePrice`).

**File:** `src/app/dashboard/scheduler/page.tsx`, `src/components/dashboard/SchedulerClient.tsx`, `src/lib/menu-availability.ts`

---

## 7. Pengaturan Kafe (`/dashboard/settings`)

Edit profil kafe yang tampil di halaman menu pelanggan.

**Identitas:** nama kafe*, alamat, sapaan/tagline
**Tampilan & Tautan:** URL logo, URL foto sampul, URL ulasan Google Maps

- Tombol "Beri Ulasan di Google Maps" muncul di halaman menu kalau URL diisi
- Tombol simpan dengan state "Tersimpan" (feedback sukses)

**File:** `src/app/dashboard/settings/page.tsx`, `src/components/dashboard/SettingsForm.tsx`

---

## 8. Sinkronisasi Dashboard ↔ App Pelanggan

| Aksi dashboard | Efek di halaman pelanggan |
|---|---|
| Toggle menu nonaktif / di luar jadwal | Menu hilang dari daftar (`getMenusByCafeId` filter) |
| Set diskon % | Harga dicoret + harga diskon di kartu, detail, keranjang |
| Aktifkan pengumuman | Banner muncul di atas halaman kafe |
| Edit profil kafe | Nama/logo/cover/tagline/ulasan langsung berubah |
| Tambah/edit menu | Menu langsung tampil (revalidatePath) |

**File kunci:** `src/lib/menu-availability.ts`, `src/lib/supabase.ts`, `src/lib/data.ts`

---

## 9. Desain & Interaksi

| Aspek | Detail |
|---|---|
| Tema | Dark — BG `#060E1B`, surface `#0D1829`, teks `#E9EEF6`, muted `#5A7898`, aksen `#FD5002` + teal `#00C2A8` |
| Press feedback | Semua tombol/chip scale-down saat ditekan (`.dash-press`, `.dash-btn`) |
| Hover | Nav slide, baris tabel highlight, kartu lift halus |
| Focus ring | Tiap input dapat ring oranye saat fokus (`.dash-input`) |
| Animasi masuk | Section reveal staggered, count-up angka, chart animate-in |
| Motion | Emil-restraint: <200ms, ease-out, no bounce, hormati `prefers-reduced-motion` |

**File:** `src/app/globals.css` (layer `.dash-*`)

---

## 10. Skema Database

| Tabel | Kolom kunci yang dipakai dashboard |
|---|---|
| `Cafes` | `id_cafe`, `owner_id`, `nama_cafe`, `alamat_cafe`, `greeting`, `logo_url`, `cover_url`, `google_maps_review_url` |
| `Menus` | + `prep_time_minutes`, `calories`, `ingredients`, `is_active`, `discount_pct`, `schedule_days`, `schedule_start`, `schedule_end` |
| `Analytics_Logs` | `cafe_id`, `menu_id`, `event_type` (`click_menu`/`view_3d`/`click_order`), `created_at` |
| `Orders` | `id_order`, `cafe_id`, `table_number`, `items` (jsonb), `total`, `status`, `payment_*`, `created_at` |
| `Announcements` | `id`, `cafe_id`, `message`, `bg_color`, `is_active`, `updated_at` |

**Migrasi:** `scripts/dashboard-migration.sql`, `scripts/migrate-menu-detail-fields.sql`, `scripts/add-gmaps-review.sql`, `scripts/orders-table.sql`

---

## 11. Server Actions

Semua mutasi lewat server actions dengan guard auth (`getAuthCafeId`) — operasi selalu discope ke kafe milik user login.

| Action | Fungsi |
|---|---|
| `createMenu` / `updateMenu` / `deleteMenu` | CRUD menu |
| `setMenuAvailability` | Toggle aktif, diskon, jadwal (dari scheduler) |
| `updateCafeSettings` | Simpan profil kafe |
| `saveAnnouncement` | Buat/update pengumuman |
| `updateOrderStatus` | Ubah status pesanan |

**File:** `src/lib/dashboard-actions.ts`

---

## Ringkasan Cakupan Fitur

✅ Login & auth multi-tenant
✅ Analitik visual (line, donut, heatmap, funnel, stat cards, top dishes, activity feed)
✅ Pesanan real-time + alur status
✅ Menu CRUD penuh (+ media, 3D, detail)
✅ Pengumuman banner real-time
✅ Jadwal tayang + diskon otomatis per menu
✅ Pengaturan kafe
✅ Sinkron penuh dashboard ↔ app pelanggan
✅ Animasi & interaksi (shadcn-grade + impeccable motion)
