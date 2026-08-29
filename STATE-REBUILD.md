# STATE-REBUILD.md — Keadaan Rebuild Dashboard 3Diner (faithful Dream POS recreation)

> **Apa ini:** catatan keadaan yang hidup, bukan surat serah-terima sekali pakai.
> Siapa pun (Claude, Cursor, kamu sendiri bulan depan) membaca ini dulu sebelum menulis kode.
> **Terakhir diperbarui:** 29 Agustus 2026 · **Baca penuh. Jangan revert keputusan di §4.**

**Ringkas:** kerangka + 9 halaman + **lapisan DNA 3Diner (§6.7)** selesai dan terverifikasi di browser.
Yang tersisa hanya dua modul tanpa sumber data (Reservation, Addons — ⏸ sengaja, bukan utang).

---

## 1. Misi (satu paragraf)

Konsol owner 3Diner sedang dibangun ulang dari nol sebagai **faithful recreation template Dream POS** (Bootstrap 5 admin template dari dreamstechnologies): tema **terang**, tata letak, warna, tipografi, dan komponen **disamakan persis** dengan template — BUKAN interpretasi bebas. Data mengalir dari **Supabase nyata** (bukan mock). Setelah SEMUA halaman selesai direcreate 1:1, barulah identitas 3Diner (aksen/branding) masuk sebagai lapisan berikutnya. **Jangan memasukkan DNA 3Diner sekarang.**

## 2. Lokasi & cara jalan

- Repo: `C:\Kerja\3Diner` (git). Aplikasi Next.js di subfolder **`App/`** (src = `App/src`).
- Jalankan dev: `cd C:/Kerja/3Diner/App && npm run dev` → `http://localhost:3000`
- Build produksi: `npm run build` lalu `npm run start -- --hostname 127.0.0.1 --port 3000`
- **Login demo:** `demo@kafe.com` / `Demo3Diner2026` (owner, kafe "Senja Kopi"). Tanpa login, `/dashboard-v2` redirect ke `/login`.
- Env ada di `App/.env.local` (Supabase URL + service role key). **Jangan commit .env.**
- ⚠️ AGENTS.md App berbunyi: **Next.js ini BUKAN versi yang kamu tahu dari training data** — baca `node_modules/next/dist/docs/` sebelum memakai API Next.

## 3. Riwayat commit rebuild (jangan diulang)

```
d2cac4b feat(dp): halaman Manage Staffs + Roles & Permissions ala Dream POS
41e8349 feat(dp): halaman Store Settings + Tax Settings ala Dream POS
037344c feat(dp): halaman Kitchen KDS ala Dream POS — papan kartu read-only
0fd2f0d docs: koreksi HANDOFF — enum Orders.status sebenarnya, daftar tabel Supabase
e434dab feat(dp): halaman Categories ala Dream POS — tabel agregasi kategori menu
306dda2 feat(dp): halaman Items ala Dream POS — grid kartu produk 4 kolom + search + pager
0c34c1c docs: HANDOFF.md untuk Cursor — lanjutan rebuild dashboard Dream POS
4d5545e feat(dp): halaman Pesanan ala Dream POS — 6 kartu status, tab ber-counter
ecf45b9 fix(dp): skema Orders sesungguhnya (tanpa customer_name) + rentang 30 hari
2ec81d9 feat(dp): faithful Dream POS recreation — shell dua kolom + halaman Dashboard
20abe6b chore: remove dashboard-v2 entirely — will be rebuilt as faithful Dream POS recreation
```

Baseline kualitas yang HARUS tetap hijau tiap commit:
`npx tsc --noEmit` · `npx eslint src/app/dashboard-v2 src/components/dp --max-warnings 0` ·
`npm run build` · `npm run test:ci` = **53 file / 461 test pass**.

## 4. Keputusan yang DIKUNCI (jangan dibatalkan tanpa alasan tertulis)

1. **UI 1:1 Dream POS dulu, DNA 3Diner kemudian.** Jangan menambah oranye/navy/Poppins ke halaman baru.
2. **Konsol owner = RIWAYAT (read-only).** Antrean kerja & mutasi status hanya di `/kasir`. Dashboard-v2 tidak punya tombol ubah status (gate: grep `ubah|konfirm|batalkan|proses` di komponen v2 harus nihil).
3. **Server components + `supabaseAdmin` untuk semua query read.** `src/lib/supabase-admin.ts` hanya boleh diimpor dari server component / server action. Interaktivitas klien via komponen `"use client"` kecil yang menerima data sebagai props (contoh: `OrdersBoard.tsx`).
4. **Anti kontrol palsu:** setiap tombol/input yang tampil HARUS berfungsi. Kalau modulnya belum ada → item nav diberi `soon: true` (disabled beralasan), bukan link mati, dan BUKAN search bar dekoratif. (Search topbar dekoratif sudah dihapus — jangan dihidupkan kembali.)
5. **Lib write-action lama DIPERTAHANKAN** untuk dipakai ulang: `src/lib/menu-actions-v2.ts` (`setMenuLive`, `setManyMenusLive`), `src/lib/stok-actions.ts` (`adjustStock`, `markPurchased`), `src/lib/tax-actions.ts` (`saveTax`), `src/lib/menu-editor-actions.ts`. Mereka memakai `revalidatePath("/dashboard-v2/...")` — masih valid.
6. Route tetap `/dashboard-v2` (bukan rename). Legacy `/dashboard` dan `/kasir` TIDAK disentuh.

## 5. Kontrak data — SKEMA NYATA (bukan tebakan!)

❌ **Kolom/tabel ini TIDAK ADA** (pernah bikin query gagal total → widget kosong): `Orders.total_amount`, `Orders.customer_name`, `Menus.name`, `Menus.price`, `Menus.category_id`, tabel `Categories`, tabel `Order_Items`.

✅ **Yang benar:**

| Tabel | Kolom yang dipakai |
|---|---|
| `Orders` | `id_order` (string, token panjang → tampil `#` + 5 char akhir), `total` (number), `status`, `payment_status`, `table_number` (string \| null), `items` (**JSONB array**: `{ id_menu?, nama_menu?, harga_menu?, qty? }`), `created_at` (ISO), `cafe_id`, plus `completed_at`, `cancelled_at`, `subtotal`, `tax_amount`, `service_amount`, `payment_method` |
| `Menus` | `id_menu`, `nama_menu`, `harga_menu`, `image_url` (URL storage, bisa null), `category` (**teks langsung**, default `'Lainnya'`), `is_active` (bool, default true — `!== false` = tayang), `created_at`, `cafe_id`, plus `description_menu`, `prep_time_minutes`, `discount_pct`, `sort_order`, `schedule_*` |

**Koreksi enum (diverifikasi lewat check constraint Postgres, 29 Agu 2026):**
- `Orders.status` = `awaiting` \| `received` \| `preparing` \| `ready` \| `completed` \| `cancelled`. Draf sebelumnya menulis `on_delivery` — **kolom itu tidak ada di constraint**, dan `received` (default) sempat terlewat.
- `Orders.payment_status` = `unpaid` \| `awaiting_payment` \| `awaiting_checkin` \| `pending` \| `paid`.
- Tabel di database: `Cafes, Menus, Orders, Order_Quotes, Order_Idempotency_Keys, Order_Reservations, Inventory_Items, Inventory_Movements, Menu_Recipes, Menu_Option_Groups, Menu_Option_Values, Menu_Option_Recipes, Staff, Announcements, Analytics_Logs, Rate_Limits`. **Tidak ada tabel Categories maupun tabel reservasi meja** — `Order_Reservations` itu hold stok, bukan booking meja (lihat §6.4). `Staff` ADA (kolom `full_name`, `role` = `owner`\|`cashier`, `is_active`) → §6.5 Manage Staffs bisa read-only nyata.

- Kategori = agregasi dari teks `Menus.category` (donut di Dashboard dari sini). Tidak ada relasi FK.
- Waktu "hari ini" pakai helper `startOfTodayWIB()` dari `src/lib/dashboard-today.ts` (WIB, bukan UTC).
- Data demo: 43 order (≥30 hari), 18 order dalam 30 hari terakhir (11 awaiting, 7 ready, 0 completed), 10 menu. Rentang widget: 30 hari agar data historis terlihat.
- Pola query contoh ada di `App/src/app/dashboard-v2/page.tsx` (Promise.all Orders+Menus) dan `App/src/app/dashboard-v2/pesanan/page.tsx`.

## 6. Peta halaman — apa yang sudah ada, apa yang belum

Spesifikasi visual diambil langsung dari template live:
`https://dreamspos.dreamstechnologies.com/restaurant-pos/html/<page>.html`.
**Cara probe yang terbukti cukup:** `curl` dengan UA browser untuk markup +
`assets/css/style.css` untuk ukuran (`padding`, `font-size`, warna variabel).
Headless Chrome hanya perlu untuk halaman yang kartunya dibangun JS. **Jangan mengarang ukuran.**

⚠️ **Daftar nama file di draf lama menyesatkan.** `settings.html` BUKAN halaman setelan —
isinya klon Dashboard. Halaman setelan yang sebenarnya: `store-settings.html`,
`tax-settings.html`, `role-permission.html`, `users.html`, plus
`payment-settings.html`, `print-settings.html`, `notifications-settings.html`,
`delivery-settings.html`, `integrations-settings.html`. Daftar lengkap 31 halaman template
bisa diambil dengan `re.findall(r'href="([a-z0-9-]+\.html)"', html)` dari halaman mana pun.

| § | Halaman | Route | Status |
|---|---|---|---|
| — | Shell + Dashboard | `/dashboard-v2` | ✅ |
| — | POS (full) | `/dashboard-v2/pos` | ✅ katalog+keranjang+varian+commit+tunai/QRIS+struk |
| — | Orders | `/dashboard-v2/pesanan` | ✅ |
| 6.1 | Items | `/dashboard-v2/items` | ✅ |
| 6.2 | Categories | `/dashboard-v2/kategori` | ✅ |
| 6.3 | Kitchen KDS | `/dashboard-v2/dapur` | ✅ read-only |
| 6.4 | Reservation | — | ⏸ `soon` — tak ada tabelnya |
| 6.5a | Store Settings | `/dashboard-v2/pengaturan` | ✅ bisa menyimpan |
| 6.5b | Tax Settings | `/dashboard-v2/pengaturan/pajak` | ✅ bisa menyimpan |
| 6.5c | Manage Staffs | `/dashboard-v2/pengaturan/staf` | ✅ CRUD: tambah akun+peran, nonaktif/aktifkan |
| 6.5d | Roles & Permissions | `/dashboard-v2/pengaturan/peran` | ✅ matriks bisa disunting (override runtime per-kafe) |
| 6.5e | QR Smart Menu | `/dashboard-v2/pengaturan/qr` | ✅ port dari legacy |
| 6.6 | Addons | `/dashboard-v2/addons` | ✅ CRUD nyata (Menu_Option_*) — Coupons eksplisit TIDAK dibuat |
| 6.7 | Lapisan DNA 3Diner | — | ✅ selesai 29 Agu 2026 |

### Pola yang berulang di SEMUA halaman: template kaya, data kita tipis

Tiap halaman menemukan hal yang sama — template punya kolom/tombol yang tidak punya
padanan di skema kita. Aturannya konsisten dan **jangan dilanggar**: field yang tidak
bisa disimpan dan tombol yang tidak melakukan apa-apa adalah kontrol palsu, jadi
**dibuang**, bukan ditampilkan mati. Yang sudah dibuang, per halaman:

- **Items** — template TIDAK punya kartu ringkasan status maupun chips kategori (draf lama salah menyebutnya ada). Kebab Edit/Delete/Hide → hanya **Edit** (satu-satunya yang punya implementasi). Titik Veg/Non-Veg → **Live/Offline** dari `Menus.is_active`.
- **Categories** — Export / Filter / Column dibuang. Actions (edit+hapus kategori) → tautan ke `/dashboard-v2/items?q=<kategori>`, karena kategori cuma teks di `Menus.category`, bukan entitas. "Created On" → "Menu Pertama" (`Menus.created_at` terlama).
- **Kitchen** — footer `Play timer` + `Mark Done` dibuang (mutasi = milik Kasir, §4.2). Nama pelanggan tak ada → nomor meja / Take Away. "Delayed" tak punya kolom → diturunkan dari umur pesanan, ambangnya **ditulis di layar** ("Lewat 30 Menit") supaya bukan angka gaib.
- **Store Settings** — Country/State/City/Pincode/Email/Phone/Currency dan 4 sakelar fitur dibuang; `Cafes` tak punya kolomnya.
- **Tax Settings** — template menyimpan banyak baris pajak + Add New; kita cuma punya satu konfigurasi di `Cafes`, jadi tabelnya dua baris tetap tanpa Add New.
- **Manage Staffs** — "Phone Number" dibuang (tak ada kolom) → tanggal bergabung. Actions dibuang: **tidak ada satu pun jalur tulis ke tabel `Staff`** di kodebase; di template pun ketiga tombolnya bertanda `disabled`.
- **Roles & Permissions** — checkbox yang bisa dicentang → tanda baca. Peran ditetapkan di kode (`PERMISSIONS`), hanya berubah lewat deploy, jadi checkbox akan jadi janji palsu. "Add New" dibuang.

### Catatan jendela waktu

Halaman **Pesanan** dan **Kitchen** memakai jendela **30 hari**, bukan "hari ini".
Alasannya data: order terbaru di DB demo tanggal 25 Agustus, jadi filter "hari ini"
membuat kedua papan itu kosong terus padahal 18 pesanan memang masih terbuka.

### 6.4 Reservation — sudah diprobe, tidak ada datanya
`Order_Reservations` adalah hold stok inventaris (`inventory_item_id`, `reserved_qty`,
`expires_at`), **bukan** booking meja. Jangan dipakai sebagai sumber data reservasi.
Pilihan: biarkan `soon: true`, atau buat halaman empty-state jujur gaya template.

### 6.6 Addons — ✅ CRUD nyata (29 Agu 2026)
Template `addons.html`: tabel Item | Addon | Price | Status | Actions + modal Add/Edit.
Pemetaan data: Item = menu (via grup), Addon = `Menu_Option_Values.name`,
Price = `price_delta`, Status = `is_active` (klik badge = toggle). Grup diambil dari
`Menu_Option_Groups` (dibuat otomatis min 0/max 5 saat menu pertama dapat addon).
Write-path: `src/lib/addon-actions.ts` (create/update/toggle/delete, gate `manage_menu`,
scope `cafe_id`, cegah duplikat nama dalam grup). Dropdown menu modal Add diambil dari
tabel `Menus` (bukan dari addon rows) agar menu tanpa addon pun bisa dipilih.
**Coupons eksplisit tidak dibuat** — permintaan pengguna; nav Menu Management berisi
Categories, Items, Addons saja.

### 6.7 Lapisan DNA 3Diner — ✅ SELESAI (29 Agu 2026)
Struktur & ukuran halaman TIDAK berubah; yang berganti hanya warna, logo, dan font:
- **Token `dp.css` revalued** ke brand: `--dp-heading` → navy `#022c60`, `--dp-blue` →
  orange `#fd5002` (nama variabel dipertahankan), `--dp-blue-soft` → tint `#fce8df`,
  `--dp-border` → `#cfd9e4`, `--dp-text` → `#1a3b6a`, `--dp-muted` → `#51698f`,
  `--dp-bg` → `#f3f6fa`. Token baru `--dp-accent-ink: #c2410c` untuk teks kecil
  berwarna aksen di atas putih/tint (kontras WCAG — orange murni #fd5002 di putih
  hanya untuk elemen besar: tombol, stroke, bar).
- **Logo mark asli**: `Asset/Logo 3Diner Only.svg` di-stripe background full-canvas-nya
  (path `#FDFDFD` pertama) → `App/public/brand/logo-mark-t.svg` (transparan), dipakai
  via CSS background `.dp-logo` ( hindari next/image+SVG).
- **Poppins eksplisit** di `.dp-root` via `var(--font-poppins)` (font global yang sudah ada).
- **Chart/dashboard/orders/kitchen**: hex template `#0d76e1` di-replace token brand
  (line chart stroke `#fd5002`, donut palet `[orange, navy, green, amber, violet]`,
  TAHAP dapur: navy/orange, kartu stat orders: icon pertama orange).
- Verifikasi: DOM assertion — `--dp-blue=#fd5002`, `--dp-heading=#022c60`,
  logo svg terpasang, stroke chart `#fd5002`, stroke ikon stat `#fd5002`, Poppins aktif;
  tsc/lint/build/461 test hijau.

## 7. Arsitektur & pola yang berjalan

```
App/src/
├─ app/
│  ├─ dp.css                        ← SEMUA style dp (token §8). Halaman baru menambah .dp-* DI SINI.
│  └─ dashboard-v2/
│     ├─ layout.tsx                 ← auth gate (canOpenOwnerConsole) + <DpShell>
│     ├─ page.tsx                   ← Dashboard: 4 KPI, line chart SVG, Top Selling, donut, Active Orders
│     ├─ pesanan/page.tsx           → <OrdersBoard>
│     ├─ items/page.tsx             → <ItemsGrid>          (menerima ?q= dari Categories)
│     ├─ kategori/page.tsx          → <CategoriesTable>
│     ├─ dapur/page.tsx             → <KitchenBoard>
│     └─ pengaturan/
│        ├─ page.tsx                → <StoreSettingsForm>  (updateCafeSettings)
│        ├─ pajak/page.tsx          → <TaxSettingsForm>    (saveTax → RPC set_cafe_tax)
│        ├─ qr/page.tsx             → <QrSmartMenuDp>      (QR menu publik dari Cafes.slug_url)
│        ├─ staf/page.tsx           → <StaffManager>       (tambah/nonaktif/aktifkan staf)
│        └─ peran/page.tsx          → <PermissionsMatrix>  (override runtime Role_Permissions)
│     └─ pos/page.tsx               → <PosBoard>           (POS full: quote/commit RPC, tunai, QRIS)
├─ components/
│  ├─ dp/ (Shell, OrdersBoard, ItemsGrid, CategoriesTable, KitchenBoard,
│  │        StoreSettingsForm, TaxSettingsForm, QrSmartMenuDp, AddonsTable,
│  │        StaffManager, PermissionsMatrix)
│  └─ pos/PosBoard.tsx              ← POS lengkap (katalog, keranjang, opsi, bayar)
```

**Pola halaman baru:** `page.tsx` server → gate auth → query `supabaseAdmin` (kolom persis §5)
→ map data → render markup `.dp-*` → CSS masuk `dp.css`. Interaktivitas dipisah ke komponen
`"use client"` yang menerima data sebagai props. Halaman read-only murni (staf, peran) tidak
butuh komponen klien sama sekali.

**Penanda nav aktif** memakai pencocokan href **terpanjang**, bukan `startsWith` biasa —
kalau tidak, `/pengaturan` ikut menyala saat berada di `/pengaturan/pajak`.
Rail ikon adalah **tab** (bukan link): mengganti grup menu di panel label; grup yang
menyala mengikuti halaman aktif, klik manual pengguna menimpa sampai pindah rute.

**Class dp yang bisa dipakai ulang** (semua sudah ada di `dp.css`):
`.dp-card` `.dp-card-body` `.dp-page-head` `.dp-page-sub` `.dp-field` `.dp-empty`
`.dp-table` `.dp-table-wrap` `.dp-badge-success/-danger` `.dp-avatar-sm` `.dp-pager`
`.dp-btn-white` `.dp-add-btn` `.dp-drop` `.dp-input` `.dp-label` `.dp-form-grid`
`.dp-form-foot` `.dp-switch` `.dp-round-btn` `.dp-imgfield` `.dp-mark`.
Cek daftar ini dulu sebelum menulis CSS baru.

## 8. Design tokens (nilai TERVERIFIKASI dari computed style template)

```css
:root {
  --dp-bg: #f8f8f8;         /* kanvas */
  --dp-surface: #ffffff;    /* kartu, sidebar panel */
  --dp-border: #e2e8f0;     /* border kartu 1px, radius 6px */
  --dp-text: #475569;  --dp-heading: #0f172a;  --dp-muted: #64748b;
  --dp-blue: #0d76e1;       /* aksen aktif (tab aktif, link, pager aktif, tombol primer) */
  --dp-blue-soft: #e8f2fd;  /* bg icon bulat tinted */
  --dp-green: #22c55e;  --dp-red: #ff3636;
  --dp-rail-w: 62px;        /* rail ikon */
  --dp-menu-w: 214px;       /* panel label */
}
```
Font: **Instrument Sans** (fallback sans-serif) — Google Font. ⚠️ **MASIH BELUM DIPASANG**
(dicek 29 Agu 2026: `App/src/app/layout.tsx` hanya memuat Poppins). Semua halaman dp saat ini
mewarisi Poppins, jadi tipografinya belum 1:1 template. Pasang via `next/font/google` khusus
untuk subtree `dashboard-v2` — **Poppins global jangan diubah** karena dipakai route lain. Item nav 38.6px tinggi, px-10/py-8, radius 6; item aktif = bg putih + teks `#0f172a` + drop-shadow halus; rail bg `#f8f8f8`; header toko 58px logo 24px radius-12; topbar putih 58.8px; badge notif merah `#ff3636`; KPI card ~272×95.

## 9. Gotchas (semua sudah pernah menggigit)

1. **`.next` terkunci server hidup** → sebelum `npm run build`, kill PID port 3000: `PID=$(netstat -ano | grep ":3000" | grep LISTENING | head -1 | awk '{print $NF}'); taskkill /PID $PID /T /F`. Setelah build, start ulang.
2. **Sintaks cmd (`>nul`) gagal diam-diam di bash** — pakai `2>&1 | head` atau abaikan output.
3. Type error `.next/dev/types` sesudah hapus route → `rm -rf .next` lalu build ulang.
4. `--max-warnings 0` di eslint: import tak terpakai = gagal. Rapikan sebelum commit.
5. jsdom test environment & test lama `tests/` tidak tahu dp — kalau menambah test, polanya lihat `tests/` existing.
6. Klik via CDP kadang tidak memicu React; untuk uji state React pakai native setter:
   `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'x'); input.dispatchEvent(new Event('input',{bubbles:true}))`.
7. Screenshot kadang gagal (`UnknownVizError`) atau ke-render terlalu kecil — **assertion DOM lewat `javascript_tool` jauh lebih andal** untuk verifikasi.
8. **`document.querySelector('form')` di halaman dp mengenai form Logout di sidebar**, bukan form isi halaman. Pakai `.dp-card form`. (Pernah tak sengaja memicu `/api/auth/signout` saat menguji.)
9. Jam berjalan: jangan `setState` di dalam `useEffect` (ditolak `react-hooks/set-state-in-effect`). Pakai `useSyncExternalStore` dengan **`subscribe` di level modul** (closure baru tiap render → `Maximum update depth exceeded`) dan snapshot dibulatkan ke detik; snapshot server `0` supaya markup server = hidrasi pertama.
10. `revalidatePath` dari lib lama aman; tambahkan path route dp yang relevan (sudah dilakukan di `updateCafeSettings`).
11. Halaman login masih memakai kelas `dv2-pill` dari `globals.css` — **jangan hapus blok CSS `dv2-*`**. `globals.css` juga masih menyimpan beberapa class `dp-*` lama yang dipakai `OrdersBoard`; style dp baru tetap masuk `dp.css`.
12. Commit style: conventional, bahasa Indonesia, scope `dp:`.

## 10. Definition of Done

**Per halaman** — semuanya sudah dipenuhi oleh 9 halaman yang ada, pertahankan untuk halaman baru:
(a) markup dibandingkan dengan template — struktur, urutan widget, ukuran, warna; ukuran diambil
dari `style.css`, bukan dikira-kira; (b) semua data nyata dari Supabase, kosong = empty-state jujur;
(c) semua kontrol berfungsi, yang tidak bisa berfungsi dibuang (§6); (d) `tsc` + `eslint --max-warnings 0`
+ `build` + `test:ci` hijau; (e) **verifikasi di browser dengan assertion DOM**, bukan hanya "kelihatannya
jalan" — angka di layar dicocokkan dengan isi database; (f) cek read-only:
`grep -rn "ubah\|konfirm\|batalkan\|proses" App/src/components/dp App/src/app/dashboard-v2` nihil untuk
aksi mutasi; (g) satu commit per halaman, pesan commit mencatat penyimpangan dari template + alasannya.

**Keseluruhan:** ✅ tercapai — semua item nav tanpa `soon: true` punya halaman hidup.
Wewenang kini EFEKTIF: bawaan kode (`permissions-default.ts`) + override runtime per-kafe
(tabel `Role_Permissions`, migrasi 2026-08-29) yang disunting dari halaman Roles &
Permissions; `requireStaffPermission` membaca hasil gabungannya. Guard: owner tak bisa
kehilangan `manage_settings`, `manage_settings` untuk Kasir tak bisa diaktifkan dari UI.

## 11. Referensi

- Template live: `https://dreamspos.dreamstechnologies.com/restaurant-pos/html/index.html`
  (nama file setelan yang benar ada di §6 — jangan percaya `settings.html`)
- Rencana induk: `docs/DASHBOARD-REBUILD-PLAN.md` · `docs/DASHBOARD-IMPLEMENTATION-PLAN.md`
- Handoff teknis lama: `docs/HANDOFF_3Diner_2026-08-26.md`
- Brand (untuk §6.7): `docs/BRAND-DESIGN.md`, `docs/DESIGN.md`

---

## 12. Kalau kamu melanjutkan besok, mulai dari sini

1. Baca §4 (keputusan terkunci) dan §5 (skema nyata). Dua bagian itu yang paling sering
   menyelamatkan dari query gagal dan dari melanggar aturan read-only.
2. Nyalakan dev server, login demo, lihat 9 halaman yang ada — supaya tahu standar rasa
   yang sudah terbentuk sebelum menambah apa pun.
3. Pekerjaan berikutnya yang paling bernilai: **§6.7 lapisan DNA 3Diner**. Semua halaman
   sudah memakai token `--dp-blue` secara konsisten, jadi lapisan ini seharusnya bersih.
4. Perbarui berkas ini di commit yang sama saat keadaan berubah. Berkas ini menjadi usang
   secepat kode berubah, dan draf sebelumnya sempat salah soal `on_delivery`, kartu
   ringkasan Items, dan `settings.html`.
