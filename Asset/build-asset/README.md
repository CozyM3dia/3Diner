# 3Diner — Build Asset Pack
**Paket lengkap untuk build customer web app 3Diner di Claude Code.**
Generated: 2026-06-20 | Stitch project: `7296933986229050877`

---

## Isi Folder

```
build-asset/
├── README.md                ← file ini (baca dulu)
├── screens/                 ← 10 screen final (HTML + screenshot PNG)
│   ├── 01-home.html / .png
│   ├── 02-dish-detail.html / .png
│   ├── 03-3d-viewer.html / .png
│   ├── 04-ar-mode.html / .png
│   ├── 05-search.html / .png
│   ├── 06-empty-state.html / .png
│   ├── 07-keranjang.html / .png
│   ├── 08-pilih-pembayaran.html / .png
│   ├── 09-qris-payment.html / .png
│   └── 10-status-pesanan.html / .png
├── brand/
│   ├── brand-design.png     ← brand sheet (warna, font, elemen)
│   ├── logo-full.png        ← logo + wordmark "3Diner"
│   └── logo-icon.png        ← cube icon only
└── docs/
    ├── PRD.md               ← product requirements (v2 in-app ordering + POS)
    ├── DESIGN.md            ← design system (warna, tipografi, komponen, anti-slop)
    ├── STITCH-PROMPT.md     ← prompt master tiap screen (referensi intent)
    └── CANONICAL-SCREENS.md ← peta screen → ID Stitch + status
```

---

## Cara Build (urutan untuk Claude Code)

1. **Baca `docs/PRD.md`** — pahami flow v2: scan QR → menu → cart → meja → pesan → bayar (cash/QRIS) → status. Order mendarat di dashboard POS cafe.
2. **Baca `docs/DESIGN.md`** — token desain. Patuhi: warna `#022C60` navy / `#F05A22` orange, font Poppins (Plus Jakarta Sans di mockup), harga selalu orange, no emoji, no Inter, no pure black.
3. **Lihat `screens/*.png`** — referensi visual final tiap screen.
4. **Pakai `screens/*.html`** — markup Stitch (Tailwind) sebagai basis. Port ke komponen Next.js, JANGAN copy mentah — bersihkan, komponenkan, bind ke data Supabase.

---

## Brand Tokens (ringkas)

| Token | Hex |
|-------|-----|
| Deep Navy (teks/struktur) | `#022C60` |
| Midnight Navy (nav/overlay) | `#002355` |
| Muted Navy (teks sekunder) | `#51698F` |
| Signal Orange (CTA/harga/aksen) | `#F05A22` |
| Orange Blush (badge) | `#FDE8DC` |
| Paper White (bg) | `#F6F8FB` |
| Pure Surface (card) | `#FDFDFD` |
| Soft Surface (chip inactive) | `#E0E7EE` |
| Whisper Border | `#CFD9E4` |

Font: **Poppins** (display + body). Radius card 16px, button 18px. Touch target ≥44px.

---

## 10 Screen — Flow & Catatan Implementasi

| # | Screen | Catatan build |
|---|--------|---------------|
| 1 | **Home** | Header cafe, hero, search, kategori chips, grid menu 2-kolom, badge "LIHAT 3D", floating cart FAB. Data: tabel Cafes + Menus. |
| 2 | **Dish Detail** | Foto, harga, deskripsi, badge 3D. Bottom bar: `[Lihat 3D] [− qty +] [Tambah · Rp]`. Add-to-cart lokal. |
| 3 | **3D Viewer** | Dark. Ganti mockup render dengan `<model-viewer>` live (.glb/.usdz). Kotak gelap di PNG = artifact mockup, hilang dgn model-viewer transparan. |
| 4 | **AR Mode** | `<model-viewer ar>` WebXR. Kamera passthrough + model di meja. |
| 5 | **Search** | List vertikal hasil, harga orange, badge 3D. Footer "Lihat semua menu". |
| 6 | **Empty State** | Cafe not found / QR invalid. |
| 7 | **Keranjang** | Multi-item + qty stepper + **input nomor meja (manual, wajib)** + total → "Pesan Sekarang". |
| 8 | **Pilih Pembayaran** | Banner "Pesanan Terkirim", pilih Cash (di kasir) / QRIS. |
| 9 | **QRIS Payment** | QR dari payment gateway (Midtrans/Xendit), countdown, poll status. |
| 10 | **Status Pesanan** | Timeline Diterima→Disiapkan→Siap. Realtime dari Supabase. |

---

## Backend yang Perlu Dibangun (belum ada)

- **Tabel `Orders`** (Supabase): id, cafe_id, table_number, items(jsonb), total, status, payment_method, payment_status, created_at
- **Realtime** order status (Supabase Realtime) untuk screen 10 + dashboard
- **QRIS payment gateway** (Midtrans/Xendit — belum dikunci)
- **Dashboard cafe (POS)** — WAJIB, belum didesain. Order screen 7-10 mendarat di sini. Live feed per meja + ubah status + konfirmasi bayar + menu CRUD + upload 3D.

---

## Catatan Penting

- Mockup pakai data hardcoded (Senja Kopi, "Meja 12", "#SJ-0241", "Rp 110.000"). Bind ke data real saat build.
- HTML Stitch pakai Tailwind + `material-symbols-outlined` icons. Di Next.js boleh ganti ke lucide-react atau icon set proyek.
- Stack target: Next.js App Router + React 19 + TS + `@google/model-viewer` + Supabase + Vercel. URL `/[cafe-slug]`.
- Pivot v2: 3Diner sekarang **in-app ordering + POS**, BUKAN lagi redirect keluar (GoFood/Grab/WA).
