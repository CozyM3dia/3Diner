# Stitch Prompt — 3Diner Admin Dashboard (Full Redesign)

Paste prompt di bawah ke **Google Stitch** (mode: Web / Desktop, lalu generate Mobile variant). Buat tiap screen sebagai layar terpisah dalam satu project agar design system konsisten.

---

## MASTER PROMPT (paste ini dulu — set tone & design system)

```
Design a premium dark-mode admin dashboard for "3Diner" — a 3D/AR smart-menu
platform for cafes & restaurants in Indonesia. The owner uses this dashboard at
their cafe (often late, dim room) to track engagement, manage menus, and handle
live orders. Language: Bahasa Indonesia.

BRAND & THEME
- Dark mode only. Deep navy-black canvas, NOT pure black.
- Background #060E1B, panels #0D1829, inputs/raised #132136, hairline borders rgba(255,255,255,0.07).
- Text primary #E9EEF6, muted #5A7898, secondary #9FB6D1.
- Primary accent orange #FD5002 (CTAs, active state, key metric).
- Secondary accent teal #00C2A8 (3D / positive). Success #22D3A6, warning #F59E0B, danger #EF4444.
- Rounded corners: 16px panels, 12px controls. Generous padding. Calm, high-signal, fintech-grade.
- Typography: Poppins (display + body). Bold headings, tabular-nums for numbers.
- Flat surfaces, NO heavy gradients, NO glassmorphism, NO gradient text. One accent at a time.
- Subtle depth via 1px borders + slight elevation, not big shadows.

LAYOUT SYSTEM
- Left fixed sidebar (240px): cafe logo + name + "Dashboard" label on top; vertical
  nav with icon+label; active item has orange tint pill; bottom has "Lihat Menu" + "Keluar".
- Nav items: Analitik, Penjualan, Pesanan, Menu, Pengumuman, Jadwal & Diskon, Pengaturan.
- Main content: max-width ~1400px, comfortable density, section labels in small uppercase muted text.
- Mobile: sidebar collapses to a hamburger drawer.

Make it feel like a polished real product (Linear / Vercel / Stripe quality), not a template.
Avoid generic SaaS clichés and identical card grids — vary card sizes and layouts per section.
```

---

## SCREEN 1 — Analitik (halaman utama)

```
Screen: "Analitik" — engagement analytics, 14-day window.

Top: hero header with a small sparkle icon + "Ringkasan 14 hari · [Cafe Name]",
big title "Analitik", subline "3.482 total interaksi · rata-rata 248/hari", and a
one-line contextual tip in muted text.

Insight strip (horizontal, scrollable): 4 compact tiles, each = colored icon chip +
small label + value: "Jam tersibuk 14.00", "Hari teramai Sabtu", "Menu paling dilirik
Pasta Meatball", "Konversi terbaik Wagyu Burger · 22%". Distinct accent per tile.

Row of 4 stat cards (NOT the big-number-gradient cliché): each card = large number
top-left, small colored icon chip top-right, label below, and a small trend row
(green up-arrow "+12% vs minggu lalu"). Cards: Tampilan Menu, Lihat Model 3D,
Mulai Pesan, Konversi ke Pesan (18%).

Next row (2/3 + 1/3): left = "Aktivitas Harian" line/area chart (orange line, soft
gradient fill, 14 points, dot on last); right = "Corong Engagement" funnel of 3
horizontal bars (Buka Menu → Lihat 3D → Mulai Pesan) with drop-off %, plus a short
explanatory sentence.

Next row (2/3 + 1/3): left = "Jam Tersibuk" 24-cell hourly heatmap (orange intensity,
brightest = peak); right = "Per Hari" weekday bar chart Sen–Min (peak day in orange,
rest teal).

Bottom row (3 columns): "Komposisi Interaksi" donut (3 segments + legend %),
"Menu Terpopuler" ranked compact list with thin progress bars, "Aktivitas Terbaru"
timeline feed with colored dots + relative time.
```

---

## SCREEN 2 — Penjualan (Revenue)

```
Screen: "Penjualan" — revenue analytics from orders, 14-day window.

4 stat cards: Total Pendapatan "Rp 4.250.000" (+ green delta), Jumlah Pesanan,
Rata-rata/Pesanan "Rp 92.000", Item Terjual. Currency in tabular-nums.

Row (2/3 + 1/3): left = "Pendapatan Harian" vertical bar chart in rupiah (orange bars,
last bar brightest, hover shows exact Rp); right = "Status Pesanan" donut
(Baru orange / Diproses amber / Siap teal).

Bottom row (2/3 + 1/3): left = "Menu Penyumbang Pendapatan" ranked list (#, name,
thin teal progress bar, "12× · Rp 540.000"); right = "Pesanan Terbaru" feed
("Meja 4 · Rp 86.000", relative time, status dot).
```

---

## SCREEN 3 — Pesanan (Live Orders)

```
Screen: "Pesanan" — real-time order management.

Header "Pesanan" + subline "Pesanan masuk diperbarui otomatis".
Filter tab pills: Semua / Baru / Diproses / Siap, each with a count badge; active pill
has orange tint.

Grid of order cards (2 columns desktop, 1 mobile). Each card:
- top: "Meja 4" bold + order code muted + relative time; status pill top-right
  (Baru=orange, Diproses=amber, Siap=teal) with small icon.
- middle: itemized list "2× Pasta Meatball ........ Rp 90.000".
- footer divider, total bold left, action button right: orange "Mulai Proses"
  (received) → amber "Tandai Siap" (preparing) → teal "Selesai" check (ready).
Include an empty state (icon + "Belum ada pesanan").
```

---

## SCREEN 4 — Menu (list + form)

```
Two screens.

4a "Menu" list: header + orange "Tambah Menu" button. Dark table: thumbnail, nama,
kategori pill, harga, "3D" teal tag, status (teal dot Aktif / grey Nonaktif),
"Edit" button per row. Empty state with CTA.

4b "Tambah/Edit Menu" form (single column, ~640px, grouped panels):
- Panel "Dasar": nama, harga, kategori, deskripsi (textarea), waktu saji, kalori,
  bahan (comma).
- Panel "Media & 3D": THREE drag-and-drop upload zones (dashed border, cloud-upload
  icon, "Tarik file ke sini atau pilih", size hint). One for Foto (shows image
  thumbnail preview when filled), one for Model 3D .glb, one for Model iOS .usdz
  (filled state = file chip with 3D box icon + filename + "Ganti"/remove). Plus a
  "Link Pesan" text input.
- Panel "Ketersediaan": toggle "Tampilkan di menu", diskon % input, weekday selector
  chips (Sen–Min), jam mulai/selesai time pickers.
- Footer: orange "Simpan Perubahan" + ghost red "Hapus".
Inputs: #132136 fill, subtle border, orange focus ring.
```

---

## SCREEN 5 — Pengumuman

```
Screen: "Pengumuman" — real-time banner editor.
Live preview banner on top (colored bar with megaphone icon + message text).
Form panel: message textarea (max 120, counter), color preset swatches (orange/navy/
teal/red/black), toggle "Aktifkan pengumuman" with helper text, orange "Simpan" button.
```

---

## SCREEN 6 — Jadwal & Diskon

```
Screen: "Jadwal & Diskon" — per-menu availability.
List of menu rows, each a panel: menu name + active toggle (top-right), then a row of
controls: weekday chips (S S R K J S M), jam mulai/selesai time pickers, diskon %
input with % suffix. A "Simpan" button appears on the row when changed.
```

---

## SCREEN 7 — Pengaturan Kafe

```
Screen: "Pengaturan Kafe" — subline "Profil yang tampil di halaman menu pelanggan".
Panel "Identitas": Nama Kafe, Alamat, Sapaan/Tagline.
Panel "Tampilan & Tautan": Logo upload, Cover photo upload, URL Ulasan Google Maps.
Orange "Simpan Perubahan" with success state.
```

---

## NOTES untuk implementasi setelah generate

- Stitch hasilnya = HTML/CSS referensi visual. Pakai sebagai acuan, lalu adaptasi ke
  komponen React yang sudah ada (`src/components/dashboard/*`) — jangan ganti total,
  ambil ide layout/spacing/hierarki.
- Pertahankan token warna persis seperti di prompt (sudah = sistem live).
- Charts di app pakai pure-SVG sendiri; dari Stitch ambil komposisi & label-nya saja.
- Export design tokens Stitch bisa dibandingkan dengan `globals.css` layer `.dash-*`.
```
