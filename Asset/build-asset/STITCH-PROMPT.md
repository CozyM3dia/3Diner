# Stitch Prompting Guide — 3Diner Customer Web App
**Gunakan dokumen ini step-by-step di Google Stitch (labs.google/stitch)**

---

## CARA PAKAI DOKUMEN INI

1. Buka [labs.google/stitch](https://labs.google/stitch)
2. Jalankan **Step 1** dulu (buat project baru)
3. Lanjut **Step 2** (upload brand + buat design system)
4. Baru generate screen satu per satu mulai **Step 3**
5. Setiap prompt di blok kode — copy-paste langsung ke Stitch

---

## STEP 1 — BUAT PROJECT BARU

Di Stitch, klik **"New Project"** lalu isi:
- **Name:** `3Diner — Smart Menu Web App`
- **Description:** `Customer-facing 3D/AR menu web app for cafes in Indonesia. QR scan → menu browse → 3D viewer → order redirect. No install, no login, no onboarding.`

---

## STEP 2 — UPLOAD BRAND & BUAT DESIGN SYSTEM

### 2a. Upload brand assets
Upload file berikut ke Stitch sebagai referensi:
- `logo-full.png` — logo 3Diner lengkap dengan wordmark
- `logo-icon.png` — icon cube 3D saja
- `brand-design.png` — brand sheet lengkap (warna, font, elemen)

### 2b. Buat Design System
Klik **"Create Design System"** lalu gunakan prompt ini:

```
Create a premium design system for 3Diner — a 3D/AR smart menu web app for cafes in Indonesia.

BRAND IDENTITY:
3Diner helps cafe customers see dishes in interactive 3D and AR before ordering. Tagline: "Lihat Sebelum Memesan" (See Before You Order). This is NOT a delivery app — it's a visual experience layer accessed via QR code scan.

Attach the brand assets uploaded:
- Logo: {{brand logo image}} — navy blue cube with fork icon + "3Diner" wordmark in Poppins Bold
- Brand sheet: {{brand design image}} — shows full color palette, typography, brand elements

COLORS:
- Primary Accent: #F05A22 (Signal Orange) — use sparingly for CTAs, badges, active states only
- Primary Text / Structure: #022C60 (Deep Navy) — headings, navbar, structural elements
- Dark Overlay: #002355 (Midnight Navy) — bottom nav, dark overlays
- Secondary Text: #51698F (Muted Navy) — descriptions, labels, metadata
- App Background: #F6F8FB (Paper White)
- Card Surface: #FDFDFD (Pure White)
- Inactive Surface: #E0E7EE (Soft Surface) — skeleton, inactive chips
- Border: #CFD9E4 (Whisper) — 1px card borders, dividers
- Orange Light: #FDE8DC (Orange Blush) — badge chip background

TYPOGRAPHY:
- All text: PLUS_JAKARTA_SANS (closest to brand Poppins)
- Headlines: weight 700-800, tight tracking
- Body/UI: weight 400-500, 1.6 line-height
- Price labels: weight 700, orange color always
- NO Inter font anywhere

COMPONENT RULES:
- Primary buttons: 52px height, 18px radius, orange fill, white text, NO outer glow
- Secondary/ghost buttons: navy border, navy text, same dimensions
- Cards: 16px radius, whisper border, soft navy-tinted shadow
- Category chips: pill shape 99px radius, navy active, soft surface inactive
- Search: pill shape, #E0E7EE fill, orange 2px focus ring
- Bottom nav: midnight navy background, orange active indicator dot
- Badge "LIHAT 3D": orange-blush fill, orange text, 10px Poppins uppercase, absolute overlay on card image

ATMOSPHERE:
Premium food-tech meets Indonesian warmth. "Night market meets design studio." Dense enough for menu efficiency, warm enough to trigger appetite. Every pixel makes food look more delicious.

BANNED PATTERNS:
- No emojis anywhere
- No pure black #000000 — use Deep Navy instead
- No neon glows or purple/blue gradients
- No equal 3-column card grid
- No centered hero layouts — always left-aligned or full-bleed
- No AI copywriting clichés (Elevate, Seamless, Next-Gen)
- No Inter font
```

---

## STEP 3 — SCREEN 1: CAFE HOME PAGE
**(Screen paling penting — ini landing utama setelah QR scan)**

Device type: **MOBILE** | Model: **GEMINI 2.0 PRO**

```
3Diner Cafe Home Page — main screen after QR scan. Mobile 375px. Paper white (#F6F8FB) background. This is the most important screen — food photography leads, UI chrome is minimal.

Cafe example: "Senja Kopi" — a cozy specialty coffee cafe in Bandar Lampung, Indonesia.

STICKY HEADER (top, paper white background, 1px bottom border #CFD9E4):
- Left: 3Diner logo cube icon (small, 28px) + cafe name "Senja Kopi" in Poppins 700 18px deep navy (#022C60)
- Below cafe name: "Bandar Lampung" with small map-pin icon in Poppins 12px muted navy (#51698F)
- Right: circular search icon button (44px tap target, #E0E7EE fill, navy magnifying glass icon)
- Horizontal padding: 16px

HERO BANNER (full-width, below header, no margin):
- Warm cozy cafe interior photo — wooden tables, soft lamp lighting, indoor plants, evening atmosphere
- Height: 200px, object-fit cover
- Subtle dark gradient overlay at bottom 25% for transition
- No text overlay on hero

SEARCH BAR (below hero, 16px horizontal margin):
- Pill shape, 99px radius, #E0E7EE fill, 48px height
- Left: search icon muted navy
- Placeholder: "Cari hidangan..." Poppins 14px muted navy (#51698F)
- No border in rest state

CATEGORY FILTER (horizontal scroll row, 16px left start, 8px gap):
- "Semua" — ACTIVE: Deep Navy fill (#022C60), white text
- "Kopi", "Minuman", "Makanan Ringan", "Dessert" — inactive: #E0E7EE fill, muted navy text
- All chips: Poppins 11px UPPERCASE, 8px/16px padding, 99px radius

MENU GRID (2-column, 16px page padding, 14px gap):
Show 4 menu cards minimum.

Card 1 — "Kopi Susu Senja":
- Latte art coffee photo (warm, professional food photography)
- Name: "Kopi Susu Senja" Poppins 600 14px navy
- Price: "Rp 28.000" Poppins 700 14px orange (#F05A22)
- Description: "Espresso dengan susu segar" Poppins 400 12px muted navy
- "LIHAT 3D" badge: orange-blush fill (#FDE8DC), orange text (#F05A22), 10px uppercase pill, absolute bottom-left on photo

Card 2 — "Croissant Mentega":
- Golden croissant photo
- Name: "Croissant Mentega"
- Price: "Rp 22.000"
- No 3D badge

Card 3 — "Matcha Latte":
- Green matcha drink photo
- Price: "Rp 32.000"
- "LIHAT 3D" badge: YES

Card 4 — "Nasi Goreng Kampung":
- Indonesian fried rice photo
- Price: "Rp 35.000"
- No badge

Card styling: 16px full radius, #FDFDFD fill, 1px #CFD9E4 border, shadow 0 4px 14px rgba(2,44,96,0.07). Image height 130px.

BOTTOM NAVIGATION (fixed bottom, midnight navy #002355, 64px):
- 3 items: Home (active, orange icon + small orange dot above), Menu, Search
- Active icon: orange (#F05A22). Inactive: white.
- Labels: Poppins 10px below each icon
- No more than 3 nav items — keep it simple for web app

NO emojis. NO Inter font. NO 3-column grid. Left-align all text. Food photography leads.
```

---

## STEP 4 — SCREEN 2: DISH DETAIL PAGE

Device: **MOBILE** | Model: **GEMINI 2.0 PRO**

```
3Diner Dish Detail Page for "Kopi Susu Senja". Mobile 375px. Paper white (#F6F8FB). Scrollable.

HERO IMAGE (top, full-bleed):
- Beautiful latte art coffee food photography — full 375px width, 280px height, no border-radius (edge-to-edge)
- Dark gradient overlay at bottom 40px only
- Top-left: back arrow button — 36px circle, midnight navy 50% opacity, white back arrow icon
- Top-right: share button — 36px circle, midnight navy 50% opacity, white share icon
- Bottom-left on image: "LIHAT 3D" badge pill — orange-blush fill (#FDE8DC), orange text (#F05A22), Poppins 10px uppercase, floating on the photo

CONTENT SECTION (below hero, white surface, 16px padding):
- Dish name: "Kopi Susu Senja" — Poppins 800 26px deep navy (#022C60), 20px top padding
- Row: category chip "KOPI" (#E0E7EE fill, muted navy 11px uppercase) + star rating "4.8 ★" small orange star, 12px muted navy. Space between.
- Price: "Rp 28.000" — Poppins 700 22px orange (#F05A22), 10px margin top
- Divider: 1px #CFD9E4, 16px vertical margin
- Section label: "Tentang Hidangan" — Poppins 600 14px deep navy
- Description: "Espresso premium yang dipadukan dengan susu segar pilihan, menghasilkan cita rasa yang kaya dan lembut. Cocok untuk menemani sore hari kamu di Senja Kopi." — Poppins 400 14px muted navy (#51698F), 1.6 line-height
- Tags row (16px margin top): "Susu Segar" and "Espresso" — small pills, #E0E7EE fill, muted navy text 12px

STICKY CTA BAR (fixed bottom, above safe area):
- Background: #FDFDFD pure white, 1px top border #CFD9E4, 16px horizontal padding, 12px vertical
- Two buttons side by side:
  Left button (ghost): "Lihat 3D" — 1px navy border #022C60, navy text Poppins 600 14px, 18px radius, 52px height, flex 1
  Right button (primary): "Pesan Sekarang" — orange fill #F05A22, white text Poppins 600 14px, 18px radius, 52px height, flex 1.5 (wider)
- 12px gap between buttons
- Below buttons: "Akan diarahkan ke layanan eksternal" — Poppins 10px muted navy, center

No bottom navigation on this screen. Back button = navigation. NO emojis. NO Inter.
```

---

## STEP 5 — SCREEN 3: 3D VIEWER PAGE

Device: **MOBILE** | Model: **GEMINI 2.0 PRO**

```
3Diner 3D Viewer — immersive dark screen for "Kopi Susu Senja". Mobile 375px, full-screen. Dark theme only — deep navy to midnight navy gradient background.

BACKGROUND: Full-screen deep navy (#022C60) to midnight navy (#002355) gradient. Dark, premium, like a hologram display. Add very subtle hexagonal grid pattern in navy-soft (#254473) at 8% opacity suggesting spatial depth.

TOP BAR (56px, minimal overlay):
- Semi-transparent dark strip
- Left: back arrow circle (36px, white at 15% fill, white icon)
- Center: "Kopi Susu Senja" — Poppins 600 16px white
- Right: share icon circle (same style)

3D VIEWPORT (center 65% of screen height):
- Dark canvas
- Center: stylized 3D render of a latte coffee cup — floating, slightly angled, warm ambient light from upper-left
- Soft shadow below the cup suggesting ground plane (faint oval)
- Around the cup: subtle dotted orbit ring in muted navy suggesting drag-to-rotate interaction
- Two floating gesture hints at low opacity:
  "Seret untuk putar" with rotate icon — Poppins 11px white 50% opacity
  "Cubit untuk zoom" with pinch icon — Poppins 11px white 50% opacity

BOTTOM CONTROL PANEL (fixed bottom, 120px):
- Background: #002355 at 88% opacity, backdrop blur
- Top row: "Kopi Susu Senja" (Poppins 600 14px white, left) + "Rp 28.000" (Poppins 700 14px orange #F05A22, right)
- Middle row: 3 centered icon buttons (32px each, white, 44px tap target, 20px gap):
  Reset rotation | Scale | Lighting toggle
- Primary button: "Mode AR" — orange fill #F05A22, white text Poppins 600 14px, 52px height, 18px radius, full-width minus 24px margin
- Footer note: "Pindai ruang sekitar untuk Mode AR" — Poppins 11px white 45% opacity, centered

NO bottom nav. Dark theme throughout. NO emojis. NO Inter.
```

---

## STEP 6 — SCREEN 4: AR MODE

Device: **MOBILE** | Model: **GEMINI 2.0 PRO**

```
3Diner AR Mode — augmented reality screen. Mobile 375px, full-screen camera passthrough. This is the "wow moment" of the app.

BACKGROUND: Camera view passthrough — point-of-view shot of a real cafe wooden table surface with warm ambient cafe lighting and soft bokeh background. The table is empty. This simulates what the phone camera sees.

3D MODEL PLACEMENT: In the center-lower area of the camera view, a realistic 3D latte coffee cup sits convincingly ON the table surface. The cup has proper environmental lighting matching the cafe warmth. Soft oval shadow beneath. The cup looks physically real — this is the core AR experience.

TOP UI (minimal overlay):
- Top center: pill badge "AR Aktif" — small green pulsing dot + text "AR Aktif" Poppins 12px white, midnight navy 70% opacity background, 8px/16px padding, 99px radius
- Top left: X close button — 40px circle, midnight navy 60% opacity

SURFACE SCAN INDICATOR:
- A thin orange scan line (#F05A22) sweeping slowly across the lower third of the screen, indicating surface/plane detection in progress

GUIDANCE TEXT (floating above bottom panel):
"Ketuk meja untuk meletakkan hidangan" — Poppins 12px white 70% opacity, centered, no background

BOTTOM PANEL (fixed, 100px, midnight navy 80% opacity, backdrop blur):
- Info row: "Kopi Susu Senja" (Poppins 600 14px white) + "Rp 28.000" (Poppins 700 14px orange #F05A22)
- Icon buttons row (centered, 40px diameter circles at midnight navy 40% opacity):
  Camera/photo capture icon + label "Foto" (Poppins 10px white)
  Resize icon + label "Ukuran" (Poppins 10px white)
  32px gap between

Minimal UI — camera and 3D model are the heroes. NO bottom nav. NO emojis.
```

---

## STEP 7 — SCREEN 5: SEARCH RESULTS

Device: **MOBILE** | Model: **GEMINI 2.0 PRO**

```
3Diner Search Results — user searched "kopi" within Senja Kopi cafe menu. Mobile 375px. Paper white (#F6F8FB).

STICKY HEADER (16px padding):
- Back arrow left (44px tap target)
- Active search input in header: pill shape, 48px height, #E0E7EE fill
  Shows text "kopi" in Poppins 14px deep navy with orange focus ring 2px
  Clear X button right side of input

RESULTS COUNT (below header, 16px left padding, 12px top margin):
"3 hasil untuk "kopi"" — Poppins 400 12px muted navy (#51698F)

SEARCH RESULTS LIST (vertical single-column stack, NOT grid):
Each result: horizontal card, full-width minus 32px margin, 80px height, white fill, 1px #CFD9E4 border, 12px radius, soft navy shadow.

Card layout:
- Left: food photo 80×80px, 10px radius
- Right (12px left padding, flex column justify-center):
  Dish name: Poppins 600 14px deep navy
  Cafe name: Poppins 400 12px muted navy
  Price row: Poppins 700 13px orange (#F05A22) + optional "LIHAT 3D" pill badge (#FDE8DC fill, orange text, 10px) if applicable

Result 1: "Kopi Susu Senja" | "Senja Kopi" | "Rp 28.000" | HAS 3D badge
Result 2: "Americano Hitam" | "Senja Kopi" | "Rp 20.000" | no badge
Result 3: "Cappuccino" | "Senja Kopi" | "Rp 25.000" | HAS 3D badge

BOTTOM OF LIST (16px margin top):
"Tidak menemukan yang kamu cari? " (Poppins 12px muted navy) + "Lihat semua menu" (Poppins 12px orange #F05A22, inline link) — center-aligned

BOTTOM NAV: midnight navy #002355, 64px. "Search" active (orange dot + orange icon). Home and Menu white.

VERTICAL LIST — NOT 2-column grid. Search results scannable as list. NO emojis. NO Inter.
```

---

## STEP 8 — SCREEN 6: EMPTY STATE

Device: **MOBILE** | Model: **GEMINI 2.0 PRO**

```
3Diner Empty State — cafe not found or invalid QR code. Mobile 375px. Paper white (#F6F8FB) background. Full-height screen.

HEADER (minimal):
- Center: "3Diner" wordmark — 3Diner cube logo icon (24px) + "3Diner" text Poppins 700 18px deep navy (#022C60)
- No back button (user arrived via bad QR, nowhere to go)
- 1px bottom border #CFD9E4

MAIN CONTENT (vertically centered in remaining height):
Illustration (centered, 160×160px area):
A premium boutique line-art illustration — a stylized QR code with a question mark (?) overlaid on it. Deep navy (#022C60) line-art with orange (#F05A22) accent on the question mark detail. Clean, minimal, professional. Neutral — not a sad face. No generic error icon.

TEXT BLOCK (left-aligned, 16px horizontal padding, 24px top margin from illustration):
Headline: "Cafe Tidak Ditemukan" — Poppins 800 24px deep navy (#022C60)
Subtext (12px top margin): "Pastikan kamu scan QR yang benar dari meja cafe, atau minta bantuan staff." — Poppins 400 14px muted navy (#51698F), 1.6 line-height

ACTIONS (20px top margin, left-aligned with 16px padding):
Primary text link: "Coba Scan Lagi" — Poppins 600 14px orange (#F05A22), no underline at rest
Ghost button (12px top margin): "Hubungi Staff" — 1px #CFD9E4 border, navy text Poppins 500 14px, 44px height, 99px radius, full-width minus 32px margin

FOOTER (32px above bottom safe area):
"Powered by 3Diner" — Poppins 11px muted navy, centered

Composed, not pitying. Premium, minimal. NO emojis. NO Inter. NO pure black.
```

---

## TIPS PROMPTING DI STITCH

1. **Upload brand assets DULU** sebelum generate screen — Stitch akan pakai sebagai referensi visual
2. **Generate satu per satu** — jangan paralel, tunggu satu selesai baru prompt berikutnya
3. **Kalau hasilnya kurang memuaskan** — gunakan fitur "Edit Screen" di Stitch dengan prompt spesifik seperti: *"Make the food photography larger. Ensure the price text is bold and orange. Remove any emojis."*
4. **Untuk 3D Viewer dan AR Mode** — Stitch akan generate HTML dengan Three.js/WebGL. Pastikan pilih model `GEMINI 2.0 PRO` untuk screen kompleks ini.
5. **Setelah semua screen selesai** — download HTML code tiap screen dari Stitch untuk diimplementasi ke Next.js

---

## URUTAN GENERATE

| Order | Screen | Estimasi |
|-------|--------|----------|
| 1 | Cafe Home Page | ~3-4 menit |
| 2 | Dish Detail | ~2-3 menit |
| 3 | 3D Viewer | ~3-4 menit |
| 4 | AR Mode | ~3-4 menit |
| 5 | Search Results | ~2-3 menit |
| 6 | Empty State | ~1-2 menit |
