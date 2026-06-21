# PRD — 3Diner Customer Web App
**Version:** 2.0 | **Date:** 2026-06-20 | **Status:** MVP

> ⚠️ **PIVOT v2.0:** 3Diner sekarang **in-app ordering + POS**, bukan lagi redirect keluar (GoFood/Grab/WA). Lihat bagian "v2 Pivot" di akhir dokumen. Bagian di bawah (v1) sebagian usang — flow order & "out of scope" berubah.

---

## 1. Problem Statement

Cafe customers di Indonesia tidak bisa membayangkan hidangan sebelum memesan. Menu foto 2D tidak memberikan gambaran nyata soal ukuran, plating, dan tampilan asli makanan. Akibatnya: salah pilih, kecewa, tidak balik lagi.

---

## 2. Product Vision

> "Scan QR dari meja — menu langsung hidup di layarmu. Lihat hidangan dalam 3D, rasakan ukurannya di meja kamu lewat AR, lalu pesan."

3Diner bukan aplikasi delivery. Bukan POS. Ini adalah **experience layer** — lapisan visual interaktif di atas menu cafe yang sudah ada.

---

## 3. Target User

**Primary:** Pelanggan cafe mid-range di Bandar Lampung, usia 18–35 tahun.
- Terbiasa pakai HP untuk pesan makanan (GoFood/GrabFood)
- Visual-first: terpengaruh tampilan sebelum memilih
- Tidak mau download aplikasi untuk sekadar lihat menu

**Secondary:** Pemilik/operator cafe yang mau diferensiasi dari kompetitor.

---

## 4. User Journey

```
Duduk di meja cafe
→ Scan QR code di meja / standing card
→ Browser langsung buka 3Diner (no install, no login, no onboarding)
→ Lihat menu cafe dengan foto + kategori
→ Tap hidangan → detail lengkap + tombol "Lihat 3D"
→ [Opsional] Putar model 3D 360° / tap "Mode AR" → hidangan muncul di meja nyata
→ Tap "Pesan Sekarang" → redirect ke GoFood / GrabFood / WhatsApp
```

---

## 5. Core Screens (MVP)

| # | Screen | Prioritas | Keterangan |
|---|--------|-----------|------------|
| 1 | **Cafe Home** | P0 | Landing utama setelah scan QR. Header cafe, hero, search, kategori, grid menu. |
| 2 | **Dish Detail** | P0 | Foto full, nama, harga, deskripsi, CTA Lihat 3D + Pesan. |
| 3 | **3D Viewer** | P0 | Immersive viewer model 3D, kontrol rotate/zoom, tombol Mode AR. |
| 4 | **AR Mode** | P1 | Kamera passthrough + model 3D ditempatkan di meja nyata. |
| 5 | **Search Results** | P1 | Hasil pencarian keyword dalam menu cafe. |
| 6 | **Empty State** | P1 | QR tidak valid / cafe tidak aktif / menu kosong. |

> **TIDAK ADA:** Onboarding, login pelanggan, halaman registrasi, splash screen, tutorial slides.

---

## 6. Functional Requirements

### Cafe Home (P0)
- Header: logo cafe + nama + lokasi
- Hero banner: foto atmosfer cafe (full-width)
- Search bar: cari hidangan by name
- Category filter: horizontal scroll, tap untuk filter
- Menu grid: 2-column, foto hidangan, nama, harga, badge "3D" jika ada model
- Bottom nav: Home | Menu | Search (3 item max, simpel)

### Dish Detail (P0)
- Hero image: full-bleed foto hidangan
- Nama hidangan, kategori, harga (prominent, orange)
- Deskripsi singkat hidangan
- Badge: ada/tidaknya model 3D
- Dua CTA: "Lihat 3D" (secondary) + "Pesan Sekarang" (primary, sticky)
- Note kecil: "Akan diarahkan ke layanan eksternal"

### 3D Viewer (P0)
- Full-screen dark canvas dengan model 3D floating
- Gesture hints: putar & zoom
- Info bar bawah: nama + harga + tombol "Mode AR"
- Kontrol: reset rotasi, ukuran

### AR Mode (P1)
- Kamera passthrough full-screen
- Model 3D ditempatkan di permukaan meja (WebXR / model-viewer AR)
- UI minimal: status "AR Aktif", close button, nama hidangan
- Scan line indicator ketika surface detection

### Search (P1)
- Input aktif di header dengan hasil live
- List hasil: foto kecil + nama + cafe + harga + badge 3D
- State kosong: "Tidak ada hasil untuk [query]"

### Empty State (P1)
- Ilustrasi minimal
- Pesan jelas: apa yang salah + apa yang harus dilakukan
- "Scan ulang" atau "Hubungi staff"

---

## 7. Non-Functional Requirements

- **Performance:** First contentful paint < 2s pada 4G Indonesia
- **No-install:** Berjalan di browser mobile biasa (Chrome Android, Safari iOS)
- **AR:** Gunakan `<model-viewer>` WebXR — tidak perlu app store
- **Offline:** Tidak perlu (menu dari Supabase, always online)
- **Device:** Mobile-first 375px, mendukung hingga 430px (iPhone Pro Max)
- **Aksesibilitas:** Contrast ratio min 4.5:1, touch target min 44px

---

## 8. Out of Scope (MVP)

- Login / akun pelanggan
- Riwayat pesanan
- Integrasi pembayaran langsung (QRIS/GoPay)
- Notifikasi push
- Staff console / waiter app
- Multi-bahasa
- AI image-to-3D generation (defer Fase 2)
- Rating & review dari pelanggan

---

## 9. Success Metrics

| Metric | Target MVP |
|--------|-----------|
| Time-to-menu | < 3 detik dari scan QR |
| 3D interaction rate | > 30% pengunjung tap "Lihat 3D" |
| AR usage rate | > 10% dari yang buka 3D viewer |
| Order redirect rate | > 60% pengunjung tap "Pesan Sekarang" |

---

## 10. Tech Stack

- **Frontend:** Next.js App Router + React 19 + TypeScript
- **3D:** `@google/model-viewer` (.glb Android/Web, .usdz iOS AR)
- **Database:** Supabase (Cafes + Menus + Analytics_Logs tables)
- **Storage:** Supabase Storage (dish images) + Cloudflare R2 (3D models)
- **Deploy:** Vercel (cozym3dias-projects team)
- **URL pattern:** `3diner.vercel.app/[cafe-slug]`

---

# v2 PIVOT — In-App Ordering + POS (2026-06-20)

## Perubahan Posisi
3Diner berhenti jadi "experience layer yang redirect keluar". Sekarang = **smart menu + in-app ordering + lapisan POS ringan** untuk cafe. Order customer mendarat langsung di dashboard cafe (POS), bukan keluar ke GoFood/Grab.

## Flow Customer Baru
```
Scan QR meja → browse menu 3D → tap dish → lihat 3D/AR + set qty → "Tambah ke Pesanan"
→ keranjang multi-item → input nomor meja (manual) → "Pesan Sekarang"
→ order terkirim ke DASHBOARD POS cafe → customer pilih bayar:
   (a) Cash → "Bayar di Kasir" (tunjukkan kode order ke kasir)
   (b) QRIS → payment gateway in-app → bukti bayar
→ Status pesanan: Diterima → Disiapkan → Siap
```

## Keputusan Terkunci
- **Cart:** multi-item (kumpul banyak dish + qty, 1x submit).
- **Nomor meja:** input manual oleh customer sebelum submit (belum encode di QR).
- **Pembayaran:** dua jalur — cash di kasir ATAU QRIS payment gateway.
- **Dashboard cafe:** WAJIB (POS view) — tidak bisa di-defer lagi.

## Screen Customer App v2 (tambahan di atas 6 screen lama)

| # | Screen | Status |
|---|--------|--------|
| 1 | Cafe Home (+ floating cart badge) | edit dari v1 |
| 2 | Dish Detail (+ qty stepper + "Tambah ke Pesanan") | edit dari v1 |
| 3 | 3D Viewer | v1, tetap |
| 4 | AR Mode | v1, tetap |
| 5 | Search Results | v1, tetap |
| 6 | Empty State | v1, tetap |
| 7 | **Keranjang / Ringkasan Pesanan** | BARU |
| 8 | **Pilih Pembayaran** (cash/QRIS) | BARU |
| 9 | **QRIS Payment** | BARU |
| 10 | **Status Pesanan / Sukses** | BARU |

## Screen Dashboard Cafe (POS) — fase berikutnya, WAJIB
- Live order feed (order masuk per meja, real-time)
- Order detail + ubah status (Diterima → Disiapkan → Siap)
- Konfirmasi pembayaran (cash diterima / QRIS auto)
- Menu CRUD + upload model 3D
- Analytics

## Data Model — perubahan
- Tabel **Orders** baru: id, cafe_id, table_number, items (jsonb), total, status, payment_method, payment_status, created_at
- Tabel **Order_Items** atau items jsonb di Orders
- Menus: hapus `redirect_link` (tidak relevan lagi), tambah relasi ke order
- Integrasi payment gateway QRIS (kandidat: Midtrans / Xendit — belum dikunci)

## Out of Scope v2 (tetap)
- Login/akun customer (tetap no-login, identitas via nomor meja + order)
- Riwayat order lintas sesi
- Loyalty/poin
- AI image-to-3D (defer fase 2)
