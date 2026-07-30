# Konsol 3Diner v2 — konteks proyek

**Terakhir diperbarui:** 2026-07-30
**Status:** fitur lengkap, permukaan visual belum dikerjakan
**Berlaku untuk:** `/kasir` dan `/dashboard-v2` di repo `CozyM3dia/3Diner`

---

## 1. Kenapa ini ada

Pemilik menilai dashboard lama "masih AI banget". Diagnosis yang disepakati setelah
membaca kode: bukan UI-nya jelek, tapi **dashboard-nya belum punya pendapat tentang
apa yang dikerjakan pemilik kafe**. Semua ditampilkan setara — 10 kartu KPI, 4
insight, 5 chart, dan seluruh tabel inventory dengan bobot visual yang sama.

Akar strukturalnya ada di dokumen arahan lama (`brand/DASHBOARD_REDESIGN_DIRECTION.md`):
ia mengunci lapisan **permukaan** (warna, logo, bahasa, rute) dan membiarkan lapisan
**struktur** kosong, sehingga struktur terisi otomatis oleh template yang kebetulan
ada — Efferd dashboard-8. Bagian "Required Homepage Sections" berisi 10 butir wajib,
dan dari situlah 10 kartu KPI seragam berasal.

## 2. Keputusan produk yang mengikat

Sumber lengkap: `docs/audit/KEPUTUSAN-PRODUK-UMUM.md`.

| # | Keputusan | Alasan singkat |
|---|---|---|
| K1 | **Dua tahap kerja**, bukan tiga: Masuk → Disiapkan → Selesai | "Siap" hanya membawa informasi kalau pembuat ≠ pengantar. Di kafe 1–3 orang itu satu gerakan, dan ketukan tanpa informasi membuat staf berhenti memperbarui status. `ready` tetap ada di database untuk kafe ber-*runner* |
| K2 | **Tujuh rute owner**, bukan sepuluh | Makin sedikit rute, makin cepat dipelajari kafe baru — dan itu yang menentukan apakah layanan ini bisa dijual berlangganan |
| K3 | **Satu kolom bergulir**, bukan kanban | Kanban lebih enak di tablet tapi pecah di HP, dan perangkat pemilik belum terverifikasi. Naik ke kanban nanti kecil; turun dari kanban adalah perombakan |
| K4 | **Nol konfigurasi wajib** saat onboarding | Kafe harus bisa jualan hari pertama tanpa mengatur apa pun. Satu pengecualian: **pajak tidak boleh punya default diam-diam** |
| K5 | Kosakata yang tidak mengunci ke satu jenis usaha | "Meja" teks bebas, bukan nomor. "Pesanan", bukan tiket/check/SKU. Status wajib menyebut pemegang bola — **"Pending" dilarang** |
| K6 | Rupiah saja, bahasa Indonesia saja, satu outlet | Scope outlet tetap ditaruh di shell sejak awal supaya menambah cabang nanti bukan refactor |

**Aturan tetap:** v2 dibangun **berdampingan**, bukan menimpa. `/dashboard` lama tetap
hidup dan tidak disentuh sampai tiap rute v2 terbukti memuat seluruh kontrak 564 fitur.
Cutover = ganti nav + redirect, satu baris, dan rollback = kembalikan.

## 3. Dua permukaan

```
/kasir          Konsol Kasir   — antrean pesanan, satu layar, login sendiri
/dashboard-v2   Konsol Owner   — Beranda · Pesanan · Menu · Stok · Promo · Laporan · Pengaturan
/dashboard      Konsol lama    — MASIH HIDUP, jangan disentuh
```

Pemisahannya **fisik**, bukan lewat gembok: tidak ada nav pemilik di `/kasir`, jadi
tidak perlu PIN atau grup terkunci. Bukti Tantri membantah keduanya — PIN di pintu jadi
teater, grup terkunci mengundang percobaan.

**Peran menentukan tujuan setelah login**, bukan pilihan di layar masuk. Pemilih peran
adalah pertanyaan yang jawabannya sudah dimiliki sistem, dan tiap salah pilih jadi
tiket dukungan. `owner` → `/dashboard-v2`, `cashier` → `/kasir`. Pemilik boleh membuka
konsol kasir (di kafe satu orang, pemiliklah kasirnya).

## 4. Peta berkas

### Logika murni — nol CSS, ~1.100 baris
```
src/lib/dashboard-v2-home.ts       Beranda: antrean tugas, delta pembanding
src/lib/dashboard-v2-orders.ts     Pesanan: tab, kursor, ringkasan ikut filter
src/lib/dashboard-v2-stock.ts      Stok: urutan mendesak, tingkat, parseQty
src/lib/dashboard-v2-menu.ts       Menu: urutan manual, keadaan model & tayang
src/lib/dashboard-v2-promo.ts      Promo: tiga jenis satu daftar
src/lib/dashboard-v2-reports.ts    Laporan: deret harian, corong, ringkasan pajak
src/lib/dashboard-v2-settings.ts   Pengaturan: daftar perlu dilengkapi
src/lib/kasir-queue-rules.ts       Kasir: tingkat umur, needsCash, formatAge
src/lib/menu-schedule-rules.ts     Jadwal: hari, kalimat penjelas, pratinjau harga
src/lib/receipt-html.ts            Struk termal 80mm (dipakai kasir & owner)
src/lib/staff-context.ts           Peran & kafe dari sesi
```

### Server actions
```
src/lib/kasir-actions.ts       acceptOrder, completeOrder, cancelOrder, markCashPaid
src/lib/stok-actions.ts        adjustStock (alasan WAJIB), markPurchased
src/lib/menu-actions-v2.ts     setMenuLive, setManyMenusLive
src/lib/menu-editor-actions.ts saveMenuBasics, saveMenuSchedule
src/lib/tax-actions.ts         saveTax
src/lib/auth-routing.ts        resolveHomeRoute
```

### Komponen
```
src/components/dashboard-v2/OwnerShell.tsx        nav 7 rute + badge
src/components/dashboard-v2/RouteSkeleton.tsx     kerangka loading.tsx
src/components/dashboard-v2/OrdersTable.tsx       + OrderDetailSheet.tsx
src/components/dashboard-v2/StockTable.tsx        + dua dialog
src/components/dashboard-v2/MenuTableV2.tsx       + MenuEditor.tsx
src/components/dashboard-v2/BarSeries.tsx         chart monokrom
src/components/dashboard-v2/TaxForm.tsx
src/components/kasir/KasirQueue.tsx               + KasirOrderSheet, CancelOrderDialog
```

### Gaya — semuanya terpusat
`src/app/globals.css`, prefiks `.dv2-` dan `.kasir-`. **158 aturan.**
Di luar itu: 10 style inline (lebar skeleton), 3 kelas Tailwind. Itu saja.

## 5. Skema yang ditambahkan

Migrasi `App/migrations/2026-07-27c_console_split_lifecycle_tax.sql` —
**sudah dijalankan di Supabase produksi**, diverifikasi 22/22.

| Tambahan | Kenapa |
|---|---|
| Status `completed` + `cancelled` | Sebelumnya `ready` adalah akhir, jadi pesanan selesai tidak pernah keluar dari daftar dan antrean tidak akan pernah bisa nol — itu membatalkan seluruh konsep konsol kasir |
| `cancelled_reason` wajib (constraint DB) | Pembatalan tanpa jejak adalah lubang kas paling klasik di kafe |
| Potret pajak per pesanan (`subtotal`, `tax_pct`, `tax_amount`, `service_*`) | Tanpa potret, mengubah tarif menulis ulang sejarah dan laporan bulan lalu berhenti bisa direkonsiliasi |
| Tarif + `tax_configured_at` + tarif tertunda di `Cafes` | Nol yang dipilih harus bisa dibedakan dari nol yang kebetulan |
| `notes` di level item (JSONB) | "Burger tanpa cabai tapi kentang extra pedas" sebelumnya tidak bisa diungkapkan |
| Tabel `Staff` + peran | Menentukan login dibawa ke mana |

**Fungsi:** `get_staff_context`, `effective_tax_settings`, `set_cafe_tax`, `cancel_order`,
`advance_order_status`. Semuanya `security definer`, ditutup dari anon/authenticated,
hanya `service_role`.

## 6. Empat hal yang TIDAK ada di database

Pola yang berulang empat kali. **Cek dulu sebelum menjanjikan kolom di layar.**

| Diharapkan | Kenyataan | Akibat di UI |
|---|---|---|
| Kegagalan pembuatan model 3D | Tidak pernah disimpan | Kolom Model 3D cuma dua nilai: "Siap tayang" / "Belum diunggah" |
| Scan QR | `Analytics_Logs` cuma `click_menu`, `view_3d`, `click_order` | Angka dinamai "Menu dibuka tamu", bukan "Scan QR" |
| Pemakaian promo | Pesanan simpan harga sudah didiskon tanpa menandai promonya | Kolom "Dipakai" tidak dibangun; halaman menjelaskan kenapa |
| Jam buka | **Tidak ada kolomnya** — `ASUMSI-A5` terbantah | SLA kasir jalan 24 jam; peringatan terlambat bisa muncul saat kafe tutup |

Kalau mau direkam, itu satu migrasi kecil dan sebaiknya sekali jalan.

## 7. Keadaan sekarang

| | |
|---|---|
| Rute owner | **7/7** selesai |
| Konsol kasir | lengkap, termasuk lapis 2 + struk |
| Gate | tsc 0 · **419 test** · build lulus |
| Produksi | semua rute hidup di `3diner.vercel.app` |
| PR | #17–#29 merged |
| **Permukaan visual** | **belum dikerjakan** — lihat `HANDOFF.md` |

Data kafe uji (`senja-kopi`) sangat sedikit: 2 bahan, 10 menu, 25 pesanan, nol
transaksi hari ini. Layar operasional yang dirancang untuk padat memang terlihat
melompong dengan tiga baris.

## 8. Gotcha yang sudah memakan waktu

- **`rm -rf .next` saat dev server HIDUP merusak cache Turbopack.** Gejalanya
  menyesatkan: perubahan CSS ada di disk tapi tidak pernah sampai ke browser.
  **Matikan server dulu**, baru bersihkan, baru nyalakan lagi.
- Screenshot Browser pane sering timeout. Pakai `read_page` / `get_page_text` /
  `javascript_tool`.
- Server action dikirim sebagai POST ke URL halaman yang terbuka. Middleware yang
  mengalihkan berdasarkan sesi harus **hanya mengalihkan GET**, kalau tidak
  responsnya rusak dan muncul "An unexpected response was received from the server".
- `Number("")` bernilai `0`, bukan `NaN`. Pernah membuat kolom kosong menyetel stok
  ke nol. Pakai `parseQty` di `dashboard-v2-stock.ts`.
- Migrasi: **perlebar constraint dulu, baru pindahkan data**. Urutan sebaliknya gagal
  `23514`.
- Git di Windows mengonversi CRLF pada `.webp` dan merusaknya. `.gitattributes` sudah
  menandai format gambar sebagai binary.

## 9. Dokumen lain yang mengikat

```
docs/audit/KONTRAK-WIREFRAME.md        anggaran berangka, alat review LULUS/GAGAL
docs/audit/KEPUTUSAN-PRODUK-UMUM.md    K1–K6
docs/audit/2026-07-27-referensi-visual.md   bacaan referensi + koreksi needmcp
docs/audit/kontrak-fitur/              564 fitur, 6 berkas, alat uji cutover
docs/wireframe/v3-lengkap.html         wireframe yang disetujui, 41 plate
Asset/referensi/{needmcp,21st,tantri}  60 gambar referensi
```
