# Implementation Plan — Rebuild Dashboard 3Diner

**Status:** Siap dieksekusi
**Tanggal:** 26 Agustus 2026
**Induk:** [DASHBOARD-REBUILD-PLAN.md](./DASHBOARD-REBUILD-PLAN.md) (keputusan strategis tetap mengikat)
**Basis audit:** Audit penuh 26 Aug 2026 — verifikasi repo (line counts, kontrak, test baseline 58 file), crawl browser 35 halaman Dream POS, probe perilaku interaktif, dan audit dependensi 17 komponen legacy di Lampiran A.

---

## 0. Perubahan keputusan dari hasil audit

Empat koreksi terhadap dokumen induk, plus satu keputusan baru dari owner:

### 0.1 Tripo API ditunda — UI generasi 3D tetap dirancang penuh

**Keputusan owner (26 Aug, final):** seluruh UI mengikuti template Dream POS 1:1. Untuk fitur yang **tidak punya padanan di template** (generasi model 3D, menu 3D/AR, AI workflow), UI-nya **dirancang kreatif mengikuti bahasa visual Dream POS** — terlihat utuh dan premium, bukan tombol abu-abu — namun **tanpa satu pun call ke `/api/tripo/*`**:

- **Upload manual GLB/USDZ tetap fungsional penuh** (`FileUpload` → signed URL → Storage `menu-media`, kontrak stabil, bukan bagian Tripo).
- **Alur Generate Model 3D dibuat sebagai pengalaman UI lengkap** bergaya modal "Add Item" template: field opsi (kualitas/ukuran model), estimasi biaya kredit dari `AiCreditMeter`, slot preview hasil, dan state strip `Menyiapkan → Memproses → Siap / Gagal` — semuanya ter-render. **Submit-nya disabled dengan alasan eksplisit**: `Integrasi generasi AI menyusul`. Tidak ada simulasi sukses palsu.
- **Menu 3D kreatif**: badge chip `3D` / `AR` pada kartu produk memakai gaya badge template (pill warna seperti badge Active/Expired), panel viewer `<model-viewer>` ditempatkan di dalam pola modal "Item Details" template, dan galeri model (thumbnail + tanggal + sumber upload/generate) mengikuti pola kartu Items grid.
- Ketika Tripo nanti diaktifkan: hanya handler submit + polling yang ditambahkan — modal, state strip, galeri, dan badge sudah terpasang.

Konsekuensi: risiko terbesar Phase 2 (port polling loop + credit ledger tanpa test) **hilang dari scope**, digantikan upload-only yang kontraknya stabil. Baris Lampiran A untuk `Tripo3DGenerator` → `sengaja tidak dipindahkan` (integrasi ditunda; UI-nya dirancang di atas).

### 0.1b Bahasa desain untuk fitur tanpa padanan template

Semua fitur khas 3Diner dipinjamkan ke **kosakata komponen Dream POS** supaya terasa satu produk:

| Pola template | Dipakai untuk fitur 3Diner |
|---|---|
| Modal berjudul + field wajib bertanda * + tombol Cancel/Simpan | Modal Generate 3D, wizard AI Extract, form adjustment stok |
| Badge pill warna (Active/Expired/Pending) | Chip `3D ready`, `AR ready`, `belum ada model`, status kredit |
| Kartu foto grid Items + hover action | Galeri model GLB/USDZ, kartu menu dengan indikator 3D |
| Tab ber-counter `All Orders (48)` | Tab editor Dasar/Jadwal/Varian/3D & AR/Resep, tab laporan |
| Dropdown action per baris | Quick action menu: Preview/Edit/Duplicate/Toggle |
| Notification bell + dropdown | AiCreditMeter (chip kredit di topbar) |

Aturan mutlak: elemen baru memakai token `--dash-*`/dv2 + icon treatment 3Diner, setiap state nyata punya tampilan (skeleton/empty/error inline), dan **tidak ada interaksi yang berpura-pura berhasil**.

### 0.2 Koreksi fakta repo (audit 26 Aug)

1. **Lampiran A bagian Stok basi sebagian.** `stok-actions.ts::adjustStock` v2 sudah membungkus RPC `adjust_inventory_stock` dan terpasang di StockTable. Gap stok nyata tersisa: `InventoryItemForm` (95 baris) + view riwayat movement. Baris `StockAdjustmentModal` → `selesai (sudah ada di v2)`.
2. **Token `--dv2-*` tidak exist.** globals.css memuat 177 var definisi, 11 token `--dash-*`, 136 kelas `.dv2-*` (kelas CSS, bukan token). Phase 0 inventarisasi cukup terhadap `--dash-*`.
3. **Dual-path plumbing adalah pekerjaan eksplisit Phase 2** (bukan efek samping): parametrize `revalidatePath` target legacy vs v2, retarget `router.push('/dashboard/menu')` & Link inventory, ganti `dashInputStyle`/`getDashPortal` dengan primitive dv2. Tanpa ini, halaman v2 stale setelah tiap write sampai cutover.
4. **`role:null` conflation** (`staff-context.ts:30`): RPC gagal = "bukan staf" di kode, padahal kontrak §7 menjanjikan dibedakan. Diperbaiki kecil di Phase 0 (tambah field `error` pada StaffContext), karena semua halaman v2 bergantung padanya.

---

## 1. Prinsip eksekusi

- **Recreation 1:1** komposisi, navigasi, spacing, hierarchy, cards, table, tabs, filter, modal/slide-over, responsive & state behavior — mengikuti spesifikasi UI Dream POS yang sudah diprobe langsung (kolom tabel, field modal, tombol per halaman tercantum di §3). Palette, font treatment, logo, foto, icon, bahasa, Rupiah = identitas 3Diner.
- **Fitur tanpa padanan di template** (generasi 3D, menu 3D/AR, AI workflow) **dirancang kreatif memakai bahasa visual Dream POS** — pola modal, badge pill, kartu grid, tab ber-counter yang sama (§0.1b) — sehingga seluruh konsol terasa satu produk.
- **Setiap kontrol punya behavior nyata** — pelajaran dari audit template: 69–230 link mati per halaman, pagination & filter dekoratif, detail produk mismatch. Semua bug pola itu dilarang menular; acceptance criteria induk §9 sudah melarangnya.
- **Backend tidak disentuh** kecuali item kecil §0.2.4. Semua mutasi lewat server actions/RPC yang sudah ada dan tested.
- **Test mengikuti fitur**: setiap write-path yang dipindah membawa test lib-nya sendiri (pola `tests/dashboard-v2-*.test.ts`).

## 2. Fase eksekusi (revisi dari roadmap induk)

### Phase 0 — Foundation (±2–3 hari)

| # | Pekerjaan | Detail |
|---|---|---|
| 0.a | Inventarisasi token | Tabel resmi 11 token `--dash-*` + skala spacing/z-index/typography baru **dengan penamaan dv2 yang konsisten**; dokumentasi di DESIGN.md (perluas cakupan checkout → konsol owner) |
| 0.b | Primitive bersama | Naikkan dari kelas `.dv2-*` yang ada: `Button`, `Tabs`, `DataTable` (sort/filter/pagination/loading/empty/error), `Badge/StatusPill`, `Modal/SlideOver` (Escape + focus trap), `Skeleton`, `EmptyState`, `FormField` |
| 0.c | Shell responsive | Mobile drawer + focus ring di OwnerShell; validasi 390/768/1440 |
| 0.d | Fix role:null | `staff-context.ts`: bedakan `{role:null}` (bukan staf) vs `{role:null, error}` (gagal muat) + test |
| 0.e | Guard server-only | Tambah `import 'server-only'` + fail-fast (buang fallback placeholder key) di `lib/supabase-admin.ts` |

**Gate:** tidak ada warna hardcoded di file sentuhan; typecheck+test:ci pass; keyboard nav bisa dipakai di shell.

### Phase 1 — Beranda & Pesanan (±3–4 hari)

Recreate sesuai induk §5.1–5.2. Komponen inti: KPI strip operasional, ringkasan antrean read-only (CTA ke `/kasir`), task list, activity feed; Pesanan: tabs riwayat (Semua/Selesai/Dibatalkan), filter status/payment/tipe/tanggal/search, toggle list-grid, detail dalam slide-over, cetak ulang struk, salin token.

**Gate:** tidak ada server action mutasi status order yang bisa dicapai dari `dashboard-v2` (cek kode); payment state ≠ kitchen state; semua filter/pagination benar-benar memfilter data (anti-pola template).

### Phase 2 — Menu & Stok (±6–9 hari) — fase terbesar

#### 2a. Menu grid/list + editor shell (±2 hari)
- Grid/list mode dengan foto, kategori, harga Rupiah, live/offline, stok, badge `3D ready / AR ready / belum ada model`, discount+jadwal, jumlah option group.
- Quick action per baris: preview, edit, duplicate, toggle availability — semuanya berfungsi.
- Editor tab Dasar & Jadwal/diskon lengkap (restyle MenuForm 527 → dv2; logika save via `menu-form-save.ts` yang sudah tested).

#### 2b. Varian & Resep (±2 hari)
- `MenuOptionsEditor` (438) → tab Varian: CRUD option group + option, min/max select, wajib/opsi; persist via RPC `replace_menu_options`.
- `RecipeEditor` (193) → tab Resep: draft bahan + qty + unit; persist via `replace_menu_recipes`; link stok diarahkan ke `/dashboard-v2/stok`.

#### 2c. AI extraction & detail (±1–2 hari)
- `MenuExtractor` (371): portal modal upload foto menu → `/api/menu/extract` (route tested) → review hasil → bulk create. Credit meter tampil (`AiCreditMeter` 90, data RPC `get_ai_credit_status`).
- AI detail generation inline di editor (fetch `/api/menu/generate-details`).

#### 2d. Upload media & pengalaman 3D/AR kreatif (±1.5 hari)
- `FileUpload` (178): upload foto/GLB/USDZ ke bucket `menu-media` via signed URL — fungsional penuh.
- Tab **3D & AR** sebagai pengalaman utuh bergaya template: galeri model (kartu grid + hover action), panel viewer `<model-viewer>` dalam pola modal "Item Details", badge chip `3D ready / AR ready / belum ada model`.
- **Modal Generate Model 3D** lengkap (opsi, estimasi kredit, state strip Menyiapkan→Memproses→Siap/Gagal) dengan submit disabled beralasan — §0.1. Tidak ada call `/api/tripo/*`.
- Status kolom 3D/AR di list/grid terisi otomatis dari keberadaan model.

#### 2e. Stok (±1–1.5 hari)
- Sisanya dari gap audit: `InventoryItemForm` (95) sebagai form tambah/edit bahan; riwayat `Inventory_Movements` view; low-stock highlight di atas; quick adjustment sudah ada (StockTable+adjustStock) — tinggal alasan wajib diisi jika belum.

#### Dual-path plumbing (menyertai 2a–2e, ±0.5 hari)
- Parametrize revalidatePath (helper `revalidateBoth()` atau konstanta path map) di `dashboard-actions.ts`, `menu-form-save.ts`, `menu-options.ts`, `stok-actions.ts`, `tax-actions.ts`.
- Retarget navigasi internal komponen yang dipindah ke rute v2.

**Gate:** seluruh baris Menu Lampiran A `selesai` (kecuali `Tripo3DGenerator` = `sengaja tidak dipindahkan` + alasan); tidak ada `PendingTab` tersisa; setiap fitur membawa test lib-nya; upload GLB→preview→AR jalan end-to-end dengan model manual.

### Phase 3 — Promo, Laporan, Pengaturan (±4–5 hari)

- **Promo**: tabel diskon terjadwal (SchedulerClient 449 restyle) + announcement/campaign (AnnouncementForm 299, daftar read-only → form aktif). Coupon: **tidak ditampilkan sama sekali** (induk §5.5).
- **Laporan**: tabs Penjualan/Tamu/Menu/Pajak/Payment; naikkan chart dari BarSeries → LineChart, DonutChart, FunnelBars, HeatmapGrid (~515 baris port + restyle); DateRangePicker (405); ExportReport (258) export CSV; definisi metrik tertulis di tiap tab.
- **Pengaturan**: task-based sections (induk §5.7); `QrSmartMenu` (486) pindah utuh; SettingsForm sisanya; section tanpa backend → label `Belum dikonfigurasi`.

**Gate:** baris Promo/Laporan/Pengaturan Lampiran A `selesai` atau `sengaja tidak dipindahkan` + alasan.

### Phase 3.5 — Cutover (±1–2 hari)

Persis induk §8 Phase 3.5, dengan catatan audit: `middleware.ts:34` memakai `startsWith('/dashboard')` — saat menambah matcher `/dashboard-v2/:path*`, tambahkan komentar + test case yang mengunci perilaku itu. Urutan: matcher+test → redirect login → redirect per-rute legacy (hanya baris Lampiran A `selesai`) → hapus legacy setelah satu siklus rilis.

**Gate:** owner login mendarat di v2; session refresh berjalan di v2; tidak ada rute legacy yang masih dicapai lewat nav.

### Phase 4+ — Modul lanjutan & Coupon domain

Tidak berubah dari induk §8 Phase 4–5 (KDS, meja, reservasi, CRM, permission matrix, audit log, invoice ledger; coupon sebagai domain sendiri).

## 3. Matriks fitur yang digunakan (sumber kebenaran implementasi)

Legend: **F** = fungsional penuh · **R** = read-only · **D** = disabled dengan alasan · **✗** = tidak ditampilkan

| Rute | Fitur | Mode | Sumber data/kontrak | Asal |
|---|---|---|---|---|
| Beranda | KPI strip (penjualan/order/AOV) | R | `dashboard-v2-home.ts`, `analytics.ts` | sudah ada |
| | Ringkasan antrean + CTA kasir | R | snapshot KasirQueue (subscription read-only) | sudah ada |
| | Task list, activity feed, revenue trend | R/F(link) | idem + `BarSeries`→chart baru | baru |
| Pesanan | Tabs riwayat + filter + search + list/grid | R | `dashboard-v2-orders.ts` + supabaseAdmin (server) | sudah ada, restyle |
| | Slide-over detail, cetak ulang struk, salin token | R/F | receipt contract, clipboard | restyle OrderDetailSheet |
| | Mutasi status order | ✗ | milik `/kasir` saja (kontrak §5.2) | — |
| Menu | Grid/list + quick actions | F | `menu-actions-v2.ts`, `saveMenuBasics` | restyle |
| | Editor Dasar & Jadwal-diskon | F | `menu-form-save.ts` (RPC chain) | port MenuForm |
| | Varian (option group/option) | F | `menu-option-drafts.ts` + RPC `replace_menu_options` | port MenuOptionsEditor |
| | Resep | F | RPC `replace_menu_recipes` | port RecipeEditor |
| | AI extract menu | F | POST `/api/menu/extract` (tested) + credit ledger | port MenuExtractor+AiCreditMeter |
| | AI detail generation | F | POST `/api/menu/generate-details` | port (inline di MenuForm) |
| | Upload foto/GLB/USDZ | F | signed URL → Storage `menu-media` | port FileUpload |
| | Generate model 3D (AI) | **D** | UI modal lengkap gaya template; submit disabled beralasan — Tripo ditunda (§0.1) | desain kreatif §0.1b |
| | Preview 3D + AR | F | `<model-viewer>` GLB/USDZ publik | baru |
| | Status 3D/AR di list | R | keberadaan model URL | baru |
| Stok | Tabel + adjustment + alasan wajib | F | `stok-actions.adjustStock` → RPC `adjust_inventory_stock` | sudah ada, polish |
| | Form tambah/edit bahan | F | `createInventoryItem/updateInventoryItem` | port InventoryItemForm |
| | Riwayat movement + low-stock | R/F | `dashboard-v2-stock.ts` (Inventory_Movements) | baru |
| Promo | Diskon terjadwal | F | scheduler actions (RPC existing) | port SchedulerClient |
| | Announcement/campaign | F | announcements table + actions | port AnnouncementForm |
| | Coupon code | ✗ | keluar scope (domain terpisah) | — |
| Laporan | 5 tab report + filter tanggal | R | `dashboard-v2-reports.ts` | restyle |
| | Chart line/donut/funnel/heatmap | R | client SVG (port 515 ln) | port chart legacy |
| | Export CSV | F | ExportReport pattern | port |
| Pengaturan | Cafe/brand, pajak, QR smart menu | F | `tax-actions.ts`, `QrSmartMenu` | port |
| | Payment/print/delivery/notif/integration | D/R | tanpa backend → `Belum dikonfigurasi` | placeholder jujur |
| Kasir | Tidak berubah | F | kontrak §5.2 tetap | — |

### Spesifikasi UI 1:1 yang diikuti (hasil probe template)

- **Items/menu grid**: kartu foto + nama + harga (+coret diskon), badge kategori, hover action edit/hide/delete, modal Add/Edit ber-field: Image*, Nama*, Deskripsi*, Harga*, Harga Net*, Kategori* (select), Pajak* (select CGST/SGST-style), varian size+price dinamis, addon rows (Name*, Price*) — dipetakan ke: foto, nama, deskripsi, harga Rupiah, harga net (auto dari pajak), kategori, pajak cafe, opsi group (varian), addon → **option group 3Diner** (satu konsep, istilah lokal).
- **Addons → Option items**: tabel kolom Item | Addon | Price | Status | Actions + modal Add/Edit (Item*, Addon*, Price*, Deskripsi*) → tab Varian editor.
- **Categories**: tabel Category(img) | No of Items | Created On | Status | Actions + modal (Image*, Name*) → manajemen kategori menu.
- **Coupons**: kolom Code | Valid Category | Discount Type | Amount | Duration | Status — **tidak direplikasi** (✗).
- **Orders**: kartu order dengan avatar customer, token `#xxxxx`, waktu, badge status berwarna, tab counter `All Orders (48)` dsb., dropdown action per kartu → adaptasi lifecycle 3Diner `awaiting→received→preparing→ready→completed` (read-only versi owner).
- **Reports**: kartu KPI ringkas + grafik apex-style (line/donut/bar) + tabel top items + heatmap jam ramai → SVG dv2.
- **Settings**: form sectioned dengan sidebar anchor + toggle switch → task-based sections induk §5.7.

## 4. Acceptance criteria tambahan (di atas induk §9)

1. Modal Generate Model 3D tampil utuh bergaya template namun submit disabled dengan alasan tertulis; **tidak ada call ke `/api/tripo/*` di bundle v2** dan tidak ada state sukses palsu (dicek grep + review saat gate Phase 2).
2. Upload GLB manual → tampil di viewer → AR link hidup: satu playtest script tercatat.
3. Setelah write dari halaman v2, data v2 refresh tanpa reload manual (bukti dual-path revalidation bekerja) — test lib per action.
4. Semua tabel: sorting, pagination, dan filter mengubah data nyata (anti-pola template diverifikasi per komponen).
5. `npm run test:ci`, `typecheck`, `build` pass di akhir setiap phase; lint file sentuh tidak bertambah.

## 5. Estimasi total

±16–23 hari kerja efektif untuk Phase 0–3.5 (turun dari ±20–27 tanpa keputusan Tripo-skip, karena port Tripo+test integration-nya adalah item L paling mahal). Phase 2 tetap fase kritis; jalur kritisnya kini MenuForm restyle + dual-path plumbing, bukan generasi 3D.
