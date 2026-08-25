# Rencana full rebuild dashboard 3Diner

**Status:** Disetujui untuk dieksekusi — scope final
**Tanggal:** 22 Agustus 2026
**Pembaruan keputusan:** 26 Agustus 2026
**Referensi inspirasi:** [Dream POS Restaurant Demo](https://dreamspos.dreamstechnologies.com/restaurant-pos/html/index.html)
**Rencana eksekusi terperinci:** [DASHBOARD-IMPLEMENTATION-PLAN.md](./DASHBOARD-IMPLEMENTATION-PLAN.md) (hasil audit 26 Aug 2026; termasuk keputusan: UI mengikuti template Dream POS 1:1 — fitur tanpa padanan seperti generasi model 3D & menu 3D/AR dirancang kreatif dalam bahasa visual template, integrasi Tripo API ditunda dengan upload manual tetap fungsional)

## 0. Keadaan sekarang

Rebuild ini **tidak dimulai dari lahan kosong**. `dashboard-v2` sudah ada, sudah punya keputusan arsitektur yang ditulis di kode, dan sebagian keputusan itu mengikat rencana di bawah.

### 0.1 Angka

| Area | Baris | Isi |
|---|---:|---|
| `src/app/dashboard-v2` + `src/components/dashboard-v2` | 2.748 | 7 rute, sebagian besar **read-only** |
| `src/app/dashboard` + `src/components/dashboard` (legacy) | 8.887 | seluruh write-path nyata |
| `src/app/kasir` + `src/components/kasir` | 1.206 | antrean kerja realtime |
| `src/app/globals.css` | 1.825 | 177 CSS variable, 136 kelas `dv2-*` |
| `src/components/ui` | — | 8 primitive shadcn |
| `tests/dashboard-v2-*.test.ts` | — | 7 file test lapisan lib |

### 0.2 Keputusan yang sudah terkunci di kode

Keputusan berikut sudah dieksekusi dan **tidak boleh dibatalkan diam-diam**. Membatalkannya butuh alasan tertulis di dokumen ini, bukan sekadar komponen baru.

1. **Pesanan di konsol owner adalah riwayat, bukan antrean kerja.** `src/app/dashboard-v2/pesanan/page.tsx` — antrean hidup di `/kasir` dan hanya di sana, supaya tidak ada dua tempat mengerjakan hal yang sama.
2. **Tujuh rute datar tanpa grup.** `src/components/dashboard-v2/OwnerShell.tsx` — label rute menu adalah `Menu`, bukan `Menu 3D`.
3. **Badge berangka hanya untuk antrean yang bisa dinolkan.** Satu badge yang tidak pernah bisa kosong merusak kepercayaan pada semua badge.
4. **Auth digate di layout, bukan di middleware.** `src/app/dashboard-v2/layout.tsx` memanggil `getStaffContext()` lalu `canOpenOwnerConsole()`.
5. **Token visual sudah ada.** Konsol memakai palet `--dash-*` (canvas gelap) yang sudah terdefinisi di `globals.css`.
6. **Owner bersifat monitor-only untuk order.** Owner dapat melihat order, payment, performa, dan aktivitas; perubahan status order tetap hanya dilakukan melalui `/kasir`.
7. **AI dan 3D adalah fitur inti, bukan fitur yang dikorbankan saat rebuild.** Menu extraction, AI detail generation, credit meter, model generation, upload model, preview 3D, dan AR tetap harus hadir di dashboard baru.
8. **UI ditargetkan recreation 1:1 secara visual.** Layout dan perilaku yang terlihat mengikuti template Dream POS, sementara palette, typography treatment, logo, foto, icon treatment, dan aset 3D/AR menggunakan identitas 3Diner.

### 0.3 Konsekuensi untuk rencana ini

- Phase 0 **memperluas** token yang ada, tidak mendefinisikan token baru.
- Phase 2 dan 3 tidak selesai berdasarkan tampilan, melainkan berdasarkan **Lampiran A — Parity checklist**.
- Cutover dari legacy ke v2 adalah pekerjaan tersendiri (Phase 3.5), bukan efek samping.

## 1. Keputusan produk

Dashboard 3Diner akan di-rebuild secara penuh pada lapisan **UI, information architecture, dan interaction design** dengan mengambil inspirasi dari Dream POS.

Rebuild ini menargetkan **recreation 1:1 terhadap UI yang terlihat dan perilaku interaksinya**: komposisi layout, navigasi, spacing, hierarchy, cards, table, tabs, filter, slide-over/modal, responsive behavior, hover/focus state, loading state, empty state, dan error state.

Yang tidak disalin adalah source code, markup internal, brand, font berlisensi, atau asset proprietary Dream POS. Dream POS dipakai sebagai referensi visual dan workflow; implementasinya tetap memakai stack, data, contract, palette, dan asset 3Diner. Bila font atau asset asli tidak tersedia, targetnya adalah fidelity visual setinggi mungkin dengan pengganti 3Diner yang setara.

Identitas, data, dan keunggulan 3Diner tetap menjadi inti:

- smart menu dengan 3D/AR;
- palette warna dan token visual 3Diner;
- logo, foto makanan, icon treatment, dan asset visual 3Diner;
- AI menu extraction, AI detail generation, credit meter, dan Tripo 3D generation;
- QR ordering;
- QRIS dan cash check-in;
- inventory, recipe, dan stock deduction;
- realtime order queue;
- workflow cafe Indonesia;
- bahasa, Rupiah, dan brand 3Diner.

Backend, authorization, payment contract, database, dan domain logic yang sudah berjalan tidak di-reset dalam fase visual rebuild.

## 2. Hasil audit singkat

Demo Dream POS memiliki 35 halaman utama: Dashboard, POS, Orders, Kitchen, Reservation, Tables, Menu Management, Customer, Invoice, Payment, Reports, Users, Roles, Audit Logs, Settings, dan Auth.

Demo tersebut kuat sebagai referensi breadth dan layout, tetapi sebagian kontrol masih bersifat template atau dekoratif. Temuan read-only yang perlu diingat:

- pencarian POS tidak selalu memfilter menu;
- detail produk dapat tidak sesuai dengan item yang dipilih;
- pagination Items tidak selalu mengubah data;
- filter floor table tidak benar-benar menyembunyikan meja;
- `View Note` dan `+2 More Items` tidak selalu membuka detail;
- banyak link masih menggunakan `href="#"` atau `javascript:void(0)`;
- kategori POS, tab Pending Orders, dan beberapa search table bekerja dengan baik.

Kesimpulannya: **yang ditiru adalah pola UX-nya, bukan bug dan struktur template-nya.**

## 3. Prinsip desain dashboard baru

### 3.1 Operational first

Beranda harus menjawab tiga pertanyaan dalam beberapa detik:

1. Apa yang sedang terjadi sekarang?
2. Apa yang membutuhkan tindakan saya?
3. Apa yang perlu diawasi hari ini?

KPI tetap ada, tetapi tidak boleh mengambil seluruh ruang dari live order, stok kritis, payment, dan task operasional.

### 3.2 Recreation 1:1 dengan identitas 3Diner

Struktur visual Dream POS direcreate sedekat mungkin, tetapi seluruh lapisan brand diganti dengan identitas 3Diner:

- palette yang bersumber dari token `--dash-*` dan token brand 3Diner;
- logo dan asset visual 3Diner, bukan asset demo Dream POS;
- foto menu dan model GLB/USDZ yang tersedia di domain 3Diner;
- preview foto, model 3D, dan AR pada Menu workspace;
- status `3D ready`, `AR ready`, atau `belum ada model`;
- AI action untuk extraction, detail generation, dan model generation;
- harga dalam Rupiah;
- QRIS sebagai workflow payment utama;
- istilah Bahasa Indonesia yang konsisten;
- seluruh button, tab, filter, pagination, modal, dan slide-over memiliki behavior nyata.

### 3.3 Data-dense tetapi tetap premium

- gunakan satu base color dan satu accent brand yang konsisten;
- hindari gradient ungu/biru generik;
- gunakan tabular figures untuk angka dan nominal;
- batasi lebar konten desktop sekitar 1.200–1.440px;
- gunakan grid untuk layout dashboard, bukan perhitungan flex percentage yang rapuh;
- jangan menjadikan semua elemen sebagai card dengan border dan shadow;
- gunakan hierarchy, whitespace, dan surface layering untuk membedakan prioritas.

### 3.4 Semua state harus nyata

Setiap halaman dan kontrol harus memiliki:

- loading state berbentuk skeleton;
- empty state yang informatif;
- error state inline;
- disabled state dengan alasan yang jelas;
- hover, focus, pressed, dan active state;
- feedback setelah save, cancel, payment, atau status update;
- tombol yang menuju route nyata atau benar-benar disabled.

## 4. Information architecture target

`dashboard-v2` menjadi shell dashboard utama. Dashboard legacy tetap dipertahankan sementara sebagai fallback sampai parity tercapai.

### Navigasi utama

Tujuh rute datar, mengikuti `OWNER_ROUTES` yang sudah ada di `OwnerShell`. Label dipertahankan apa adanya — `Menu`, bukan `Menu 3D`; kepemilikan 3D ditunjukkan lewat isi halaman, bukan lewat label nav.

1. **Beranda**
2. **Pesanan** — tab: Semua, Selesai, Dibatalkan, dan saringan riwayat lain. **Tidak ada tab live queue di sini** (lihat 5.2).
3. **Menu**
4. **Stok**
5. **Promo**
6. **Laporan**
7. **Pengaturan**

Badge berangka hanya boleh menempel pada rute yang antreannya benar-benar bisa dikosongkan. Rute yang angkanya tidak pernah nol memakai teks status, bukan badge.

### Modul lanjutan

Modul berikut disiapkan sebagai area terpisah setelah fondasi dashboard stabil:

- Dapur/Kitchen Display;
- Meja dan floor plan;
- Reservasi;
- Staff dan permission;
- Audit log;
- Invoice dan payment ledger.

## 5. Rancangan tiap halaman

### 5.1 Beranda

Struktur yang disarankan:

- header dengan nama cafe, branch context, tanggal, search, notification, dan profile;
- KPI strip: penjualan hari ini, order baru, order aktif, average order value;
- **ringkasan** antrean berjalan: jumlah per status, pesanan tertua yang belum diterima, dan satu CTA ke `/kasir`. Ringkasan ini read-only. Tidak ada tombol yang memajukan status pesanan di Beranda;
- task list: order belum diterima, stok kritis, menu belum lengkap, payment perlu dicek;
- revenue trend dan perbandingan periode;
- top menu dengan foto dan indikator 3D/AR;
- ringkasan stok kritis;
- activity feed untuk order, inventory, dan settings.

Beranda tidak boleh menjadi kumpulan chart tanpa tindakan. Setiap insight penting harus memiliki link atau action yang jelas.

### 5.2 Pesanan

UI mengambil kepadatan informasi dari Dream POS, tetapi mengikuti lifecycle 3Diner:

`awaiting -> received -> preparing -> ready -> completed`

**Pembagian tanggung jawab (mengikat, tidak boleh ditawar saat implementasi):**

| Permukaan | Peran | Boleh mengubah status? |
|---|---|---|
| `/kasir` | antrean kerja realtime, satu-satunya | ya |
| `/dashboard-v2/pesanan` | riwayat dan penelusuran | **tidak** |
| `/dashboard-v2` (Beranda) | ringkasan angka + tautan | **tidak** |

Alasannya sudah tertulis di `src/app/dashboard-v2/pesanan/page.tsx`: kalau layar owner juga bisa memajukan pesanan, ada dua tempat untuk mengerjakan hal yang sama, dan pertanyaan "apakah ada yang kelewat?" muncul setiap shift. Ini juga konsekuensi langsung dari risiko di 10.3.

Komponen utama `dashboard-v2/pesanan`:

- tab riwayat: Semua, Selesai, Dibatalkan;
- filter status, metode payment, order type, tanggal, dan pencarian;
- toggle list dan grid. **Kanban tidak dibangun di sini** — papan status adalah alat kerja dan tempatnya di `/kasir`;
- order row/card berisi token, customer, item, notes, total, payment state, dan waktu;
- detail order dalam slide-over, bukan modal untuk setiap interaksi;
- action read-only: lihat detail, cetak ulang struk, salin token, buka pesanan di `/kasir` bila masih berjalan;
- status payment harus terpisah dari status kitchen/order.

Semua mutasi status (`terima`, `mulai siapkan`, `selesai`, `cancel`, `cash check-in`) tetap milik `KasirQueue`, `KasirOrderSheet`, `CheckInDialog`, dan `CancelOrderDialog`. Rebuild boleh mengubah tampilannya, tidak boleh menyalin logic-nya ke konsol owner.

Bila di kemudian hari owner benar-benar butuh memproses pesanan tanpa membuka `/kasir`, jawabannya adalah **memindahkan `/kasir` ke dalam shell v2 sebagai satu rute**, bukan membuat implementasi kedua.

### 5.3 Menu 3D

Menu harus memiliki mode list dan grid.

Setiap row/card minimal menampilkan:

- foto menu;
- nama, kategori, dan harga;
- status live/offline;
- stok atau availability;
- status model 3D/AR;
- discount dan schedule;
- jumlah option group;
- quick action untuk preview, edit, duplicate, dan toggle availability.

Editor tetap mempertahankan tab yang ada:

- Dasar;
- Jadwal dan diskon;
- Varian;
- 3D dan AR;
- Resep.

Perlu diketahui sebelum menjadwalkan: di `src/components/dashboard-v2/MenuEditor.tsx` tab **Varian, 3D & AR, dan Resep masih `PendingTab`** — hanya membaca keadaan ("item ini punya N grup varian"), belum bisa menyunting. Penyuntingnya masih hidup di legacy sebagai `MenuOptionsEditor`, `Tripo3DGenerator`, `FileUpload`, dan `RecipeEditor`. `MenuExtractor`, `AiCreditMeter`, dan AI detail generation juga tetap harus dipindahkan sebagai workflow fungsional, bukan dihilangkan dari template baru. Memindahkannya adalah pekerjaan write-path terbesar di seluruh rebuild ini, bukan pekerjaan tata letak. Rinciannya di Lampiran A.

Integrasi AI/3D minimal harus mencakup:

- ekstraksi menu berbasis AI;
- pembuatan detail menu berbasis AI;
- meter dan validasi credit;
- generate model 3D;
- upload dan save GLB/USDZ;
- preview model dan AR;
- status model pada list/grid menu;
- fallback/error state ketika generation atau upload gagal.

### 5.4 Stok

Beranda stok harus memprioritaskan tindakan:

- bahan di bawah minimum;
- bahan habis;
- menu yang terdampak;
- penggunaan bahan hari ini;
- riwayat stock movement;
- recipe yang mengurangi stock;
- quick adjustment dengan alasan yang wajib diisi.

### 5.5 Promo

Promo perlu membedakan tiga hal:

- discount terjadwal pada menu;
- promo/campaign yang ditampilkan ke customer;
- coupon code dengan aturan penggunaan.

Dua yang pertama sudah punya data dan hidup di `src/lib/dashboard-v2-promo.ts`. Yang ketiga tidak.

**Coupon code keluar dari scope rebuild ini.** Ia bukan pekerjaan UI: butuh tabel sendiri, migration, RLS, aturan pemakaian (kuota, kedaluwarsa, minimum belanja, satu-per-tamu), validasi di sisi checkout, dan test kontraknya sendiri. Menaruhnya di Phase 3 bersama "rebuild tampilan Promo" akan menghasilkan tabel kosong yang tidak bisa dipakai. Coupon dijadwalkan sebagai fase domain terpisah setelah Phase 4, dengan plan-nya sendiri.

Sampai fase itu ada, rute Promo tidak menampilkan tab Coupon sama sekali — bukan tab kosong, bukan tombol disabled.

### 5.6 Laporan

Laporan menggunakan tab yang sudah relevan dengan domain 3Diner:

- Penjualan;
- Tamu/order;
- Menu;
- Pajak;
- Payment.

Setiap report harus memiliki filter tanggal, export, empty state, loading state, dan definisi metrik yang jelas. Angka laporan harus berasal dari source of truth yang sama dengan order dan payment.

### 5.7 Pengaturan

Pengaturan dibagi berdasarkan pekerjaan, bukan daftar panjang:

- Cafe dan brand;
- Pajak dan service charge;
- Payment;
- QR menu;
- Printer dan receipt;
- Delivery;
- Notification;
- Integration;
- Staff dan permission.

Section yang belum tersedia di backend tidak boleh ditampilkan sebagai tombol aktif palsu. Gunakan status `Belum dikonfigurasi` atau disabled dengan penjelasan.

## 6. Mapping inspirasi Dream POS ke 3Diner

| Pola Dream POS | Implementasi 3Diner |
|---|---|
| KPI dashboard | KPI operasional + task yang dapat ditindaklanjuti |
| POS split screen | Order detail drawer + live queue yang menjaga contract Kasir |
| Order cards | Card dengan token, payment state, notes, dan lifecycle 3Diner |
| Kanban orders | Hanya di `/kasir` bila memang dibutuhkan. Tidak dibangun di konsol owner (lihat 5.2) |
| Kitchen page | Modul KDS terpisah setelah queue Kasir stabil |
| Menu grid | Menu 3D grid dengan photo, model status, stock, dan preview |
| AI dan 3D workflow | Menu extraction, AI detail, credit meter, Tripo generation, upload, preview, dan AR menggunakan contract 3Diner |
| Table management | Ditambahkan hanya jika bisnis membutuhkan dine-in/table workflow |
| Reservation | Domain baru dengan schema dan lifecycle sendiri |
| Reports | Tab report dengan source data 3Diner, bukan dummy table |
| Staff matrix | Perluasan dari owner/cashier secara bertahap |
| Invoice/payment table | Payment ledger dan invoice entity yang terhubung ke order |

## 7. Kontrak teknis yang wajib dipertahankan

Fase UI rebuild tidak boleh mengubah perilaku berikut tanpa audit terpisah:

- Supabase authentication dan tenant isolation;
- RLS dan authorization owner/cashier;
- `quoteId` dan server-side pricing;
- `Idempotency-Key` pada checkout;
- atomic order commit;
- QRIS transaction identity dan persisted QR URL;
- webhook payment dan settlement state;
- stock deduction saat order dikonfirmasi;
- realtime order subscription;
- Menu option, recipe, GLB/USDZ, dan AR data contract;
- receipt/print data;
- resolusi konteks staf lewat RPC `get_staff_context` (`src/lib/staff-context.ts`), termasuk pembedaan `role: null` antara "bukan staf di sini" dan "gagal memuat";
- **pemanggilan `supabaseAdmin` wajib tetap server-only.** Rute v2 memakainya langsung di server component (contoh: `dashboard-v2/pesanan/page.tsx`). Klien service role melewati RLS, jadi memindahkan pemanggilan itu ke komponen klien atau ke route handler tanpa pemeriksaan peran adalah kebocoran tenant, bukan refactor tampilan.

Komponen seperti `OwnerShell`, `KasirQueue`, `KasirOrderSheet`, `MenuEditor`, dan report data layer boleh direfactor tampilannya, tetapi tidak boleh kehilangan contract behavior tanpa test baru.

## 8. Roadmap implementasi

Setiap phase punya gate keluar yang bisa diperiksa dan cara mundur. Phase tidak dinyatakan selesai karena tampilannya sudah jadi.

### Phase 0 — Foundation

Bukan mendefinisikan sistem baru — **memperluas yang sudah ada.** `globals.css` sudah memuat 177 CSS variable dan 136 kelas `dv2-*`, dan `src/components/ui` sudah memuat 8 primitive shadcn.

- inventarisasi token `--dash-*` dan `--dv2-*` yang sudah dipakai, lalu dokumentasikan sebagai satu tabel token resmi;
- lengkapi celah yang memang belum ada (skala spacing, z-index, typography scale) **memakai penamaan yang sudah berjalan**, tanpa membuat lapisan token kedua;
- perluas `DESIGN.md` supaya mencakup konsol owner, bukan hanya checkout;
- rapikan shell responsive di `OwnerShell`, termasuk mobile drawer dan focus ring;
- tetapkan navigation state, active route, dan pola command/search;
- naikkan primitive bersama untuk button, tabs, table, status, empty, loading, dan error dari kelas yang sudah ada.

**Gate keluar:** tidak ada kelas warna hardcoded baru di file yang disentuh, dan tidak ada nama token duplikat. Bentrok nama pernah terjadi dan sudah dicatat di komentar `globals.css` sekitar `.dv2-chart-bar` — perlakukan itu sebagai preseden, bukan anomali.

### Phase 1 — Beranda dan Pesanan

- rebuild Beranda;
- gabungkan snapshot KPI dan operational tasks;
- rebuild order row/card dan detail slide-over pada rute riwayat;
- samakan bahasa visual antara `/kasir` dan konsol owner **tanpa menyatukan state-nya**;
- browser test payment state, cetak ulang, empty state, dan error state.

**Gate keluar:** `/kasir` tetap satu-satunya tempat status pesanan berubah, dibuktikan dengan pencarian kode — tidak ada server action mutasi status yang dipanggil dari `dashboard-v2`.

### Phase 2 — Menu dan Stok

- rebuild Menu grid/list;
- recreate layout dan interaction template dengan palette serta asset 3Diner;
- tampilkan kesiapan 3D/AR;
- **pindahkan penyunting Varian, 3D & AR, dan Resep dari legacy ke `MenuEditor` v2**, menggantikan `PendingTab`;
- pindahkan MenuExtractor, AiCreditMeter, AI detail generation, Tripo3DGenerator, FileUpload, dan save model sebagai workflow yang benar-benar dapat digunakan;
- rebuild stock overview, low-stock state, recipes, dan movements.

**Gate keluar:** baris Menu di Lampiran A seluruhnya berstatus `selesai`. Selama masih ada satu `PendingTab` di jalur sunting, Phase 2 belum selesai walau tampilannya sudah rapi.

### Phase 3 — Promo, Laporan, Pengaturan

- rebuild tampilan Promo untuk diskon terjadwal dan campaign yang tampil ke tamu (coupon tidak termasuk, lihat 5.5);
- rebuild report tabs dan export state, termasuk `ExportReport` dan `DateRangePicker`;
- reorganisasi Settings menjadi task-based sections, termasuk memindahkan `QrSmartMenu`;
- tandai fitur yang belum memiliki backend dengan status `Belum dikonfigurasi`;
- tambahkan print, delivery, notification, atau integration hanya setelah domain contract tersedia.

**Gate keluar:** baris Promo, Laporan, dan Pengaturan di Lampiran A seluruhnya berstatus `selesai` atau `sengaja tidak dipindahkan` dengan alasan tertulis.

### Phase 3.5 — Cutover

Phase tersendiri karena bukan efek samping dari phase mana pun. Selama langkah ini tidak dikerjakan, dua dashboard hidup berdampingan selamanya — persis risiko 10.1.

Keadaan sekarang: `src/middleware.ts` memakai matcher `["/dashboard/:path*", "/kasir/:path*", "/login"]`. Pola itu **tidak** cocok dengan `/dashboard-v2`. Akibatnya dua hal, dan keduanya harus dibereskan di sini:

1. redirect setelah login masih mengarah ke `/dashboard` legacy;
2. penyegaran cookie sesi Supabase SSR tidak pernah berjalan pada rute v2, sehingga sesi hanya diperpanjang kalau pengguna kebetulan membuka rute legacy atau `/kasir`.

Auth-nya sendiri tidak bocor — `dashboard-v2/layout.tsx` sudah menolak non-owner — tetapi biayanya satu lookup basis data per permintaan dan sesi yang bisa basi lebih cepat dari seharusnya.

Langkah:

- tambahkan `/dashboard-v2/:path*` ke matcher middleware;
- perbarui `tests/middleware-auth-gate.test.ts` supaya rute v2 ikut diuji, termasuk kasus pengguna anonim;
- alihkan tujuan redirect setelah login ke `/dashboard-v2`;
- ubah `/dashboard` dan turunannya menjadi redirect ke padanan v2, satu per satu, hanya untuk rute yang barisnya sudah `selesai` di Lampiran A;
- hapus kode legacy hanya setelah redirect-nya hidup di produksi selama satu siklus rilis.

**Gate keluar:** owner yang login mendarat di v2, dan tidak ada rute legacy yang masih bisa dicapai lewat navigasi.

### Phase 4 — Modul POS restoran lanjutan

Dikerjakan sesuai kebutuhan bisnis:

- manual cashier POS;
- Kitchen Display;
- table/floor plan;
- reservation;
- customer CRM;
- staff permission matrix;
- audit logs;
- invoice dan payment ledger.

### Phase 5 — Coupon sebagai domain

Bukan bagian dari rebuild UI. Butuh plan tersendiri yang memuat schema, migration, RLS, aturan pemakaian, titik validasi di checkout, dan test kontrak. Dijadwalkan terpisah.

### Rollback

Sampai Phase 3.5 selesai, setiap phase bisa dibatalkan dengan mengembalikan navigasi ke rute legacy padanannya, karena legacy masih utuh. Setelah Phase 3.5, jalur mundurnya adalah mengembalikan matcher middleware dan tujuan redirect login — jadi penghapusan kode legacy sengaja ditaruh setelah satu siklus rilis, bukan di akhir Phase 3.5.

## 9. Acceptance criteria

Dashboard rebuild dianggap siap jika:

- UI target memiliki fidelity visual 1:1 terhadap struktur template yang disepakati, dengan palette, typography treatment, logo, foto, icon treatment, dan aset 3Diner;
- tidak ada source code atau asset proprietary Dream POS yang disalin;
- seluruh route utama menggunakan shell baru secara konsisten;
- tidak ada tombol aktif yang hanya menuju `#` atau tidak melakukan apa-apa;
- seluruh list memiliki loading, empty, error, dan pagination state;
- seluruh form memiliki validation dan feedback save yang jelas;
- live order tidak rusak saat dashboard dibuka di desktop dan mobile;
- owner tetap monitor-only untuk perubahan status order; tidak ada mutasi status order dari Beranda atau `dashboard-v2/pesanan`;
- status payment dan status order tidak tercampur;
- menu 3D, option, recipe, stock, AI extraction, AI detail, credit meter, upload model, generation model, dan AR tetap dapat digunakan dari alur normal;
- layout tervalidasi pada viewport sekitar 390px, 768px, dan 1440px;
- keyboard navigation dan focus state dapat digunakan;
- `npm run test:ci` tetap pass;
- typecheck dan production build tetap pass;
- lint error pada file yang disentuh tidak bertambah;
- browser playtest dilakukan untuk login, dashboard, order, menu, stock, report, settings, print, dan payment flow;
- **setiap fitur yang dipindahkan dari legacy membawa test-nya sendiri di lapisan lib**, mengikuti pola tujuh file `tests/dashboard-v2-*.test.ts` yang sudah ada. Fitur write-path tanpa test tidak dihitung selesai;
- seluruh baris Lampiran A berstatus `selesai` atau `sengaja tidak dipindahkan` dengan alasan tertulis;
- middleware menggate `/dashboard-v2` dan `tests/middleware-auth-gate.test.ts` menguji rute itu;
- tidak ada pemanggilan `supabaseAdmin` baru di luar server component atau server action yang sudah memeriksa peran;
- tidak ada tipe `any` baru pada file yang disentuh;
- seluruh kontrol yang terlihat pada recreation template memiliki action nyata atau state disabled dengan alasan yang jelas;
- keyboard navigation diuji langsung: tab order masuk akal, focus terlihat pada canvas gelap, dan slide-over bisa ditutup dengan Escape;
- ukuran bundle rute konsol tidak naik lebih dari 10% dibanding sebelum phase berjalan, atau kenaikannya dijelaskan.

## 10. Risiko yang harus dihindari

### Duplikasi v2 dan legacy

Jangan membangun dua dashboard paralel. `dashboard-v2` menjadi target; legacy menjadi fallback sementara dan akhirnya diarahkan melalui redirect atau compatibility layer.

### UI bagus tetapi workflow tidak nyata

Setiap card, chart, filter, dan action harus memiliki source data dan behavior yang jelas. Bila backend belum ada, tampilkan status belum tersedia, bukan fake interaction.

### Duplikasi live queue

Jangan membuat state order kedua di dashboard yang berbeda dari Kasir. Gunakan satu source of truth dan satu realtime subscription contract.

### Scope melebar tanpa prioritas

Manual POS, permission, dan audit log lebih penting untuk operasi restoran daripada menambahkan chart dekoratif.

### Meniru bug demo

Visual Dream POS boleh menjadi referensi, tetapi masalah search, pagination, static modal, dan filter dekoratif harus diperbaiki di 3Diner.

## 11. Definition of done

Dashboard baru selesai ketika owner dapat masuk dan menjalankan pekerjaan harian dari satu pengalaman yang konsisten:

1. melihat kondisi cafe;
2. memantau order, payment, dan aktivitas operasional; pemrosesan status tetap dilakukan di `/kasir`;
3. mengecek payment;
4. mengelola menu, varian, recipe, ketersediaan, AI workflow, dan asset 3D/AR;
5. memantau stok;
6. membaca laporan;
7. mengubah settings yang memang tersedia;
8. mengetahui error atau task yang belum selesai;
9. menggunakan dashboard di desktop dan tablet tanpa kehilangan action penting.

Target akhirnya bukan membuat salinan Dream POS. Targetnya adalah **dashboard 3Diner yang memiliki kedalaman operasional Dream POS, tetapi tetap menjadi produk smart-menu dan 3D ordering milik 3Diner**.

## 12. Lampiran A — Parity checklist

Daftar ini adalah gate keluar Phase 2, 3, dan 3.5. Selama masih ada baris `belum`, rute legacy padanannya tidak boleh dihapus dan tidak boleh dialihkan.

Kolom **Baris** adalah ukuran kasar pekerjaan yang dipindahkan, bukan target penulisan ulang baris per baris.

### Menu — porsi terbesar rebuild

| Fitur legacy | Baris | Keadaan di v2 | Status |
|---|---:|---|---|
| `MenuForm` | 527 | sebagian, tab Dasar dan Jadwal saja | belum |
| `MenuOptionsEditor` | 438 | `PendingTab` (hanya membaca jumlah grup) | belum |
| `Tripo3DGenerator` | 332 | `PendingTab` (hanya membaca ada/tidak model) | belum |
| `RecipeEditor` | 193 | `PendingTab` (hanya membaca jumlah bahan) | belum |
| `FileUpload` | 178 | tidak ada | belum |
| `MenuExtractor` (ekstraksi menu via AI) | 371 | tidak ada | belum |
| `AiCreditMeter` | 90 | tidak ada | belum |

Subtotal write-path menu: sekitar 2.100 baris. Ini alasan Phase 2 tidak bisa diringkas jadi satu bullet.

### Pengaturan

| Fitur legacy | Baris | Keadaan di v2 | Status |
|---|---:|---|---|
| `QrSmartMenu` | 486 | tidak ada | belum |
| `SettingsForm` | 194 | sebagian, pajak saja (`pengaturan/pajak`) | belum |

### Promo

| Fitur legacy | Baris | Keadaan di v2 | Status |
|---|---:|---|---|
| `SchedulerClient` | 449 | tidak ada | belum |
| `AnnouncementForm` | 299 | daftar read-only di rute Promo | belum |

### Laporan

| Fitur legacy | Baris | Keadaan di v2 | Status |
|---|---:|---|---|
| `ExportReport` | 258 | tidak ada | belum |
| `DateRangePicker` | 405 | tidak ada | belum |
| Chart: `LineChart`, `DonutChart`, `FunnelBars`, `HeatmapGrid`, `RevenueChart` | 510 | hanya `BarSeries` (44 baris) | belum |

### Stok

| Fitur legacy | Baris | Keadaan di v2 | Status |
|---|---:|---|---|
| `InventoryTable` | 304 | `StockTable` read-only | belum |
| `StockAdjustmentModal` | 119 | tidak ada | belum |
| `InventoryWorkspace` | 118 | tidak ada | belum |
| `InventoryItemForm` | 95 | tidak ada | belum |

### Aturan pengisian

- `selesai` hanya boleh ditulis setelah fiturnya bisa **menyunting**, bukan hanya menampilkan;
- `sengaja tidak dipindahkan` wajib disertai satu kalimat alasan di baris yang sama;
- setiap baris yang berpindah ke `selesai` harus membawa test lapisan lib-nya, sesuai kriteria di bagian 9.
