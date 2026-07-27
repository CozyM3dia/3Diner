# Review Dashboard 3Diner — 2026-07-27

**Ruang lingkup:** `App/src/app/dashboard/**` (19 file) + `App/src/components/dashboard/**` (43 file) = 8.829 baris.
**Branch:** `feature/payment-credits-variants` (4 commit di depan `main`, belum ada PR).
**Gate saat review:** `tsc --noEmit` 0 error · **219/219 test lulus** (31 file, 9.05s).

Metode: baca kode + hitung ulang rasio kontras WCAG dari nilai token di `globals.css`.
Belum ada verifikasi browser (butuh login owner).

---

## 1. Kondisi umum

Fondasinya sehat dan tidak perlu dibongkar.

| Aspek | Nilai | Bukti |
|---|---|---|
| Data layer | Kuat | `getDashboardCafeContext()` `cache()` — 1 auth + 1 lookup Cafes per request, dipakai layout + 9 page tanpa kecuali |
| Design system | Ada, tapi belum dipatuhi | `system/` punya 12 ekspor; hanya sebagian halaman memakainya |
| Portal token | Benar | 5 primitive shadcn punya passthrough `container`, `#dash-portal-root` bawa token |
| Test | Hijau | 219/219 |
| Tipe | Bersih | 0 error |
| Utang UI | **Sedang–tinggi** | 166 titik warna hardcode, 12 ukuran font arbitrer, 5 lebar container berbeda |

Masalahnya bukan arsitektur. Masalahnya **sistem desain sudah dibuat tapi tidak ditegakkan** — dan satu token warna gagal WCAG di hampir semua teks kecil.

---

## 2. Temuan (urut dampak)

### A. `--dash-muted` gagal kontras WCAG AA — sistemik

Hitung ulang dari nilai token di `globals.css:37-44`:

| Foreground | Background | Rasio | Perlu | Status |
|---|---|---|---|---|
| `--dash-muted` `#5A7898` | `--dash-panel` `#0D1829` | **3.86** | 4.5 | GAGAL |
| `--dash-muted` `#5A7898` | `--dash-canvas` `#060E1B` | **4.17** | 4.5 | GAGAL |
| `StatusBadge` `inv-none` `#41557A` | `--dash-panel` | **2.38** | 4.5 | GAGAL berat |
| `#FFFFFF` di `--orange` `#FD5002` | — | **3.34** | 4.5 | GAGAL |
| `--dash-secondary` `#9FB6D1` | `--dash-panel` | 8.58 | 4.5 | lulus |
| `--semantic-success` `#22D3A6` | `--dash-panel` | 9.32 | 4.5 | lulus |
| `--orange` `#FD5002` (teks) | `--dash-panel` | 5.36 | 4.5 | lulus |

Skala masalahnya:

- `var(--dash-muted)` dipakai **83×**, literal `#5A7898` dipakai **83×** lagi di 28 file → **±166 titik**.
- Ini warna hampir semua caption, label KPI, eyebrow, sublabel, hint empty-state, dan sumbu chart.
- Diperparah ukuran: `text-[11px]` **78×**, `text-[10px]` 17×, `text-[9px]` 5×, `text-[8px]` 1×.
  Teks 11px pada 3.86:1 adalah kombinasi terburuk yang mungkin.
- Tombol CTA oranye + teks putih ada **8 titik** (`DashboardShell`, `/dashboard`, `/dashboard/menu`, dll).
  Codebase sudah punya jawabannya — `--orange-ink` `#C23B00` dibuat persis untuk kasus ini.

**Arah perbaikan.** Naikkan `--dash-muted` sampai lulus di kedua background.
Kandidat `#6E88A8` → 4.88 di panel, 5.27 di canvas. Satu baris di `globals.css`
membereskan 83 titik `var()`; 83 literal `#5A7898` harus diganti jadi `var(--dash-muted)`
dulu supaya ikut terbawa. `inv-none` butuh warna sendiri (naikkan minimal ke `#7E8FA8`+).

### B. Tiga `<h1>` per halaman

- `DashboardShell.tsx:216` — app bar merender `<h1>` berisi label nav aktif, di **setiap** route.
- `DashboardPageHeader.tsx:20` — page header merender `<h1>` lagi.
- `InventoryWorkspace.tsx:37` — saat `embedded`, merender `<h1>` "Inventory" **ketiga** di `/dashboard`.

Jadi setiap halaman dashboard punya 2 `h1`, dan `/dashboard` punya 3.
Struktur heading rusak untuk screen reader; tidak ada satu pun judul dokumen yang jelas.

Perbaikan: app bar → `<p>`/`<div>` (itu breadcrumb, bukan judul); `InventoryWorkspace` embedded → `<h2>`.

### C. Shell halaman tidak konsisten

| Route | Lebar container | Padding | Header |
|---|---|---|---|
| `/dashboard` | `1400px` | `p-4 lg:p-6` | `DashboardPageHeader` |
| `/dashboard/revenue` | `1400px` | `p-4 lg:p-6` | `DashboardPageHeader` |
| `/dashboard/inventory` | `1180px` | **`p-5 lg:p-8`** | tidak ada (didelegasikan) |
| `/dashboard/orders` | `1100px` | `p-4 lg:p-6` | **hand-rolled** |
| `/dashboard/menu` | `1100px` | `p-4 lg:p-6` | **hand-rolled** |
| `/dashboard/settings` | `max-w-5xl` (1024) | `p-4 lg:p-6` | **hand-rolled** |
| `/dashboard/announcements` | `max-w-5xl` | `p-4 lg:p-6` | `DashboardPageHeader` |
| `/dashboard/scheduler` | `max-w-3xl` (768) | `p-4 lg:p-6` | `DashboardPageHeader` |
| `/dashboard/menu/new` · `/[id]/edit` | `max-w-3xl` | `p-4 lg:p-6` | **`<h1>` polos, `text-2xl`, `#E9EEF6` hardcode** |

Lima lebar berbeda tanpa aturan. Judul halaman berukuran **22px** di 5 route dan **24px** di 3 route.
Hanya 4 dari 9 route memakai `DashboardPageHeader`; sisanya menyalin ulang markup-nya
(kehilangan slot `eyebrow` dan `actions` yang sudah disediakan).

### D. `InventoryWorkspace` melewati design system sepenuhnya

`src/components/dashboard/InventoryWorkspace.tsx` — satu-satunya komponen besar yang belum di-rebase:

- Warna hardcode: `#5A7898`, `#E9EEF6`, `#9FB6D1`, `#132136`, `#0D1829`, `#FCA5A5` — tidak satu pun lewat token.
- Error state sendiri (`InventoryLoadError`, baris 98-125) padahal `DashboardErrorState` ada dan bentuknya nyaris identik.
- `rounded-2xl` + `border` manual, bukan `.dash-panel`.
- Header sendiri (eyebrow + h1 + sub), bukan `DashboardPageHeader`.

### E. `DashboardMetric` menampilkan **0** sampai di-scroll

`system/DashboardMetric.tsx:24-40` — `useCountUp` mulai dari `0` dan hanya jalan saat
`IntersectionObserver` (threshold **0.4**) menembak.

Akibat:
1. First paint setiap KPI = `Rp 0` / `0`. Kalau JS lambat atau gagal, owner melihat omzet nol.
2. KPI di bawah lipatan tetap `0` sampai di-scroll — screenshot atau print halaman menangkap nol.
3. `prefers-reduced-motion` tidak dihormati. `globals.css:521` mematikan `.dash-reveal`,
   tapi count-up ini JS murni dan tetap jalan.

Perbaikan minimal: inisialisasi `n = value` lalu animasikan hanya jika observer menembak
**dan** `matchMedia("(prefers-reduced-motion: reduce)")` false.

### F. `/dashboard` terlalu padat, dan menduplikasi `/dashboard/inventory`

Satu route memuat: 6 KPI → insight strip → 2 panel → 2 panel → 3 panel →
`InventoryWorkspace` penuh (4 KPI lagi + kartu kritis + tabel inventory lengkap).

- **10 kartu KPI** dalam satu halaman.
- Di mobile (`grid-cols-2`) itu 5 baris KPI sebelum chart pertama muncul.
- Di `xl` KPI grid dipaksa **6 kolom** — `Rp 1.250.000` pada 26px di kolom ~200px akan mepet/wrap.
- Isi `/dashboard/inventory` = subset persis dari blok embedded → konten sama muncul di dua entri nav.

### G. Duplikasi kode kecil tapi menyebar

| Duplikat | Lokasi |
|---|---|
| `relTime()` | `dashboard/page.tsx:42` **dan** `revenue/page.tsx:22` — identik |
| `STATUS_KIND` map | `revenue/page.tsx:31` **dan** `OrdersClient.tsx:103` |
| Markup tombol CTA oranye | 8× disalin (`dash-btn ... background: var(--orange), height: 38px`) padahal `ui/button.tsx` ada |

### H. Tipografi tanpa skala

Dashboard memakai **12 ukuran font arbitrer**: 8, 9, 10, 11, 12, 13, 15, 19, 20, 21, 22, 26 px.
Tidak ada skala modular — persis keluhan yang sama dengan audit customer 2.2.
`text-[11px]` justru ukuran **paling sering** (78×), padahal itu ukuran caption.

`--font-display` = `--font-body` = Poppins (`globals.css:130-131`). Class `.font-display`
tidak menghasilkan kontras tipografis apa pun — hierarki hanya bergantung pada ukuran dan berat.

### I. Orders: `.limit(60)` hardcode, tanpa paginasi

`src/app/dashboard/orders/page.tsx:14` mengambil 60 pesanan terakhir, titik.
Tidak ada paginasi, filter tanggal, atau "muat lebih". Kafe ramai kehilangan riwayat
setelah 60 order, dan tidak ada cara mencari pesanan lama dari dashboard.

### J. Target sentuh di bawah 44px

Hanya 12 titik di seluruh dashboard yang menyebut 44px. Baris nav sidebar `38px`,
seluruh CTA oranye `height: 38px`. Dashboard memang desktop-first, tapi drawer mobile ada
dan owner kafe sering buka dari HP di lantai.

---

## 3. Yang sudah benar — jangan diutak-atik

- `getDashboardCafeContext()` sebagai satu-satunya jalur auth+cafe. Setiap page baru wajib pakai ini.
- Aturan portal token (`getDashPortal()` + `container` passthrough di 5 primitive). Konsisten 100%.
- `StatusBadge` — dot + label, makna tidak pernah disampaikan lewat warna saja. Vocabulary-nya benar.
- `ResponsiveDataView` — kontrak a11y-nya dipikirkan serius (hanya cabang aktif ter-mount, idPrefix anti-duplikat).
- `loading.tsx` per route + prefetch nav di `DashboardShell`. Navigasi terasa instan.
- `AiCreditMeter` — warna hanya berubah saat ada yang harus dikerjakan. Pola yang tepat.
- Semantik `escapeHtml` di struk/laporan + 2 test penjaga.

---

## 4. Urutan perbaikan yang disarankan

1. **Kontras** (A) — naikkan `--dash-muted`, ganti 83 literal `#5A7898` jadi token, perbaiki `inv-none`,
   pakai `--orange-ink` untuk 8 CTA putih-di-oranye. Dampak terbesar, risiko terendah, satu sapuan.
2. **Struktur heading** (B) — app bar bukan `h1`, `InventoryWorkspace` embedded jadi `h2`. Tiga baris.
3. **Shell konsisten** (C) — tetapkan satu lebar per kelas halaman (analitik lebar / kerja sedang / form sempit),
   satu padding, dan wajibkan `DashboardPageHeader` di 9 route.
4. **Rebase `InventoryWorkspace`** (D) ke system layer — komponen terakhir yang belum ikut.
5. **`DashboardMetric` jujur** (E) — nilai benar dari first paint, animasi hanya bonus.
6. **Rampingkan `/dashboard`** (F) — putuskan: inventory tetap embedded penuh, atau tinggal ringkasan + CTA.
7. **Skala tipe** (H) — tetapkan 6-7 langkah, hapus semua di bawah 11px, ganti `text-[11px]` massal.
8. **Dedupe** (G) — `relTime` dan `STATUS_KIND` ke `lib/`, CTA oranye jadi varian `Button`.
9. **Paginasi orders** (I).
10. **Target sentuh** (J) — nav dan CTA ke 44px di viewport sentuh.

---

## 5. Batas review ini

- **Tidak ada verifikasi visual.** Browser pane tidak dijalankan; QA dashboard butuh login owner
  dan Claude tidak boleh mengisi password. Semua angka kontras dihitung dari nilai token, bukan
  dari `getComputedStyle` di halaman hidup — nilai efektif bisa berbeda kalau ada overlay/gradient.
- **Perilaku runtime tidak diuji** — realtime orders, drag-drop urutan menu, upload signed URL,
  generate Tripo, dan alur QRIS tidak dijalankan.
- **Halaman form** (`MenuForm` 527 baris, `SettingsForm`, `AnnouncementForm`) hanya dibaca sekilas.
- Temuan A dan C bisa dikonfirmasi ulang lewat sesi browser bersama user setelah login.
