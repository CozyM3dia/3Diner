# 3Diner Customer Checkout Design

## Direction

The customer checkout is a calm, mobile-first table-order flow. It should feel like the final page of a well-made cafe menu: warm while editing, precise at commitment, and quiet after submission. The interface uses familiar controls and explicit consequences rather than decorative checkout theatre.

## Workflow

1. **Pesananmu** — edit items, quantities, table, and notes in one continuous page.
2. **Konfirmasi & bayar** — lock the order summary, show the canonical server quote and its tax/service breakdown, choose QRIS or cashier with native radios, and commit with a channel-specific action.
3. **Payment/status route** — preserve token navigation and show the selected payment action immediately. Loading, transient error, missing, active, completed, and cancelled states are distinct.

Do not render a three-step progress rail. Completion lives on the order route, not inside checkout.

## Visual System

- Canvas: `#F6F4EF` paper; grouped surfaces: `#FFFDF8`; primary text: `#082B52`; muted text: `#52677D`; borders: `#D8DFE6`.
- Accent: use orange for selection and emphasis. Filled primary actions use navy text on warm orange or a darker AA-compliant orange with white.
- Typography: Poppins. Page title 24/30, section title 18/24, body 14/21, metadata 12/18. No essential 10px copy.
- Spacing scale: 4, 8, 12, 16, 24, 32. Mobile gutter 16px; content max-width 560px.
- Radii: 12px controls, 16px single confirmation surface. Avoid stacking many elevated cards.
- Elevation: only the confirmation/payment surface and sticky commit bar may use subtle elevation.
- Controls: 44px minimum target; quantity controls are not cramped; native radios preserve arrow-key behavior.
- Motion: 120–180ms opacity or 4px translation only. Disable under reduced motion.

## Component Rules

- One page heading, one primary action, and one authoritative total per stage.
- Item editing uses flat rows and dividers. Variants and item notes remain visible.
- The commit bar always repeats table, canonical total, and the selected consequence.
- QRIS copy says “QRIS” and the final button says “Kirim & tampilkan QRIS”. Cashier copy says “Bayar di kasir” and “Kirim & tampilkan kode kasir”.
- Inline errors use `role="alert"`; stage headings receive focus after transitions; the first invalid field receives focus on validation failure.
- Offline and stock failures preserve cart, table, notes, payment choice, and stage.

## Responsive Contract

- At 375px, item rows use `64px minmax(0, 1fr)` and move quantity controls below details when needed.
- No horizontal scrolling at 375px or 430px.
- Sticky bars respect safe-area insets and never cover the last form content.
- Desktop retains the same reading order in a centered column; it does not become a dashboard grid.

## Anti-patterns

- No ornamental gradients, sheen animations, decorative progress rail, urgency pulse, generic card soup, repeated summaries, ambiguous “Kirim pesanan” copy, or orange buttons with failing white-text contrast.

---

# Owner Console Design (dashboard-v2)

Ditambahkan 26 Aug 2026 (Phase 0 rebuild dashboard) supaya cakupan dokumen ini tidak berhenti di checkout. Rujukan nilai warna/typography/radius: `brand/UI_TOKENS.md`.

## Direction

Konsol owner adalah ruang kerja gelap yang operasional-first: menjawab "apa yang terjadi, apa yang butuh tindakan saya" dalam hitungan detik. Data-dense tetapi premium — hierarchy dari surface layering (`--dash-canvas → panel → raised`) dan whitespace, bukan dari border dan shadow di setiap kartu. Angka memakai tabular figures; lebar konten desktop dibatasi ±1.200–1.440px.

## Token Contract

- Satu-satunya sumber warna: 11 token `--dash-*` + `--semantic-*` + `--orange*`/`--navy*` brand di `globals.css`. **Tidak ada hex baru di file komponen** (gate Phase 0).
- Skala bersama baru, prefiks `--dv2-*`: spacing 4–32px (`--dv2-space-1..8`), z-index lapisan (`--dv2-z-scrim/sheet`), font-size caption/body/title.
- Penamaan meneruskan keluarga `.dv2-*` yang ada — bukan lapisan token kedua. Preseden bentrok nama `.dv2-bar` vs chart bar sudah tercatat di komentar globals.css; periksa nama baru terhadapnya.

## Primitives (`src/components/dashboard-v2/primitives.tsx`)

| Primitive | Catatan perilaku |
|---|---|
| `Tabs` | label ber-counter gaya template `(48)`; counter hanya untuk angka yang bisa mencapai nol |
| `StatusPill` | pill badge (Active/Expired-style); warna lewat CSS var `--pill`, tone dari token |
| `SlideOver` | panel detail kanan; Escape/scrim/tombol tutup + focus trap via Radix |
| `EmptyState` | judul + penjelasan + satu CTA nyata; tanpa handler = tanpa tombol (bukan tombol mati) |
| `Field` | input + label terikat `htmlFor`; error `role="alert"` + `aria-invalid`; hint hanya saat valid |

Setiap kontrol wajib punya behavior nyata — anti-pola template Dream POS (link mati, filter dekoratif, pagination kosong) dilarang menular. State loading (skeleton `RouteSkeleton`), empty, error inline, disabled beralasan adalah syarat keluar tiap layar.

## Auth & Error Semantics

`StaffContext.error: true` membedakan *gagal memuat* dari *bukan staf*. Layar masuk menampilkan tiga pesan berbeda (salah kredensial / bukan staf / nonaktif / gagal periksa → coba lagi) dan tidak me-signOut saat pemeriksaan gagal. Fokus terlihat di kanvas gelap: outline oranye 2px offset 2px (`UI_TOKENS §Focus Ring`).
