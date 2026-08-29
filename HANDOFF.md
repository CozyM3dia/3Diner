# HANDOFF.md — Rebuild Dashboard 3Diner (faithful Dream POS recreation)

> **Untuk:** Cursor / agent mana pun yang melanjutkan pekerjaan ini.
> **Tanggal handoff:** 29 Agustus 2026
> **Status saat handoff:** Shell + Dashboard + Pesanan SELESAI & terverifikasi. Sisanya daftar tugas di §6.
> **Baca dokumen ini SEKALIAN penuh sebelum menulis kode. Jangan revert keputusan di §4.**

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

## 3. Commit yang sudah ada (jangan diulang)

```
4d5545e feat(dp): halaman Pesanan ala Dream POS — 6 kartu status, tab ber-counter, kartu order 3 kolom
ecf45b9 fix(dp): skema Orders sesungguhnya (tanpa customer_name) + rentang 30 hari
2ec81d9 feat(dp): faithful Dream POS recreation — shell dua kolom + halaman Dashboard
20abe6b chore: remove dashboard-v2 entirely — will be rebuilt as faithful Dream POS recreation
```

Baseline kualitas: `npx tsc --noEmit` ✓ · `npx eslint src/... --max-warnings 0` ✓ · `npm run build` ✓ · `npm run test:ci` = **53 file / 461 test pass**. Pertahankan hijau di setiap commit.

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

## 6. Tugas yang TERSISA (urutan eksekusi)

Sebanyak mungkin spesifikasi visual diambil langsung dari template live:
`https://dreamspos.dreamstechnologies.com/restaurant-pos/html/<page>.html` — halaman yang terverifikasi hidup (HTTP 200): `index.html`, `orders.html`, `categories.html`, `items.html`, `addons.html`, `kitchen.html`, `reservations.html`, `table.html`, `settings.html`, `add-item.html`, `earning-report.html`, `customer.html`, `invoice.html`, `pos.html`.
**Cara probe:** render JS diperlukan (kartu order dibangun JS). Opsi: (a) headless Chrome: `chrome.exe --headless=new --remote-debugging-port=9222` + CDP `Runtime.evaluate` / `Input.dispatchMouseEvent` untuk klik & baca DOM; (b) curl dengan UA browser cukup untuk markup statis (topbar, sidebar, struktur card). Jangan mengarang ukuran — ukur computed style.

### 6.1 Items / Menu (`/dashboard-v2/items`) — ✅ SELESAI (29 Agu 2026)
**Koreksi terhadap draf handoff ini:** markup `items.html` yang sebenarnya (di-curl + `assets/css/style.css`) TIDAK punya baris kartu ringkasan status dan TIDAK punya chips filter kategori. Yang ada: header (`h3 Items` + input search + tombol biru "Add New") → grid kartu `col-lg-3 / col-md-4 / col-sm-6` (gap 24, card pad 20, radius 6; foto `w-100 rounded`; kebab absolute 32px top/right 10px, opacity 0→1 saat hover; nama `fs-14 fw-semibold`; baris harga + penanda titik) → `pagination-nav` (33×37, radius 6, aktif biru). Itu yang direplikasi — jangan tambahkan widget yang tak ada di template.

Penyesuaian data nyata: titik Veg/Non-Veg template → **Live/Offline dari `Menus.is_active`** (`is_active !== false` = tayang). Kebab template berisi Edit/Delete/Hide; hanya **Edit** ditampilkan karena hanya itu yang punya implementasi nyata → `/dashboard/menu/[id]/edit`. "Add New" → `/dashboard/menu/new`. Search menyaring `nama_menu` + `category`. Pager 12/halaman.
File: `src/app/dashboard-v2/items/page.tsx` (server) + `src/components/dp/ItemsGrid.tsx` (client) + blok CSS Items di `dp.css`. Sekalian ditambahkan `.dp-page-head` yang selama ini dipakai halaman Pesanan tapi tidak pernah didefinisikan.

### 6.2 Categories (`/dashboard-v2/kategori`) — ✅ SELESAI (29 Agu 2026)
Template `categories.html`: kartu berisi toolbar (search kiri, kontrol kanan) + tabel `Category / No of Items / Created On / Status / Actions`. Ukuran template: sel `0.75rem 1rem` warna body, `thead th` 13px warna dark, avatar 2rem rounded, badge 13px/500 pad `2px 8px` radius 6 (soft-success `#14B51D`/`#EEF9F1`, soft-danger `#FF3636`/`#FFF0ED`).
Agregasi dari `Menus.category` (tak ada tabel Categories): thumbnail = foto item pertama, jumlah item, `Menu Pertama` = `Menus.created_at` terlama, Status = berapa item `is_active`. Export/Filter/Column template DILEWATI (tak ada implementasi nyata); Sort by dipertahankan dan berfungsi. Actions template (edit/hapus kategori) diganti tautan nyata ke `/dashboard-v2/items?q=<kategori>` — halaman Items kini menerima `?q=`.
File: `src/app/dashboard-v2/kategori/page.tsx` + `src/components/dp/CategoriesTable.tsx`.

### 6.3 Kitchen KDS (`/dashboard-v2/dapur`) — read-only
Template `kitchen.html`: kolom per status (Requested/Preparing/Done ala template → pakai `awaiting`/`preparing`/`ready`), kartu item + qty + waktu berjalan. **Read-only murni** (mutasi tetap di Kasir) — tampilkan, jangan beri tombol.

### 6.4 Reservation (`/dashboard-v2/reservasi`)
**Sudah diprobe (29 Agu 2026): tidak ada tabel reservasi meja.** `Order_Reservations` adalah hold stok inventaris (kolom `inventory_item_id`, `reserved_qty`, `expires_at`), bukan booking meja — jangan dipakai sebagai sumber data reservasi. Jadi: halaman empty-state nyata gaya template, atau biarkan `soon: true`.

### 6.5 Settings (`/dashboard-v2/pengaturan`)
Gabungan Store Settings / Roles / Staffs dari template. Pajak: pakai `saveTax` dari `src/lib/tax-actions.ts` (sudah ada, form existing bisa diport ke gaya dp). Roles & staff: read-only dulu kecuali data sudah ada.

### 6.6 Addons, dsb.
Jika tak ada padanan data → nav `soon: true` tetap, jangan buat halaman kosong palsu.

### 6.7 (Nanti, SETELAH semua selesai) Lapisan DNA 3Diner
Font/logo/aksen 3Diner menggantikan biru template — satu PR terpisah, hanya `dp.css` + Shell, tanpa mengubah struktur.

## 7. Arsitektur & pola yang sudah berjalan

```
App/src/
├─ app/
│  ├─ dp.css                      ← SEMUA style dp (design tokens §8) — halaman baru menambah class .dp-* DI SINI
│  ├─ dashboard-v2/
│  │  ├─ layout.tsx               ← auth gate (getStaffContext + canOpenOwnerConsole(ctx.role) → redirect /login) + <DpShell>
│  │  ├─ page.tsx                 ← Dashboard: 4 KPI, line chart SVG 30 titik, Top Selling, donut kategori, Active Orders
│  │  └─ pesanan/page.tsx         ← query Orders 30 hari → <OrdersBoard>
├─ components/dp/
│  ├─ Shell.tsx                   ← sidebar 2 kolom + topbar. NAV di const NAV_MAIN/NAV_SUB (soon: true = disabled beralasan)
│  └─ OrdersBoard.tsx             ← "use client": tabs ber-counter, search (token/meja/nama item), grid↔list, pager 9/hal, expand "+N item"
└─ lib/  (staff-context.ts, supabase-admin.ts, dashboard-today.ts, *-actions.ts)
```

Pola halaman baru: `page.tsx` server → gate auth → query `supabaseAdmin` (kolom persis §5) → map data → render markup `.dp-*` → CSS masuk `dp.css`. Komponen interaktif dipisah `"use client"` dan menerima props.

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
Font: **Instrument Sans** (fallback sans-serif) — Google Font, tambahkan via `next/font/google` di layout (belum dipasang saat handoff; Poppins global jangan diubah untuk route lain). Item nav 38.6px tinggi, px-10/py-8, radius 6; item aktif = bg putih + teks `#0f172a` + drop-shadow halus; rail bg `#f8f8f8`; header toko 58px logo 24px radius-12; topbar putih 58.8px; badge notif merah `#ff3636`; KPI card ~272×95.

## 9. Gotchas (semua sudah pernah menggigit)

1. **`.next` terkunci server hidup** → sebelum `npm run build`, kill PID port 3000: `PID=$(netstat -ano | grep ":3000" | grep LISTENING | head -1 | awk '{print $NF}'); taskkill /PID $PID /T /F`. Setelah build, start ulang.
2. **Sintaks cmd (`>nul`) gagal diam-diam di bash** — pakai `2>&1 | head` atau abaikan output.
3. Type error `.next/dev/types` sesudah hapus route → `rm -rf .next` lalu build ulang.
4. `--max-warnings 0` di eslint: import tak terpakai = gagal. Rapikan sebelum commit.
5. jsdom test environment & test lama `tests/` tidak tahu dp — kalau menambah test, polanya lihat `tests/` existing.
6. Klik via CDP kadang tidak memicu React; untuk uji state React pakai native setter:
   `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'x'); input.dispatchEvent(new Event('input',{bubbles:true}))`.
7. `vision_analyze`/screenshot service kadang timeout — DOM assertion lebih andal.
8. `revalidatePath("/dashboard-v2/...")` dari lib lama aman dipakai; arahkan ke route baru yang relevan.
9. Halaman login masih memakai kelas `dv2-pill` dari `globals.css` — **jangan hapus blok CSS `dv2-*`** di globals.
10. Commit style: conventional, bahasa Indonesia, scope `dp:` — contoh `feat(dp): halaman Items ala Dream POS — grid produk + filter kategori`.

## 10. Definition of Done (per halaman & keseluruhan)

Per halaman: (a) markup dibandingkan berdampingan dengan screenshot template (fullpage) — struktur, urutan widget, ukuran, warna sama; (b) semua data nyata dari Supabase, kosong = empty-state jujur; (c) semua kontrol berfungsi; (d) tsc + eslint `--max-warnings 0` + build + `npm run test:ci` hijau; (e) cek read-only: `grep -rn "ubah\|konfirm\|batalkan\|proses" App/src/components/dp App/src/app/dashboard-v2` nihil untuk aksi mutasi; (f) satu commit per halaman.
Keseluruhan: semua nav tanpa `soon: true` punya halaman hidup → lalu PR terpisah DNA 3Diner (aksen biru → identitas 3Diner, logo, font brand) tanpa mengubah struktur.

## 11. Referensi

- Template live: `https://dreamspos.dreamstechnologies.com/restaurant-pos/html/index.html` (+ halaman lain, §6)
- Rencana induk: `docs/DASHBOARD-REBUILD-PLAN.md` · `docs/DASHBOARD-IMPLEMENTATION-PLAN.md` · handoff teknis sebelumnya: `docs/HANDOFF_3Diner_2026-08-26.md`
- Brand: `docs/BRAND-DESIGN.md`, `docs/DESIGN.md` (untuk fase DNA 3Diner di akhir)
