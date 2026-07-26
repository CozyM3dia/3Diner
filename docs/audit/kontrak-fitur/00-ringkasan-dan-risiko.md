# Kontrak Fitur Dashboard 3Diner — Ringkasan & Peta Risiko

Dokumen ini adalah pengantar untuk kontrak **"TIDAK ADA FITUR HILANG"** menjelang rebuild total UI dashboard.
Sumber: inventaris 8 area dashboard pada repo `C:\Kerja\3Diner\App` (Next.js 16 + Supabase).

Semua path di bawah relatif terhadap `C:\Kerja\3Diner\App\` kecuali disebut lain.

---

## 1. Ringkasan

**Total: 564 fitur terinventaris di 8 area.**

| # | Area | Jumlah fitur | Porsi |
|---|---|---:|---:|
| 1 | Shell & navigasi (`DashboardShell`, `LogoutButton`, `system/` 12 file, `dashboard/layout.tsx`, 8 `loading.tsx`, `dashboard-context.ts`, 8 primitif `ui/`) | 49 | 8,7% |
| 2 | Analitik `/dashboard` | 73 | 12,9% |
| 3 | Penjualan `/revenue` | 104 | 18,4% |
| 4 | Pesanan `/orders` | 53 | 9,4% |
| 5 | Menu `/menu` (daftar, tambah, edit — `MenuTable`, `MenuForm`, `MenuOptionsEditor`, `MenuActiveToggle`, `FileUpload`, `RecipeEditor`, `MenuExtractor`, `Tripo3DGenerator`, `AiCreditMeter` + server action pendukung) | 79 | 14,0% |
| 6 | Fitur AI (Ekstrak Menu, Auto-Isi Detail Gemini, Generate 3D Tripo, Meteran Jatah AI) | 61 | 10,8% |
| 7 | Inventory | 70 | 12,4% |
| 8 | Pengaturan, QR, Jadwal & Diskon, Pengumuman | 75 | 13,3% |
| | **Total** | **564** | **100%** |

### Apa arti angka ini untuk rencana rebuild

564 bukan jumlah layar atau komponen — itu jumlah **perilaku yang harus tetap ada**, dan mayoritasnya tidak
terlihat di screenshot. Dua area terbesar (Penjualan 104 dan Menu 79) besar bukan karena UI-nya rumit,
tapi karena keduanya penuh aturan kecil: batas panjang input, pembulatan, format ekspor, dan varian state
yang jarang muncul. Rebuild yang dikerjakan "sambil melihat halaman lama" secara statistik akan menangkap
mungkin 60–70% dari daftar ini, karena sisanya hanya terbaca di kode — `cache()`, `revalidatePath`,
bucket tanggal WIB, restore-focus, dedupe realtime, dan scoping `cafe_id`. Konsekuensinya: **screenshot
tidak boleh dipakai sebagai kriteria selesai.** Setiap area harus di-checklist terhadap daftar fiturnya
sebelum PR-nya dianggap layak merge, dan file `01-*.md` dst. adalah checklist itu.

Angka lain yang perlu jadi patokan: dari 32 file test yang ada, hanya sekitar sepertiga menyentuh area
dashboard secara langsung, dan **dua area besar praktis tidak punya test sama sekali** (Analitik dan
Pengaturan/Jadwal/Pengumuman). Artinya rebuild di dua area itu berjalan tanpa jaring pengaman — regresi
di sana tidak akan ditangkap CI, hanya oleh review manual terhadap dokumen ini.

---

## 2. PALING MUDAH HILANG DIAM-DIAM

30 fitur paling berisiko dari 564, diurutkan dari yang paling parah. Kriteria yang dipakai:
tidak terlihat di screenshot · tidak punya test · hanya muncul di state langka (kosong/error/offline/izin) ·
perilaku yang hanya terbaca di kode.

Urutan mempertimbangkan dua hal sekaligus: **seberapa besar kerusakannya** dan **seberapa lama kerusakan itu
bisa bertahan tanpa ketahuan**. Yang di atas adalah kombinasi terburuk: salah, mahal, dan diam.

### Daftar cepat

| # | Fitur | Area | Test? |
|---|---|---|---|
| 1 | Bucket tanggal/jam/hari WIB di analitik | Penjualan/Analitik | ❌ |
| 2 | `startOfTodayWIB` untuk Omzet Hari Ini | Analitik | ❌ |
| 3 | `isMenuAvailableNow` — jadwal tayang WIB | Jadwal | ❌ |
| 4 | `formatDateISO` manual di DateRangePicker | Analitik/Penjualan | ❌ |
| 5 | Penghitung tab pesanan dihitung dari data penuh | Pesanan | ❌ |
| 6 | Batas `<=` pada `summarizeInventory` | Inventory | ✅ |
| 7 | Scoping `cafe_id` di halaman Edit Menu | Menu | ❌ |
| 8 | `getSalesExport`: scoping pemilik + `.limit(2000)` | Penjualan | ❌ |
| 9 | RPC `consume_ai_credit` — `FOR UPDATE` + reset bulanan | AI | ❌ |
| 10 | `claimAiCredit` fail-closed + field `code` | AI | ⚠️ sebagian |
| 11 | Sanitasi & batas server pada `bulkCreateMenus` | Menu/AI | ⚠️ sebagian |
| 12 | Gerbang sesi + `redirect("/login")` di layout & 4 page | Shell/semua | ❌ |
| 13 | Pengumuman: `id` menentukan insert vs update | Pengumuman | ❌ |
| 14 | Dedupe auth+kafe lewat React `cache()` | Semua | ❌ |
| 15 | `revalidatePath` + `router.refresh()` sebagai pasangan | Semua | ⚠️ inventory saja |
| 16 | Upload media lewat signed URL langsung ke Supabase | Menu | ❌ |
| 17 | Simpan GLB permanen ke Supabase (bukan CDN Tripo) | AI | ❌ |
| 18 | Restore-focus modal Inventory (3 bagian sinkron) | Inventory | ❌ |
| 19 | Restore-focus modal struk Pesanan | Pesanan | ✅ |
| 20 | Live region `aria-live` sr-only di InventoryTable | Inventory | ⚠️ helper saja |
| 21 | `#dash-portal-root` + pemisahan token portal | Shell | ✅ |
| 22 | `ResponsiveDataView` — state ketiga `null` | Shell/Menu | ✅ |
| 23 | Cincin fokus oranye + `.dash-input:focus` | Semua | ❌ |
| 24 | Dua-ref outside-click + Escape di DateRangePicker | Analitik/Penjualan | ❌ |
| 25 | Toast realtime putus/tersambung + flag `hadIssue` | Pesanan | ✅ |
| 26 | Dedupe INSERT realtime + `tag` notifikasi OS | Pesanan | ⚠️ toast saja |
| 27 | Cabang DELETE realtime membaca `payload.old` | Pesanan | ❌ |
| 28 | Fallback "Bahan dihapus" di riwayat mutasi | Inventory | ❌ |
| 29 | `AiCreditMeter`: null = sembunyi, ambang 20%, `periodLabel` | AI/Menu | ❌ |
| 30 | Empty state versi hasil filter + anchor `#qr-menu` | Pesanan | ❌ |

### Rincian

---

**1. Bucket tanggal / jam / hari berbasis zona WIB**
- **Lokasi:** `src/lib/analytics.ts:14-25`, `:133-140`, `:156-163`, `:319`, `:347-348`
- **Kenapa mudah hilang:** tiga helper `Intl.DateTimeFormat` dengan `timeZone: "Asia/Jakarta"` — `wibDateKey`
  (`en-CA` → `YYYY-MM-DD`), `wibHour` (`hourCycle: h23`), `wibWeekday` (Senin = indeks 0). Semuanya terlihat
  seperti boilerplate yang "bisa disederhanakan" jadi `getHours()` / `getDay()` / `toISOString().slice(0,10)`.
  Tidak ada satu pun test yang menyentuh file ini; test lain justru me-*mock* `@/lib/analytics`.
- **Akibat kalau hilang:** di Vercel (UTC) seluruh heatmap jam bergeser 7 jam dan label hari bergeser satu
  posisi. Pesanan pukul 23:30 WIB masuk ke hari berikutnya, sehingga omzet harian bergeser lintas hari.
  Semua angka tetap terlihat wajar — ini kelas bug laporan keuangan yang bisa bertahan berbulan-bulan
  sebelum ada yang mencocokkan dengan kas.

**2. `startOfTodayWIB` untuk metrik Omzet Hari Ini**
- **Lokasi:** `src/lib/dashboard-today.ts:16-24`, `:33-51`; dipakai di `src/app/dashboard/page.tsx:156`
- **Kenapa mudah hilang:** menghitung tanggal WIB lalu membangun ISO literal `` `${yyyy-mm-dd}T00:00:00+07:00` ``.
  Terlihat berbelit dibanding `new Date().setHours(0,0,0,0)` yang "benar" di laptop developer.
- **Akibat kalau hilang:** di server UTC, batas hari mundur 7 jam — omzet pagi (00:00–07:00 WIB) hilang dari
  kartu "Hari Ini", dan pesanan malam kemarin ikut terhitung. Tidak ada error, hanya angka yang salah setiap hari.

**3. `isMenuAvailableNow` — jadwal tayang menu berbasis WIB**
- **Lokasi:** `src/lib/menu-availability.ts:8-38`; dikonsumsi juga oleh halaman pelanggan via `src/lib/supabase.ts:41`
- **Kenapa mudah hilang:** tiga lapis aturan yang hanya terbaca di kode — `is_active === false` menang duluan;
  pemetaan `Sun..Sat` → `0..6` lalu Minggu dikonversi jadi 7 (ISO); perbandingan jam sebagai string `'HH:MM'`
  dengan dua rumus berbeda (jendela sehari `cur<start||cur>end` vs jendela lintas tengah malam
  `cur<start&&cur>end`); jadwal kosong = selalu tersedia.
- **Akibat kalau hilang:** menu tersembunyi atau tampil pada jam yang salah **di halaman pelanggan**, bukan di
  dashboard. Pemilik kafe tidak melihat apa pun yang aneh di dashboard-nya; yang komplain adalah pembeli, dan
  penyebabnya sulit dilacak balik ke rebuild UI. Jendela lintas tengah malam (mis. 22:00–02:00) adalah
  kasus yang hampir pasti tidak diuji manual.

**4. `formatDateISO` manual di DateRangePicker + rentang lewat URL query param**
- **Lokasi:** `src/components/dashboard/DateRangePicker.tsx:116-132`; dikonsumsi di `src/app/dashboard/page.tsx:52-57`
- **Kenapa mudah hilang:** `applyDates` sengaja membangun `URLSearchParams` dari `searchParams` yang **sudah ada**
  (agar parameter lain tidak terhapus), dan sengaja memformat tanggal manual lewat
  `getFullYear/getMonth/getDate` alih-alih `toISOString()`.
- **Akibat kalau hilang:** dua kerusakan sekaligus. (a) Kalau rentang dipindah ke `useState` lokal, kemampuan
  bookmark / tombol back / share URL hilang dan halaman berubah jadi client-rendered. (b) Kalau `toISOString()`
  dipakai, tanggal bergeser ke hari sebelumnya untuk user WIB yang membuka dashboard dini hari — rentang laporan
  meleset satu hari tanpa gejala.

**5. Penghitung angka per tab dihitung dari seluruh data, bukan hasil filter**
- **Lokasi:** `src/components/dashboard/OrdersClient.tsx:529-534`, `:559-562`
- **Kenapa mudah hilang:** `counts` dihitung dari array `orders` penuh, sementara yang dirender adalah `shown`
  (hasil filter). Saat menulis ulang, refleks alami adalah menghitung dari variabel yang sedang dipakai.
- **Akibat kalau hilang:** semua chip tab non-aktif menampilkan `0`, sehingga kasir tidak bisa melihat ada
  berapa pesanan di status lain tanpa mengklik satu per satu. Tidak melempar error, lolos code review, dan
  di layar dengan sedikit data terlihat "masuk akal".

**6. Batas `<=` vs `<` pada `summarizeInventory`**
- **Lokasi:** `src/lib/dashboard-inventory.ts:19-26`
- **Kenapa mudah hilang:** `low` = `current_qty > 0 && current_qty <= minimum_qty`, `empty` = `current_qty <= 0`
  — keduanya saling eksklusif dan bergantung pada operator yang mudah tertukar saat logikanya ditulis ulang
  langsung di komponen.
- **Akibat kalau hilang:** item yang persis menyentuh stok minimum tidak lagi masuk hitungan "menipis", jadi
  peringatan restock telat satu siklus. Angkanya tetap tampil rapi, cuma salah satu.
  *Catatan: ini satu-satunya di tier atas yang sudah dijaga test* (`tests/inventory-dashboard.test.ts:41,56`).

**7. Scoping kepemilikan `cafe_id` di halaman Edit Menu**
- **Lokasi:** `src/app/dashboard/menu/[id]/edit/page.tsx:20-32`; server action `updateMenu`/`deleteMenu` di `src/lib/dashboard-actions.ts`
- **Kenapa mudah hilang:** query memakai `.eq('id_menu', id)` **dan** `.eq('cafe_id', cafe.id_cafe)`, lalu
  `notFound()` (bukan pesan error) bila tidak cocok. Filter kedua terlihat redundan bagi orang yang mengira
  RLS sudah menanganinya.
- **Akibat kalau hilang:** pemilik kafe A bisa membuka dan mengedit menu kafe B hanya dengan menebak URL.
  Kebocoran lintas-tenant yang tidak menghasilkan gejala visual apa pun di UI dan tidak akan muncul saat
  testing dengan satu akun.

**8. `getSalesExport`: scoping pemilik + batas 2000 baris**
- **Lokasi:** `src/lib/dashboard-actions.ts:217-267`
- **Kenapa mudah hilang:** verifikasi `auth.getUser()` → cari slug kafe milik user → filter `cafe_id` →
  `.order('created_at', desc)` → `.limit(2000)`. Batas 2000 tidak diumumkan di UI sama sekali.
- **Akibat kalau hilang:** hilangnya filter `cafe_id` = ekspor CSV berisi transaksi kafe lain (kebocoran data
  penjualan). Hilangnya `.limit(2000)` = query berat yang bisa timeout. Sebaliknya, batas 2000 yang
  dipertahankan tanpa notifikasi tetap jadi jebakan diam untuk kafe besar — kalau memang mau diperbaiki,
  itu harus keputusan sadar, bukan efek samping rebuild.

**9. RPC `consume_ai_credit` — `FOR UPDATE` + reset bulanan saat klaim**
- **Lokasi:** `migrations/2026-07-27_payment_credits_options.sql:51-110`
- **Kenapa mudah hilang:** logika bisnisnya ada di database, bukan di TypeScript. `SELECT ... FOR UPDATE`
  mengunci baris `Cafes` sehingga dua generate bersamaan tidak bisa menembus kuota; reset kuota bulanan terjadi
  **saat klaim**, bukan lewat cron. Orang yang membaca kode TS saja tidak akan tahu ini ada.
  `database-contract.test.ts` menguji migrasi security, inventory, rate limit, dan `min_select` — **tidak** migrasi ini.
- **Akibat kalau hilang / dipindah ke aplikasi:** race condition dua tab paralel bisa melewati kuota AI, dan
  logika reset terduplikasi (kuota ter-reset dua kali atau tidak sama sekali). Biaya API Gemini/Tripo naik tanpa
  ada yang memperhatikan sampai tagihan datang.

**10. `claimAiCredit` fail-closed dengan empat bentuk respons**
- **Lokasi:** `src/lib/ai-credits.ts:32-97`
- **Kenapa mudah hilang:** error RPC → 503 dengan pesan "Kuota AI tidak dapat diperiksa..." — **sengaja
  fail-closed**, berbeda dari rate limiter yang fail-open. Juga mengirim `code: "quota_exceeded"` /
  `"subscription_inactive"` yang saat ini tidak dipakai klien (klien hanya menampilkan teks `error`), jadi
  terlihat seperti field mati yang aman dihapus.
- **Akibat kalau hilang:** mengubah fail-closed jadi fail-open berarti setiap gangguan database membuka pintu
  generate AI tanpa batas — kerugian uang langsung. Menghapus `code` menutup jalan penanganan khusus di UI
  (mis. tombol upgrade langganan) tanpa error apa pun hari ini.

**11. Sanitasi & batas server pada `bulkCreateMenus` (dan batas nama di `generate-details`)**
- **Lokasi:** `src/lib/dashboard-actions.ts:109-137`; `src/app/api/menu/generate-details/route.ts:26-36`
- **Kenapa mudah hilang:** server memotong `nama_menu` 120 char, `description_menu` 400 char, `category` 60 char;
  harga = `Math.max(0, Math.round(x))` dengan fallback 0; menolak >100 menu sekali simpan. **Tidak satu pun
  batas ini tercermin di UI** — tidak ada `maxLength` pada input. Route `generate-details` juga menolak nama
  >120 char, lagi-lagi tanpa padanan di input.
- **Akibat kalau hilang:** data tersimpan berubah diam-diam (deskripsi panjang tidak lagi terpotong, harga
  desimal/negatif lolos). Sebaliknya kalau rebuild menambah `maxLength` dengan angka berbeda, user akan
  terpotong lebih awal dari yang server izinkan. Untuk `generate-details`, user bisa mengetik nama panjang dan
  baru gagal saat menekan Auto-Isi — pengalaman yang tampak seperti bug acak.

**12. Gerbang sesi + `redirect("/login")` di layout dan 4 page**
- **Lokasi:** `src/app/dashboard/layout.tsx:10-11`; `src/app/dashboard/menu/page.tsx:20-21`;
  `src/app/dashboard/settings/page.tsx:10-11`; `src/app/dashboard/scheduler/page.tsx:9-10`;
  `src/app/dashboard/announcements/page.tsx:9-10`
- **Kenapa mudah hilang:** ini lapisan kedua setelah middleware, jadi terlihat redundan. Saat page diubah jadi
  client component demi kemudahan state, guard-nya ikut lenyap.
- **Akibat kalau hilang:** flash shell kosong sebelum redirect (kalau guard dipindah ke klien), atau halaman
  ter-render tanpa proteksi ketika cookie sesi busuk tapi lolos middleware. Perlu diperhatikan juga:
  kondisi "login tapi belum punya kafe" harus tetap **lanjut render** dengan `cafe=null`, bukan ikut di-redirect.

**13. Pengumuman: `id` menentukan insert vs update**
- **Lokasi:** `src/components/dashboard/AnnouncementForm.tsx:59-78`; `src/lib/dashboard-actions.ts:493-515`
- **Kenapa mudah hilang:** form tidak mengandalkan atribut `name`; handler menyusun `FormData` sendiri dan
  hanya menyertakan `id` bila ada. Saat form ditulis ulang dengan pola `<form action={...}>` biasa, `id`
  gampang tertinggal karena tidak punya input yang terlihat.
- **Akibat kalau hilang:** setiap "simpan" membuat baris pengumuman baru. Halaman pelanggan tetap terlihat benar
  (mengambil yang terbaru), jadi **tidak ada gejala sama sekali** sementara tabel membengkak — sampai suatu
  saat ada yang mengaktifkan dua pengumuman dan urutannya jadi tak terduga.

**14. Dedupe auth + lookup kafe lewat React `cache()`**
- **Lokasi:** `src/lib/dashboard-context.ts:28-47`; `src/lib/analytics.ts:53-59`, `:69-76`, `:80-88`
- **Kenapa mudah hilang:** `getDashboardCafeContext`, `getSessionUserId`, `getOwnerCafeSlug`, `getCafeBySlug`
  masing-masing dibungkus `cache()`. Pembungkus itu hilang begitu file dipecah, fungsi disalin, atau komponen
  baru memanggil `createClient()` / `supabaseAdmin` langsung.
- **Akibat kalau hilang:** tidak ada error, tidak ada test yang gagal, tidak ada perubahan visual — hanya 3–4x
  query Supabase per halaman. Terasa sebagai "dashboard baru kok lebih lambat", dan kuota Supabase naik tanpa
  penjelasan. *Sekelas dengan ini:* prefetch 8 rute nav di `DashboardShell.tsx:61-64,107` (`router.prefetch`
  di `useEffect` **plus** `prefetch={true}` eksplisit per `<Link>`) — juga menghilang tanpa jejak visual
  dan tidak akan terasa di localhost.

**15. `revalidatePath` + `router.refresh()` sebagai pasangan**
- **Lokasi:** `src/lib/dashboard-actions.ts:135` (menu), `:274-286` (settings);
  `src/components/dashboard/InventoryTable.tsx:95-99` (`finishAction` → `router.refresh()`)
- **Kenapa mudah hilang:** dua mekanisme di dua file berbeda yang saling melengkapi. Masing-masing terlihat
  cukup sendirian, jadi salah satunya sering dianggap duplikat. Beberapa alur (mis. `MenuExtractor`) sengaja
  **hanya** mengandalkan `revalidatePath` tanpa `router.refresh()`.
- **Akibat kalau hilang:** UI terlihat "tidak menyimpan apa-apa" — tapi hanya di sebagian kasus, tergantung
  apakah user menavigasi atau tidak. Gejala intermiten yang sangat sulit direproduksi dan biasanya ditutup
  dengan `window.location.reload()` sebagai plester.
  Untuk settings, `str()` di `dashboard-actions.ts:49-54` juga wajib ikut: ia mengubah string kosong jadi
  `NULL` sehingga greeting/URL yang dikosongkan benar-benar terhapus, bukan tersimpan sebagai `""`.

**16. Upload media lewat signed URL langsung browser → Supabase**
- **Lokasi:** `src/components/dashboard/FileUpload.tsx:50-78`; `src/lib/dashboard-actions.ts:523-536`
- **Kenapa mudah hilang:** alur dua langkah — server action `createMediaUploadUrl` mengembalikan path + token +
  publicUrl (tanpa mentransfer file), lalu browser `uploadToSignedUrl` ke bucket `menu-media`, melewati
  serverless Vercel sepenuhnya. Terlihat over-engineered dibanding "POST file ke API route".
- **Akibat kalau hilang:** unggahan besar (foto 30MB, GLB) menabrak batas body serverless dan gagal — sementara
  UI-nya terlihat 100% identik. Yang error cuma sebagian user dengan file besar, jadi terlaporkan sebagai
  "kadang upload gagal".

**17. Simpan GLB permanen ke Supabase, bukan pakai CDN sementara Tripo**
- **Lokasi:** `src/components/dashboard/Tripo3DGenerator.tsx:77-88`; `src/app/api/tripo/save/route.ts:12-50`
- **Kenapa mudah hilang:** langkah ekstra `POST /api/tripo/save` yang memverifikasi status task (409 kalau belum
  `success`) lalu mengunduh dan menyimpan ulang model dengan prioritas `pbr_model` → `model`. Alasannya —
  link CDN Tripo kedaluwarsa — tidak tertulis di UI mana pun.
- **Akibat kalau hilang:** semua model 3D yang di-generate tampil normal saat dibuat, lalu **mati beberapa hari
  kemudian** secara serentak. Jeda antara penyebab dan gejala membuat ini nyaris mustahil dilacak balik ke rebuild.

**18. Restore-focus modal Inventory — tiga bagian yang harus sinkron**
- **Lokasi:** `src/components/dashboard/InventoryTable.tsx:83-104` (`returnFocusRef`, `restoreFocus`,
  `openModal`, `closeModal`) dan `:292` (`onCloseAutoFocus` di-`preventDefault`)
- **Kenapa mudah hilang:** tiga potongan di tempat berbeda: menyimpan `event.currentTarget` ke ref,
  `preventDefault` pada `onCloseAutoFocus` Radix, dan `requestAnimationFrame` sebelum `.focus()`. Menghapus
  salah satunya saja sudah merusak, dan tidak ada test yang menutupinya.
- **Akibat kalau hilang:** setelah menutup modal penyesuaian stok, fokus keyboard lompat ke `<body>`. Pengguna
  keyboard harus Tab dari awal halaman setiap kali menyesuaikan stok. Bagi pengguna mouse **tidak ada gejala
  apa pun**, jadi tidak akan pernah dilaporkan.

**19. Restore-focus modal struk Pesanan**
- **Lokasi:** `src/components/dashboard/OrdersClient.tsx:328-339`
- **Kenapa mudah hilang:** Dialog di-unmount begitu `previewOrder` jadi `null`, jadi restore-focus bawaan Radix
  tidak sempat jalan; `closeReceipt()` memanggil `requestAnimationFrame(() => receiptTriggerRef.current?.focus())`
  sebagai gantinya. Terlihat seperti kode aneh yang bisa dihapus.
- **Akibat kalau hilang:** sama dengan #18 — fokus hilang setelah setiap struk ditutup, di layar yang dipakai
  puluhan kali per shift. Ini **sudah dijaga** `tests/orders-sonner.test.tsx:140`, jadi CI akan menangkapnya —
  selama test itu tidak ikut ditulis ulang.

**20. Live region `aria-live` sr-only di InventoryTable**
- **Lokasi:** `src/components/dashboard/InventoryTable.tsx:108-110`
- **Kenapa mudah hilang:** div terpisah dengan `aria-live="polite" aria-atomic="true" className="sr-only"` yang
  **selalu ada di DOM** dan hanya isinya yang berubah. Terlihat seperti duplikat dari toast visual.
- **Akibat kalau hilang:** screen reader tidak mengumumkan hasil aksi stok sama sekali. Perhatikan detail
  halusnya: kalau live region dirender **kondisional** bersama toast, screen reader sering tidak membacanya
  karena elemen baru masuk DOM berbarengan dengan isinya — jadi "memperbaiki" dengan merender kondisional
  justru merusaknya, dan tidak ada yang tahu. Helper pesannya sudah dijaga
  (`tests/inventory-dashboard.test.ts:25`), tapi **keberadaan elemennya** tidak.

**21. `#dash-portal-root` + pemisahan token portal**
- **Lokasi:** `src/components/dashboard/system/portal.ts:5-10`; `DashboardShell.tsx:230`;
  `src/app/globals.css:415-417`, `:572-597`
- **Kenapa mudah hilang:** `<div id="dash-portal-root" className="dash-portal-root" />` di akhir `.dash-root`.
  Kelas `.dash-portal-root` **sengaja dipisah** dari `.dash-root` karena portal bukan anak DOM-nya.
  Dipakai diam-diam oleh 5 komponen: `InventoryTable.tsx:284`, `OrdersClient.tsx:252`,
  `StockAdjustmentModal.tsx:53`, `ConfirmAction.tsx:41`, `DashSheet.tsx:22`.
- **Akibat kalau hilang:** `getDashPortal()` mengembalikan `null` dan semua portal **jatuh ke `<body>` tanpa
  crash** — modal dan sheet kehilangan token warna dashboard dan berubah jadi putih polos. Mengganti nama
  id/kelas menghasilkan efek yang sama. Sebagian dijaga `tests/dash-token-adapter.test.tsx:32`.

**22. `ResponsiveDataView` — state ketiga `null` sebelum breakpoint diketahui**
- **Lokasi:** `src/components/dashboard/system/ResponsiveDataView.tsx:15-51`; dipakai di `MenuTable.tsx:209-384`
- **Kenapa mudah hilang:** `useIsDesktop` memakai `matchMedia('(min-width: 1024px)')` dengan state awal `null`
  yang berarti "mode belum diketahui". Saat itu **kedua cabang dirender** tapi yang tidak aktif disembunyikan
  lewat kelas breakpoint (keluar dari focus order), lalu setelah mount hanya satu yang benar-benar ter-mount.
  Pola ini rumit dan godaan untuk menyederhanakan jadi `hidden lg:block` sangat besar.
- **Akibat kalau hilang:** dua regresi. Dengan `hidden lg:block` permanen, elemen non-aktif tetap di DOM,
  menangkap fokus keyboard, dan menduplikasi `id` — tidak terlihat mata sama sekali. Kalau `null` diubah jadi
  `boolean`, muncul flash kartu mobile di desktop pada first paint.
  Dijaga `tests/dashboard-system.test.tsx:58,70,82` — termasuk test namespacing id.

**23. Cincin fokus oranye global + `.dash-input:focus`**
- **Lokasi:** `src/app/globals.css:196-199` (`:focus-visible` pada `input, textarea, button, a` →
  outline 2px `var(--orange)` offset 2px); `:480-481` (`.dash-input:focus`); pola field di
  `src/components/dashboard/system/fields.tsx:3-38`
- **Kenapa mudah hilang:** aturan CSS global tanpa pemilik yang jelas. `dashInputClass` memakai `outline-none`
  dan **bergantung sepenuhnya** pada `.dash-input:focus` sebagai penggantinya. Rebuild dengan sistem komponen
  yang punya ring sendiri (`ring-2 ring-ring`) akan menimpanya.
- **Akibat kalau hilang:** kalau `.dash-input:focus` hilang tapi `outline-none` bertahan, **6 form**
  (`SettingsForm`, `AnnouncementForm`, `InventoryItemForm`, `MenuOptionsEditor`, `RecipeEditor`,
  `StockAdjustmentModal`) tidak punya indikator fokus sama sekali. Kegagalan aksesibilitas serius yang
  tidak terlihat kecuali diuji dengan keyboard. Versi ringannya: warna oranye brand berubah jadi biru default
  library — kalah penting, tapi tetap regresi identitas visual.

**24. Dua-ref outside-click + Escape di DateRangePicker**
- **Lokasi:** `src/components/dashboard/DateRangePicker.tsx:62-83`
- **Kenapa mudah hilang:** listener `mousedown` memeriksa `containerRef` (trigger) **dan** `dropdownRef` (panel
  yang di-portal) — dua-duanya perlu justru karena panel bukan anak DOM dari trigger. Listener `keydown` untuk
  Escape terpasang permanen, tidak bergantung state `isOpen`.
- **Akibat kalau hilang:** kalau hanya satu ref yang diperiksa, mengklik **di dalam** kalender langsung menutup
  panel — picker jadi benar-benar tidak bisa dipakai. Ironisnya ini kerusakan yang kentara, tapi hanya kalau
  ada yang benar-benar mencoba memilih tanggal; Escape sendiri hampir selalu terlupa karena tidak terlihat di UI.

**25. Toast peringatan realtime putus & tersambung kembali (flag `hadIssue`)**
- **Lokasi:** `src/components/dashboard/OrdersClient.tsx:476-489`
- **Kenapa mudah hilang:** hanya muncul di state `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` — kondisi yang tidak
  pernah terjadi saat development. Flag `hadIssue` mencegah toast "tersambung kembali" muncul saat halaman
  pertama dibuka, dan `id: "realtime-status"` mencegah tumpukan.
- **Akibat kalau hilang:** kasir tidak punya sinyal apa pun bahwa layarnya sudah basi. Pesanan masuk tidak
  muncul, dan tidak ada yang tahu sampai ada pembeli yang menanyakan pesanannya.
  Dijaga `tests/orders-sonner.test.tsx:99`.

**26. Dedupe INSERT realtime + `tag` notifikasi OS**
- **Lokasi:** `src/components/dashboard/OrdersClient.tsx:462-467` (dedupe di dalam updater `setOrders`);
  `:377-386` (Notification dengan `tag = row.id_order`); `:388-421` (toast dengan `id`)
- **Kenapa mudah hilang:** dedupe dilakukan **di dalam** updater `setOrders` (`prev.some(...)`) beserta efek
  sampingnya — pola tidak lazim yang hampir selalu "dirapikan" keluar saat rebuild. Properti `tag` pada
  `Notification` tidak terlihat di UI sama sekali.
- **Akibat kalau hilang:** setiap reconnect Supabase mengirim ulang event dan alarm berbunyi untuk pesanan lama;
  layar dapur banjir toast identik; pusat notifikasi OS menumpuk duplikat. Perhatikan juga bahwa body
  notifikasi memakai **jumlah item** (bukan jumlah baris) — beda halus yang gampang salah.
  Sisi toast dijaga `tests/orders-sonner.test.tsx:86`; sisi Notification dan `tag` tidak.

**27. Cabang DELETE realtime membaca `payload.old`**
- **Lokasi:** `src/components/dashboard/OrdersClient.tsx:470-473`; channel di `:450-494`
- **Kenapa mudah hilang:** `payload.new` kosong pada event DELETE, jadi id diambil dari `payload.old`.
  Membaca `payload.new` **tidak melempar error**, cuma tidak berefek. Cabang DELETE jarang terpakai
  sehari-hari sehingga hampir pasti tidak diuji manual.
- **Akibat kalau hilang:** pesanan yang dihapus tetap nangkring di layar dapur sampai reload. Sekaligus catat
  risiko tetangganya: nama channel `` `orders-${cafeId}` `` dan string filter `` `cafe_id=eq.${cafeId}` ``
  disaring **di server** — salah ketik membuat langganan diam-diam tidak menerima apa pun (halaman jadi statis
  tanpa error), dan menghapus filternya membuat setiap kafe menerima event kafe lain.

**28. Fallback "Bahan dihapus" di riwayat mutasi**
- **Lokasi:** `src/components/dashboard/InventoryTable.tsx:250` (`movement.inventory_item?.name ?? "Bahan dihapus"`)
- **Kenapa mudah hilang:** optional chaining + nullish fallback yang hanya penting kalau join ke
  `Inventory_Items` mengembalikan `null` — yaitu hanya setelah ada bahan yang benar-benar dihapus. Data
  testing tidak pernah dalam kondisi ini.
- **Akibat kalau hilang:** `movement.inventory_item.name` meledak dengan runtime error dan **seluruh halaman
  Inventory jadi blank**. Baru ketahuan di produksi, di kafe yang kebetulan pernah menghapus bahan.

**29. `AiCreditMeter`: null berarti sembunyi, ambang 20%, dan `periodLabel` fallback**
- **Lokasi:** `src/components/dashboard/AiCreditMeter.tsx:4-13`, `:20-89`; dirender dari
  `src/app/dashboard/menu/page.tsx:82-86`
- **Kenapa mudah hilang:** tiga aturan yang hanya ada di kode — (a) data `null` berarti **komponen tidak
  dirender**, bukan menampilkan `0 / 0`; (b) ambang peringatan `Math.max(1, ceil(quota * 0.2))`;
  (c) `periodLabel()` mengembalikan teks "bulan ini" bila tanggalnya tidak valid.
- **Akibat kalau hilang:** saat backend kuota bermasalah, pemilik kafe melihat "0 / 0 kredit tersisa" dan
  mengira langganannya mati — panik dan tiket support tanpa sebab. Tanpa guard `periodLabel`, yang tampil
  adalah "Invalid Date" atau "NaN NaN" di dashboard produksi.

**30. Empty state versi hasil filter + anchor `#qr-menu`**
- **Lokasi:** `src/components/dashboard/OrdersClient.tsx:582-598`; kontrak di
  `src/components/dashboard/system/DashboardStates.tsx:9-34`
- **Kenapa mudah hilang:** empty state biasanya hanya dipikirkan untuk "belum ada data sama sekali", bukan
  untuk "filter tidak menghasilkan apa-apa". Komentar di `DashboardStates.tsx:5` menegaskan kontraknya:
  empty state harus **mengajarkan langkah berikutnya**, bukan sekadar bilang kosong. CTA-nya menunjuk
  anchor `#qr-menu` di halaman Pengaturan.
- **Akibat kalau hilang:** kafe baru membuka `/orders`, melihat layar kosong tanpa arahan, dan tidak tahu
  bahwa langkah berikutnya adalah membagikan QR menu — onboarding gagal diam-diam. Anchor `#qr-menu` juga
  gampang putus kalau id di halaman Pengaturan ikut diganti, menghasilkan tombol yang mendarat di tempat salah.
  Catatan terkait: pada `DashboardStates`, **border merah adalah satu-satunya sinyal warna** bahwa itu error
  state — ganti jadi border netral dan error terlihat seperti panel biasa.

---

## 3. SUDAH DIJAGA TEST vs TIDAK ADA JARING PENGAMAN

Direktori test: `C:\Kerja\3Diner\App\tests\` — 32 file.

### 3.1 Peta file test → apa yang dijaga

| File test | Menjaga | Area dashboard |
|---|---|---|
| `dashboard-shell-shadcn.test.tsx` | 8 rute nav tetap terjangkau, satu region Sonner, nama aksesibel + target 44px trigger menu mobile, `aria-current` rute aktif | Shell |
| `dashboard-system.test.tsx` | `StatusBadge` (label + titik non-warna-saja, override label), `ResponsiveDataView` (mount satu cabang saja desktop/mobile, namespacing id anti-duplikat), `ConfirmAction` (onConfirm hanya lewat tombol konfirmasi) | Shell |
| `dash-token-adapter.test.tsx` | `#dash-portal-root` termount di shell dengan kelasnya sendiri, adapter variabel shadcn hanya mengenai selector dashboard, token light pelanggan utuh | Shell |
| `dashboard-inventory-actions.test.ts` | Server action inventory + `revalidatePath("/dashboard/inventory")` dipanggil, dan `/dashboard/menu` **tidak** ikut di-revalidate | Inventory |
| `inventory-dashboard.test.ts` | Label tipe mutasi, jarak scroll arrow key horizontal, teks live region, aturan qty add/subtract/set-zero, `summarizeInventory`, prioritas item habis & di bawah minimum | Inventory |
| `inventory.test.ts` | `inventoryStatus`, `formatQty`, `requiredInventoryForOrder` | Inventory |
| `database-contract.test.ts` | Kontrak migrasi: policy Orders + order token, skema inventory + RPC atomik, RLS tabel inventory, `id_order` text-compatible, validasi JSON item, agregasi menu duplikat, row locking + isolasi kafe, rate-limit counter di Postgres + pruner, clamp `min_select` | Inventory / Pesanan / DB |
| `menu-form-save.test.ts` | `saveMenuAndRecipes` | Menu |
| `menu-options.test.ts` | `cartLineKey`, `optionGroupsValidationError`, `shapeOptionGroups` | Menu |
| `menu-table-inventory.test.ts` | Kesiapan stok yang ditampilkan di `MenuTable` | Menu |
| `menu-page-inventory-errors.test.ts` | Penanganan error query inventory di halaman menu | Menu |
| `recipe-editor.test.ts` | Pemilihan baris, validasi kuantitas, konteks inventory di editor resep | Menu/Inventory |
| `menu-3d-transition.test.tsx` | `Menu3DTransitionLink` | Menu (sisi pelanggan) |
| `orders-sonner.test.tsx` | Toast dedupe by order id, toast disconnect dengan id tetap, restore-focus setelah struk ditutup, komponen system di OrdersClient | Pesanan |
| `orders-route.test.ts`, `orders-inventory-route.test.ts`, `orders-client.test.ts` | `POST /api/orders`, integrasi inventory, error klien saat membuat order | Pesanan (sisi API) |
| `order-validation.test.ts`, `order-payment-sync.test.ts`, `order-request.test.ts` | `calculateOrderTotal`, verifikasi signature Midtrans, `GET /api/orders/[id]`, `POST .../payment`, `parseItems` | Pesanan (sisi API) |
| `receipt-html-escaping.test.ts` | Escaping HTML pada `buildReceiptHtml` | Pesanan |
| `rate-limit.test.ts` | `clientIp`, `consumeRateLimit`, rate limiting `POST /api/orders` | Lintas area |
| `ai-credits.test.ts` | Metering kredit AI pada `/api/tripo/generate` | AI |
| `menu-ai-route-auth.test.ts` | Auth pada `POST /api/menu/extract` dan `/api/menu/generate-details` | AI |
| `sales-csv-injection.test.ts` | `csvCell` formula guard, `buildSalesCsv` | Penjualan (ekspor) |
| `sales-report-html-escaping.test.ts` | Escaping pada `buildSalesReportHtml` | Penjualan (ekspor) |
| `qr-smart-menu.test.ts` | Helper `site-url`, helper `qr-render`, komponen `QrSmartMenu` | Pengaturan/QR |
| `qr-proxy-ssrf.test.ts` | Guard SSRF pada `GET /api/payment/qr-proxy` | API pembayaran |
| `payment-charge.test.ts` | `POST /api/payment/charge` | API pembayaran |
| `capture-share.test.ts`, `cart-view-recovery.test.tsx`, `viewer-3d-entrance.test.tsx` | Fitur sisi pelanggan (share, pemulihan keranjang, entrance viewer 3D) | Di luar dashboard |

### 3.2 Rekap per area

| Area | Fitur | Kekuatan jaring | Catatan |
|---|---:|---|---|
| Inventory | 70 | **Kuat** | 4 file test (aksi, ringkasan, helper, kontrak DB). Yang belum tertutup: restore-focus modal, keberadaan elemen live region, fallback "Bahan dihapus". |
| Pesanan | 53 | **Kuat** (client) / **Kuat** (API) | `orders-sonner` menutup toast dedupe, disconnect, dan restore-focus. Belum tertutup: cabang DELETE realtime, `tag` Notification, `counts` dari data penuh, `triggerPrint`. |
| Menu | 79 | **Sedang** | Logika simpan, opsi, resep, dan kesiapan stok tertutup. UI-nya (MenuForm, MenuActiveToggle, FileUpload, pratinjau kartu) tidak. Scoping `cafe_id` halaman edit tidak. |
| Shell & navigasi | 49 | **Sedang** | 3 file menutup nav, `ResponsiveDataView`, `ConfirmAction`, `StatusBadge`, portal root, token. Tidak tertutup: guard sesi layout, prefetch, cincin fokus, `fields.tsx`, 8 `loading.tsx`. |
| Fitur AI | 61 | **Tipis** | Hanya metering `/api/tripo/generate` dan auth 2 route. Tidak tertutup: `claimAiCredit` fail-closed, `normalizeDetails`, `/api/tripo/save`, `AiCreditMeter`, migrasi `consume_ai_credit`. |
| Penjualan `/revenue` | 104 | **Tipis** | Hanya 2 file, keduanya di level helper ekspor (CSV injection, HTML escaping). Seluruh agregasi, chart, dan `getSalesExport` telanjang. |
| **Analitik `/dashboard`** | **73** | **TELANJANG** | **Nol test.** File `@/lib/analytics` justru di-*mock* di test lain, jadi tidak ada satu pun assertion terhadap isinya. |
| **Pengaturan / Jadwal / Pengumuman** | **75** (dikurangi porsi QR) | **TELANJANG** | Hanya QR yang punya test (`qr-smart-menu`). `SettingsForm`, `AnnouncementForm`, halaman scheduler, dan `menu-availability.ts` sama sekali tanpa test. |

### 3.3 Area telanjang — apa artinya untuk rebuild

Dua area dengan **nol jaring pengaman** justru berisi tiga dari empat item teratas daftar risiko:

- **Analitik `/dashboard` (73 fitur, 0 test).** Berisi `wibDateKey` / `wibHour` / `wibWeekday`
  (`src/lib/analytics.ts:14-25`), `startOfTodayWIB` (`src/lib/dashboard-today.ts:16-24`), `formatDateISO`
  manual dan sinkronisasi URL query di `DateRangePicker`, `cache()` dedupe, serta seluruh chart
  (`DonutChart`, `WeekdayBars`, `RevenueChart`) beserta detail seperti prop `centerLabel` dan tooltip
  atribut `title`. Semua ini bisa salah tanpa satu pun test gagal.
- **Pengaturan / Jadwal & Diskon / Pengumuman (75 fitur, hanya QR yang tertutup).** Berisi
  `isMenuAvailableNow` (`src/lib/menu-availability.ts:8-38`) yang **juga dipakai halaman pelanggan**,
  pola insert-vs-update Pengumuman, batas 120 karakter dengan `slice()` anti-paste, normalisasi `str()` →
  `NULL`, dan `revalidatePath("/dashboard/settings")`.

**Rekomendasi minimum sebelum rebuild dua area itu dimulai:** tulis test karakterisasi untuk fungsi murni
yang paling mahal kalau salah — `wibDateKey`/`wibHour`/`wibWeekday`, `startOfTodayWIB`, `isMenuAvailableNow`
(termasuk kasus jendela lintas tengah malam), `summarizeInventory`, dan agregasi Top 6 di
`src/lib/analytics.ts:354-364`. Kelimanya fungsi murni tanpa dependensi UI, jadi biayanya kecil, dan
kelimanya mengunci justru jenis kerusakan yang paling lama tidak ketahuan.

Area yang **tidak** perlu test baru sebelum mulai: Inventory dan sisi API Pesanan — keduanya sudah punya
kontrak yang cukup ketat, termasuk di level migrasi database.
