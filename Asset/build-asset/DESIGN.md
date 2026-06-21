# Design System — 3Diner Customer Web App

---

## 1. Visual Theme & Atmosphere

Premium food-tech meets Indonesian warmth. Atmosphere: "Malam di night market tapi dirancang oleh studio desain Tokyo." Dense enough to show menu efficiently, warm enough to trigger appetite.

- **Density:** 5 — balanced, tidak terlalu airy, tidak terlalu cockpit
- **Variance:** 6 — offset asymmetric, kartu grid tidak monoton
- **Motion:** 5 — fluid CSS spring, weighty tapi tidak berlebihan

Ini bukan delivery app. Ini experience layer — setiap pixel harus membuat makanan terlihat lebih enak.

---

## 2. Color Palette & Roles

| Token | Hex | Peran |
|-------|-----|-------|
| **Deep Navy** | `#022C60` | Teks utama, navbar, elemen struktural gelap |
| **Midnight Navy** | `#002355` | Overlay gelap, bottom nav background |
| **Navy Muted** | `#51698F` | Teks sekunder, metadata, placeholder |
| **Signal Orange** | `#F05A22` | SATU-SATUNYA aksen. CTA, badge 3D, indikator aktif. Pakai hemat. |
| **Orange Warm** | `#F07042` | Hover state orange CTA |
| **Orange Blush** | `#FDE8DC` | Badge chip background ringan |
| **Paper White** | `#F6F8FB` | Background utama app |
| **Pure Surface** | `#FDFDFD` | Card fill, input fields |
| **Soft Surface** | `#E0E7EE` | Skeleton loader, chip inactive |
| **Whisper Border** | `#CFD9E4` | Border 1px kartu, garis pemisah |

> **Dilarang keras:** Pure black `#000000`, neon glow, gradient purple/biru neon, warna di luar palette ini.

---

## 3. Typography

### Font Family
- **Display / Headline:** Poppins — weight 700–800. Track tight (-0.02em). Untuk nama hidangan dan identitas cafe.
- **Body / UI:** Poppins — weight 400–500. Line-height 1.6. Untuk deskripsi, label, harga.
- **Price / Number:** Poppins — weight 700. Color: Signal Orange. Angka harus selalu menonjol.

> Poppins adalah font brand resmi 3Diner (lihat brand-design.png). Di Stitch, gunakan PLUS_JAKARTA_SANS sebagai closest match.

### Scale (Mobile)
| Role | Size | Weight | Color |
|------|------|--------|-------|
| Cafe Name / Hero H1 | 24–28px | 800 | Navy |
| Dish Name H2 | 20–22px | 700 | Navy |
| Section Header | 16–18px | 700 | Navy |
| Price | 18–20px | 700 | Orange |
| Body / Description | 14px | 400 | Muted Navy |
| Label / Badge | 11–12px | 500 | Varies |
| Micro / Caption | 10–11px | 400 | Muted Navy |

---

## 4. Component Styling

### Primary Button (CTA Utama — "Pesan Sekarang")
- Fill: Signal Orange `#F05A22`
- Text: White, Poppins 600 15px
- Height: 52px minimum
- Radius: 18px
- Shadow: `0 6px 20px rgba(240,90,34,0.28)`
- Active: `-2px translateY + shadow compression`
- NO outer glow, NO neon

### Secondary Button ("Lihat 3D")
- Ghost: 1.5px border Navy `#022C60`, Navy text
- Same height, same radius
- Active: Navy fill + white text

### Badge "3D" / "3D + AR"
- Background: Orange Blush `#FDE8DC`
- Text: Signal Orange `#F05A22`
- Label: "LIHAT 3D" — Poppins 10px uppercase, letter-spacing 0.1em
- Shape: pill 99px radius
- Posisi: absolute overlay bottom-left di atas foto kartu menu
- Subtle pulse animation 2s loop (scale 1.0 → 1.04)

### Menu Cards
- Background: `#FDFDFD`
- Border: 1px `#CFD9E4`
- Radius: 16px
- Shadow: `0 4px 14px rgba(2,44,96,0.07), 0 1px 4px rgba(2,44,96,0.04)`
- Image: 55% card height, object-fit cover, rounded top only
- Dish name: Poppins 600 14px Navy
- Price: Poppins 700 14px Orange
- Description: Poppins 400 12px Muted Navy (1 line max, truncate)
- Grid: 2-column. BUKAN 3-column equal.

### Category Filter Chips
- Horizontal scroll, no scrollbar visible
- Inactive: `#E0E7EE` fill, muted navy text, 99px radius
- Active: Deep Navy `#022C60` fill, white text
- Typography: Poppins 11px uppercase, 0.1em tracking
- Padding: 8px 16px
- 8px gap antar chip

### Search Bar
- Shape: pill 99px radius
- Fill: `#E0E7EE`, no border rest state
- Focus: 2px orange ring `#F05A22`
- Height: 48px
- Icon kiri: search, muted navy
- Placeholder: Poppins 14px muted navy

### Bottom Navigation
- Max 3–4 item untuk web app (lebih simpel dari native app)
- Background: Midnight Navy `#002355`
- Active: Orange dot indicator + orange icon
- Height: 56–64px
- Icon + label 10px Poppins

### 3D Viewer Controls
- Dark panel bawah: `#002355` 90% opacity + backdrop blur
- Kontrol ikon: putih, 32px, touch target 44px
- CTA "Mode AR": orange fill, full-width

### Skeleton / Loading
- Shimmer animation di `#E0E7EE`
- Match exact ukuran konten yang dimuat
- NO spinner circle, NO "Loading..." teks

---

## 5. Layout Principles

- **Mobile-first 375px.** Single column. Tidak ada horizontal scroll kecuali category chips.
- **16px page gutter** kiri-kanan
- **Touch targets min 44px** untuk semua elemen interaktif
- **Asymmetric grid:** 2-column kartu (bukan 3-column sama rata)
- **Sticky elements:** Category bar sticky di bawah header. CTA "Pesan" sticky di atas bottom nav di detail page.
- **Image-forward:** Foto makanan dominan. UI chrome minimal, konten yang lead.
- **Full height:** `min-h-[100dvh]` — BUKAN `h-screen` (iOS Safari fix)
- **Bottom sheet** untuk filter lanjutan — NO modal overlay

---

## 6. Motion & Interaction

- **Spring:** stiffness 120, damping 18 — snappy, fisik, seperti menu fisik yang dibuka
- **Card tap:** `scale(0.97)` saat press, spring back
- **Page transition:** Slide-left masuk ke detail. Slide-right untuk back.
- **3D entrance:** Fade + float animation loop di viewer page
- **Category switch:** Content fade out 80ms → fade in 200ms dengan stagger kartu
- **Skeleton → content:** `opacity 0→1` + `translateY(8px→0)` stagger
- **Performansi:** Hanya `transform` + `opacity`. NO layout animation.

---

## 7. Anti-Patterns (DILARANG)

- NO emoji di UI manapun
- NO Inter font
- NO pure black `#000000` — gunakan Navy `#022C60`
- NO neon glow, purple/biru gradient
- NO 3-column equal card grid
- NO centered hero layout di mobile (selalu left-align atau full-bleed)
- NO copywriting AI: "Elevate", "Seamless", "Next-Gen", "Unleash"
- NO angka palsu bulat: "100+ cafe", "99% kepuasan"
- NO "Scroll to explore" atau scroll arrows
- NO placeholder generik: "Cafe Name", "Menu Item"
- NO broken image placeholder — gunakan navy placeholder dengan icon fork SVG
- NO gradient text di heading — gunakan weight + color hierarchy
- NO modal overlay untuk filter — gunakan bottom sheet
- NO custom cursor

---

## 8. Screen Inventory (MVP — Web App, No Onboarding)

Customer langsung masuk tanpa onboarding. QR scan → langsung Cafe Home.

| # | Screen | Path |
|---|--------|------|
| 1 | Cafe Home | `/[slug]` |
| 2 | Dish Detail | `/[slug]/[menu_id]` |
| 3 | 3D Viewer | `/[slug]/[menu_id]/3d` |
| 4 | AR Mode | (overlay di 3D Viewer) |
| 5 | Search Results | `/[slug]?q=keyword` |
| 6 | Empty State | Jika slug tidak valid atau menu kosong |

---

## 9. Brand Identity Reference

Lihat file: `brand-design.png` dan `logo-full.png` di folder ini.

- **Logo:** Cube 3D dengan fork & piring, warna navy + orange. Wordmark "3Diner" Poppins Bold.
- **Tagline:** "Lihat Sebelum Memesan"
- **Tone:** Confident, warm, tech-forward. Bukan kaku enterprise. Bukan norak delivery app.
