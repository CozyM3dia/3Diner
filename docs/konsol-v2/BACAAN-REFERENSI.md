# Bacaan referensi — sebelum menyapu permukaan v2

**Tanggal:** 2026-07-31
**Pemicu:** pemilik meminta seluruh referensi dibuka dan dipelajari **sebelum** membangun,
bukan sesudah. Sesi sebelumnya membangun tujuh rute dari kontrak berangka tanpa membuka
satu pun gambar; sesi ini membuka satu gambar lalu membangun. Dua-duanya kurang.

**Aturan yang berlaku** (`2026-07-27-referensi-visual.md` §0):
satu referensi maksimal menyumbang **satu** keputusan, dan tiap keputusan layout butuh
**≥2 referensi produk berbeda**. Referensi dipakai untuk **mekanisme**, tidak pernah untuk
komposisi.

---

## 0. Status pembacaan

| Sumber | Jumlah | Dibaca visual sebelum sesi ini | Dibaca sesi ini |
|---|---|---|---|
| `docs/wireframe/v3-lengkap.html` | 41 plate | **0** | 6 plate inti |
| `Asset/referensi/21st` | 5 | 1 (efferd) | |
| `Asset/referensi/needmcp` | 24 | 5 | |
| `Asset/referensi/tantri` | 31 | 0 | |
| `Asset/research/frames` | 190 | 0 | |

Lima needmcp yang sudah dibaca sesi lalu — `order-history-table`, `ordering-dashboard`,
`system-settings-form`, `sales-analytics-view`, `dashboard-sidebar-overview` — tidak
dibaca ulang; temuannya dipakai apa adanya dari `2026-07-27-referensi-visual.md`.

---

## 1. Wireframe v3 — dokumen paling mengikat, dan yang paling telat dibuka

Pemilik sudah menyetujui ini. Ia **abu murni, nol warna**, dan mengatakan alasannya
sendiri di kepala dokumen:

> "Kalau layar tidak terbaca dalam abu, menambah warna hanya menyembunyikan masalahnya.
> Token brand masuk setelah struktur ini disetujui."

Artinya wireframe ini **adalah** lapisan yang sedang dikerjakan sekarang, bukan pesaingnya.

### 1.1 Mekanisme yang berulang di SEMUA plate

Ini yang paling berharga — bukan satu plate, tapi pola yang muncul di enam plate berbeda.
Dengan aturan ≥2 referensi, pola yang muncul 6 kali sudah lebih dari cukup.

| # | Mekanisme | Terlihat di |
|---|---|---|
| M1 | **Keadaan dibawa CHIP berbingkai, bukan teks polos** — `Disiapkan` · `Gagal · perlu file` · `2 menu mati` · `Wajib sebelum jualan serius` · `Belum bayar` | Pesanan · Menu · Stok · Pengaturan · Kasir lapis 2 |
| M2 | **Tiap panel punya bilah kepalanya sendiri**: `Nama · cakupan · timestamp` di kiri, **satu** tombol aksi di kanan — `Stok · 31 bahan · terakhir dihitung 26 Jul` + `Catat pembelian` | Pesanan · Menu · Stok · Pengaturan |
| M3 | **Tepat satu tombol ditekankan per layar.** Sisanya bergaris tipis atau polos | semua plate |
| M4 | **Aksi merusak ditaruh di ujung berlawanan** dari aksi utama — jarak fisik sebagai pengaman | Kasir lapis 2 |
| M5 | **Footer meringkas DAMPAK, bukan menjumlahkan kolom** — `5 bahan menipis · 14 menu unik terdampak`, bukan total kg | Stok |
| M6 | **Baris aksi maks 2 terlihat + satu `…`** | Menu · Stok · Beranda |

### 1.2 Tiga tempat keputusan saya MENYIMPANG dari wireframe yang disetujui

Ditemukan dengan membuka plate-nya, bukan dengan mengukur DOM. Semuanya sudah terkirim
di PR #32.

| Keputusan saya | Wireframe yang disetujui | Sumber keputusan saya |
|---|---|---|
| Label **di atas** angka besar | Angka dulu, lalu satu baris meta `Omzet · Rp · +11%` berisi label **dan** pembanding | Efferd — **satu** referensi, padahal ini keputusan layout yang butuh ≥2 |
| Tombol baris **tanpa bingkai** (varian tenang) | `Buka` berbingkai di tiap baris | penalaran sendiri, **nol** referensi |
| Status sebagai **teks polos ink-3** | Status sebagai **chip berbingkai** | penalaran sendiri, nol referensi |

Yang ketiga paling merugikan. Kontrak §1.3 mewajibkan tiap warna didampingi kata; chip
melakukan lebih dari itu — ia memberi keadaan sebuah **batas**, sehingga terbaca sebagai
nilai dari satu himpunan tertutup, bukan sebagai keterangan yang kebetulan pendek. Teks
abu polos justru membuat status terbaca seperti catatan kaki.

Konsekuensi untuk varian tenang: alasan aslinya tetap sah (25 bingkai identik di tepi
kanan memang objek terberat di layar), tapi wireframe menjawab masalah yang sama dengan
cara berbeda — kolom aksi dibuat **sempit dan seragam** sehingga bingkainya berhenti jadi
deretan, bukan dengan menghapus bingkainya.

### 1.3 Selisih implementasi ↔ wireframe yang BUKAN buatan saya

Dicatat supaya tidak tertukar dengan pekerjaan permukaan:

- **Kolom Pembayaran di rute Pesanan tidak ada di wireframe.** Di sana metode bayar adalah
  **filter** (`Filter: hari ini · semua metode`), bukan kolom. Implementasi menambahnya
  sendiri — dan kolom itulah yang tadi saya lebarkan 152 → 192px, memakan kolom Item.
  Kalau kolom ini dikembalikan jadi filter, seluruh masalah lebar tabel hilang.
- **Kolom Model 3D dan Tayang di rute Menu** memajang nilai yang hampir selalu sama
  (`Siap tayang` / `Tayang`), sementara wireframe menunjukkan keduanya bervariasi karena
  kegagalan model 3D memang terekam di sana. `PROJECT.md` §6 sudah mencatat bahwa
  kegagalan itu tidak pernah disimpan di database — jadi kolomnya memang tidak bisa
  seinformatif wireframe sampai ada migrasi.
- **Rute Menu memakai kotak centang**, wireframe memakai **gagang seret** (`≡`) karena
  urutan menu adalah data yang bisa diubah dengan menyeret.

---

## 2. Bacaan gambar referensi

### 2.1 `21st/workbench-sidebar`

**Nol.** Kanvas hitam dengan menu mengambang tiga item. Tidak ada mekanisme yang bisa
diambil. Dicatat supaya tidak dibuka lagi.

### 2.2 `21st/live-sales-dashboard` — dipakai sebagai jebakan

**Diambil:** panel `Latest Payments` punya judul **dan** satu baris cakupan
("Recently completed transactions, updated live."). Ini sumber **kedua** untuk M2 setelah
Efferd.

**Ditolak, empat sekaligus:**

- Empat kartu KPI berbingkai, nilainya ber-hue berbeda — hijau, putih, biru. Hue dipakai
  sebagai dekorasi kartu, bukan sebagai arti. Persis gejala "warna-warni tapi datar".
- `Total Transactions 38.00` — **hitungan dengan dua desimal**. Presisi tidak dikunci per
  kolom, dan angka yang tidak mungkin ("nol koma nol nol pesanan") merusak kepercayaan
  pada seluruh baris.
- `Activity Status: Live` diberi bentuk kartu KPI. Itu status yang menyamar jadi metrik —
  gagal uji tindakan §0.3: kalau nilainya jelek, tidak ada yang bisa dikerjakan pemilik.
- Dua chart, dua seri berwarna berbeda plus legenda. Hue lagi-lagi jadi identitas seri.

### 2.3 `needmcp/orders-data-table` — paling dekat dengan rute Pesanan kita

**Diambil:**

- **Status sebagai pil berlatar lembut** — `Shipping` · `Processing` · `Completed`.
  Sumber **kedua** untuk M1 setelah wireframe v3.
- **Nilai + rasio dalam satu sel**: `$415.70` diikuti `44%` berukuran meta di
  sebelahnya. Satu sel membawa angka dan proporsinya tanpa menambah kolom. Langsung
  berlaku untuk Stok (`sisa` terhadap `minimum`) dan Menu (`harga` terhadap `diskon`).

**Ditolak:**

- **Enam kartu KPI** di atas tabel — Income · Completed · Processing · Pending ·
  Shipping · Cancelled — dan tidak satu pun mengikuti saringan tabel. Ini versi
  mini dari sepuluh kartu yang membunuh dashboard lama.
- `Pending` lagi. Tiga referensi berbeda sekarang memakainya; kosakata pemegang bola
  memang bukan bawaan industri, ia harus dipilih.
- **Tinggi baris tidak seragam** — sel tanggal dua baris (tanggal + jam), jadi baris
  lebih tinggi dari satu baris teks dan tombol bergeser antar baris.
- Paginasi bernomor 1–5 (offset). §2 melarangnya: daftar yang menerima baris baru saat
  dibaca membuat baris terlewat.

### 2.4 `needmcp/table-reservation-grid` — mekanisme terbaik yang ditemukan sesi ini

**Diambil, dan ini baru:** **label aksi mengikuti keadaan barisnya.**
`Available` → `Assign` · `Occupied` → `View Order` · `Reserved` → `Check In`.
Tombolnya satu, tapi kalimatnya menyebut langkah berikutnya untuk keadaan itu. Bandingkan
dengan rute Pesanan kita: dua puluh lima baris, semuanya bertuliskan `Buka`.

**Diambil:** legenda status di kepala layar — titik berwarna **plus kata**
(`Available` · `Occupied` · `Reserved`), lalu tiap kartu mengulang keadaannya sebagai chip
**dan** sebagai warna bingkai. Informasi dibawa dua kali; hilang satu, masih terbaca.
Sumber **ketiga** untuk M1.

**Diambil:** kepala layar `Table Reservation & Floor Map` + baris cakupan
`Manage table statuses` + **satu** aksi utama. Sumber ketiga untuk M2, kedua untuk M3.

### 2.5 `needmcp/task-management-list`

**Diambil:** prioritas dibawa titik berwarna **dan** kata (`High Priority`), tidak pernah
warna saja. Sumber keempat untuk aturan "warna selalu didampingi kata".

**Diambil:** bilah kemajuan tipis + pecahan `1 of 3` di kepala daftar — kemajuan dinyatakan
dua kali, sebagai bentuk dan sebagai angka.

**Tidak berlaku di sini:** barisnya kartu tiga baris, bukan baris 44px. Itu layar dengan
belasan objek, bukan puluhan. Kelas masalah berbeda.

### 2.6 `needmcp/usage-dashboard` — menjawab baris Kredit AI di Pengaturan

**Diambil, mekanisme utuh:** kuota ditampilkan **tiga cara sekaligus**:

```
CREDITS USED
78.9%                      ← proporsi, angka utama
▮▮▮▮▮▮▮▮▮▮▮▮▯▯▯▯           ← bentuk, bilah bertakik (bukan isian mulus)
78.9M / 100M CREDITS       22.4M CREDITS LEFT
       ↑ terpakai absolut          ↑ sisa absolut
```

"78,9% terpakai" dan "22,4M tersisa" menjawab **pertanyaan berbeda** — yang pertama
"seberapa cepat saya menghabiskannya", yang kedua "apakah cukup sampai akhir bulan".
Memilih salah satu berarti membuang separuh jawabannya.

Implementasi kita menulis `128 tersisa` saja, tanpa pembagi dan tanpa proporsi — jadi
angka itu tidak bisa ditindaklanjuti. Ini melanggar §"angka tanpa pembanding".

**Diambil:** bilah digambar sebagai **takik diskret**, bukan isian mulus. Isian mulus
mengundang pembacaan presisi palsu; takik menyatakan "ini perkiraan berskala".

**Diambil:** kaki panel = overflow `⋮` · unduh · catatan konteks · lalu **satu** tombol
solid `Manage plan`. Sumber ketiga untuk M3.

### 2.7 `tantri/manajemen-pesanan` — POS Indonesia, tablet, pesanan aktif

**Diambil:** tab berhitungan — `Pesanan Baru 5` · `Sedang Diproses 5` ·
`Menunggu Dibayar 4` · `Pesanan Dibatalkan 1`. Bentuk yang sama dengan kita; ini
mengonfirmasi, bukan mengubah.

**Diambil, baru:** **pecahan penyelesaian per pesanan** — `(2 / 1 Selesai)`. Satu pesanan
berisi banyak item, dan "berapa dari isinya yang sudah beres" adalah pertanyaan nyata di
konter. Konsol Kasir kita tidak punya ini.

**Ditolak:**

- Kartu paling atas **seluruh latarnya merah penuh**. Latar sekuat itu untuk satu baris
  membuat sisa layar terbaca sebagai latar belakang, dan kalau dua pesanan sama-sama
  mendesak, tidak ada tingkat kedua yang tersisa.
- `Rp290.600` dicetak merah di **semua** kartu, termasuk yang tidak mendesak. Merah dipakai
  sebagai warna brand **dan** sebagai penanda kegentingan sekaligus — begitu keduanya
  bertemu, tidak ada yang bisa dibedakan. Ini persis alasan §1.3 mengunci merah untuk satu
  arti saja.

### 2.8 `tantri/daftar-stok` — pembanding langsung rute Stok kita

**Diambil:** **pemilih outlet duduk di kepala shell** (`Outlet · Semua Outlet`), di atas
nav. K6 memang menyuruh menyediakan tempatnya sejak awal supaya menambah cabang nanti
bukan refactor — referensi ini menunjukkan bentuk yang dimaksud.

**Ditolak, dan ini yang paling berharga:**

- **Ambang batas disembunyikan di dalam tooltip.** Ikon peringatan kecil di sebelah nama
  bahan, dan baru saat disentuh muncul "Stok susu dibawah batas minimum 2". Angka yang
  menentukan apakah baris ini harus dikerjakan hanya bisa dilihat satu baris pada satu
  waktu — jadi layar ini tidak bisa dipindai sama sekali. Wireframe kita menaruh
  akibatnya di kolom sendiri (`2 menu mati`), dan referensi ini adalah bukti lapangan
  kenapa itu penting.
- **Kosakata SKU** (`TR-0000001`) sebagai kolom pertama. K5 menolaknya: kafe bicara bahan,
  bukan SKU, dan kolom identitas yang tidak dikenali pembacanya sama saja dengan kolom
  kosong.
- Paginasi offset `1 2 3 … 8 9 10`.

### 2.9 `tantri/laporan-penjualan` — referensi paling berharga sesi ini

Bentuknya **buku besar berbentuk struk**, bukan kartu angka: label di kiri, nilai di
kanan, potongan berturut-turut, satu baris hasil di bawah.

```
Produk Terjual                        10
Total Pesanan                 10 Pesanan
Total Penjualan               Rp 110.000
Diskon                        −Rp 10.000
Service Fee                    −Rp 5.000
Pajak                         −Rp 11.000
E-Payment (Xendit) Fee        −Rp 25.000   ← Lihat Selengkapnya
Tantri Platform Fee           −Rp 15.000   ← Lihat Selengkapnya
─────────────────────────────────────────
Estimasi Pendapatan ⓘ          Rp 44.000
```

**Diambil — dan ini mengubah rute Laporan kita:**

Pemilik kafe tidak bertanya "berapa omzet". Ia bertanya **"berapa yang benar-benar jadi
milik saya"**. Rp 110.000 dan Rp 44.000 adalah dua angka yang sangat berbeda, dan jarak di
antaranya seluruhnya terdiri dari potongan yang **punya nama**. Laporan kita sekarang
menampilkan `Diterima · Pesanan selesai · Rata-rata` — tiga angka tanpa satu pun
pengurangan, jadi ia menjawab pertanyaan yang tidak ditanyakan.

**Diambil:** tiap potongan bisa dibuka isinya di tempat (`Lihat Selengkapnya` →
`E-Wallet ×5`, `QRIS ×5`, `VA ×5`, `Kartu Kredit ×5`). Pengungkapan bertahap **di dalam**
baris buku besar, bukan di halaman lain.

**Diambil:** angka akhir diberi nama `Estimasi Pendapatan`, bukan `Pendapatan`. Produk
yang jujur tentang mana angkanya yang perkiraan lebih dipercaya daripada yang membulatkan
semuanya jadi kepastian.

**Ditolak:** semua nilai dicetak merah, termasuk yang netral. Merah jadi warna tabel, bukan
warna arti.

### 2.10 `tantri/dashboard-backoffice`

**Diambil, mekanisme kuat:** **tiap kartu angka membawa uraiannya sendiri.**
`Jumlah Produk Terjual 44` diikuti, di dalam kartu yang sama, `Selesai 44 · Dibatalkan 2`
lalu tiga menu teratas `Ayam Gegrek 24 · Teh Manis 12 · Milkshake Chocolate 8`.

Ini jawaban lain untuk "angka tanpa pembanding": pembandingnya bukan periode lalu, tapi
**komposisinya**. Pembaca tidak pernah perlu pindah layar untuk bertanya "terdiri dari
apa". Untuk Beranda kita — yang cuma punya tiga angka dan satu delta — ini pilihan kedua
yang layak diuji.

**Diambil:** `Data terakhir diambil: 02 Juni 2023 10:52:11`, tertulis jelas di dekat
angkanya. Kontrak §4 mewajibkan "waktu sinkron terakhir berhasil" untuk keadaan gagal;
referensi ini menunjukkan bahwa menampilkannya **selalu**, bukan hanya saat gagal, lebih
berguna — karena pertanyaan "ini angka jam berapa" muncul juga saat semuanya normal.

**Diambil:** pemilih outlet `Main Office` di kepala shell. Sumber **kedua** setelah
`daftar-stok` — cukup untuk mengunci bentuk scope outlet yang K6 minta disediakan sejak
awal.

### 2.11 `research/frames/admin` — Admin Console 4D Smart Menu, kompetitor langsung

190 frame terbagi dua: `admin/` **107 frame** (konsol owner mereka) dan `menu/` 83 frame
(menu tamu). Yang `admin/` adalah referensi paling dekat yang kita punya — produk yang
menjawab pertanyaan yang sama, untuk pengguna yang sama.

**`f_012` — "Active Kitchen".** Grid kartu **per meja**: tiap meja satu kolom berisi
itemnya, tiap item punya tombol aksinya sendiri. Belasan kolom sekaligus.

Ini pilihan berlawanan dengan K3 (satu kolom bergulir). Nilainya bukan untuk ditiru, tapi
untuk melihat harganya: layout ini **menuntut layar lebar dan tetap**, dan begitu meja
bertambah ia melebar ke samping tanpa batas. Di tablet konter 1024 yang jadi asumsi kita,
bentuk itu pecah. K3 dipilih tanpa melihat ini; sekarang ada buktinya.

**`f_045` — "Analytics". Mekanisme yang layak diambil:**

Bagian `Menu & Dishes` tidak menampilkan tiga angka, melainkan **tiga pemenang bernama**:

```
MOST VIEWED          MOST ORDERED         HIGHEST REVENUE
BBQ Bacon            Cappuccino           Strawberry Cheese Cake
Cheeseburger
```

Bandingkan dengan Beranda kita: `Menu dibuka tamu · 0`. Angka itu tidak menyebut **apa**
yang dibuka, jadi tidak ada yang bisa dikerjakan dengannya. "Menu paling sering dibuka:
Es Kopi Susu" langsung memberi tahu pemilik apa yang layak difoto ulang, dinaikkan
harganya, atau dijadikan promo. Uji tindakan §0.3 lolos untuk yang kedua, gagal untuk
yang pertama.

**Ditolak:** dua bar chart bersebelahan dengan **dua hue berbeda** (kuning untuk volume,
teal untuk pendapatan) — hue dipakai untuk membedakan dua panel yang sudah dibedakan oleh
judulnya. Lalu donat `Interaction Types` dengan lima hue plus legenda, dan empat KPI
sejajar lagi.

### 2.12 `frames/admin` — sisa layar konsol kompetitor

**Catatan metode:** 107 frame itu keyframe dari 7 video walkthrough, dan sebagian besar
adalah layar **yang sama** dengan narasi berjalan di atasnya (`f_002`, `f_012`, `f_028`,
`f_103` semuanya Active Kitchen). Disisir bertahap sampai tiap layar berbeda tertangkap.
Layar unik yang ditemukan: Active Kitchen · Analytics · Menu Control · Staff Manager ·
Table View.

**Nav mereka:** `OPERATIONS` (Live Feed · Active Kitchen · Guest Feedback) dan
`MANAGEMENT` (Analytics · Table View · Menu Control · Staff Manager) — **tujuh tujuan
dalam dua grup**. Skalanya sama dengan tujuh rute datar kita; ini menenangkan, karena
artinya tujuh bukan angka yang kita karang sendiri.

**`f_065` Menu Control — diambil:** baris saringan di atas daftar hidup
(`Search item · All Categories · All Types · All Tags · All Stock Status`) yang diakhiri
jalan keluar eksplisit **`Reset Menu Defaults`**. Kontrak §4 state 4 mewajibkan
`[Hapus filter]` pada state kosong-hasil-saringan; referensi ini menaruhnya **permanen**
di sebelah saringannya, jadi jalan keluarnya ada sebelum orang tersesat, bukan sesudah.

**`f_090` Staff Manager — diambil:** kaki modal `Cancel` polos di kiri, **satu** tombol
solid di kanan. Sumber keempat untuk M3, kedua untuk M4.

**`f_050` Table View — ditolak, dan biayanya sekarang terlihat.** Denah lantai dengan puck
meja bernomor di atas peta restoran yang digambar khusus. Dua masalah:

1. Peta itu **aset per venue**. Menjual langganan ke banyak kafe berarti menggambar denah
   baru untuk tiap pelanggan — biaya onboarding manual yang tidak pernah hilang. K2 sudah
   menolak "Meja & Tagihan" atas dasar bukti Tantri; ini menambahkan alasan ekonominya.
2. Keadaan puck dibawa **warna saja** (hijau · abu · cincin oranye). Angka di dalam puck
   adalah nomor meja, bukan keadaannya. Dicetak hitam-putih, layar ini kosong artinya.

### 2.13 `tantri/summary-report-per-shift`

**Diambil:** **akordeon per penanggung jawab**, tiap bagian membuka **bentuk buku besar
yang sama** — `Sova · Shift Long Shift (08:00–22:00)` · `Brims · Shift Split to Close` ·
`Reyna · Shift Morning`. Satu bentuk dipakai ulang untuk N konteks; pembaca belajar
membacanya sekali.

**Diambil:** **batasan ditulis di sebelah kontrolnya** — `(Maksimal Range: 31 Hari)` tepat
di bawah pemilih tanggal. Batas yang ditemukan lewat pesan error adalah batas yang
diketahui terlambat.

**Diambil:** potongan ditulis dalam kurung — `(Rp 10.000)` — konvensi akuntansi, bersamaan
dengan warna merah. Dua penyandian untuk satu arti; hilang satu, masih terbaca. Ini
persis yang §1.3 minta.

**Diambil:** cakupan ditulis sebagai dua baris di bawah judul — `Laporan Tanggal: Selasa,
26 Maret 2024` dan `Nama Kasir: Reyna, Brims, Sova`. Sumber keenam untuk M2.

### 2.14 `tantri/daftar-pemasok`

Sedikit yang baru, tapi tiga konfirmasi: alamat **dipotong dengan elipsis**, bukan
dibungkus; **satu** aksi per baris (ikon pensil); **satu** aksi utama di kanan atas
(`+ Tambah Pemasok`). Pemilih outlet di kepala sidebar — sumber ketiga.

Paginasi offset lagi (`1 2 3 … 8 9 10`). Empat referensi berbeda sekarang memakainya, dan
tidak satu pun daftar mereka menerima baris baru saat dibaca. Riwayat pesanan kita
menerima — itu bedanya, dan itu sebabnya kita pakai kursor.

---

## 3. Rekapitulasi — tiap keputusan dan jumlah sumbernya

Aturan: keputusan layout butuh **≥2 referensi produk berbeda**.

| Keputusan | Sumber | Cukup? |
|---|---|---|
| Keadaan sebagai **chip berbingkai** | wireframe v3 · orders-data-table · table-reservation-grid | **3** ✓ |
| Panel punya judul **+ baris cakupan** | efferd · live-sales-dashboard · table-reservation-grid · task-management-list · wireframe v3 | **5** ✓ |
| **Satu** aksi ditekankan per layar | wireframe v3 · table-reservation-grid · usage-dashboard | **3** ✓ |
| Warna **selalu** didampingi kata | table-reservation-grid · task-management-list · wireframe v3 | **3** ✓ |
| Chart monokrom, satu batang disorot | efferd · sales-analytics-view · dashboard-sidebar-overview | **3** ✓ (dari sesi lalu) |
| Pemilih outlet di kepala shell | daftar-stok · dashboard-backoffice · daftar-pemasok | **3** ✓ |
| Kaki modal: batal polos kiri, satu solid kanan | wireframe v3 · f_090 staff-manager | **2** ✓ |
| Teks panjang dipotong, tidak dibungkus | daftar-pemasok · orders-data-table · wireframe v3 | **3** ✓ |
| Batasan ditulis di sebelah kontrolnya | summary-report-per-shift | **1** — usulan |
| Jalan keluar saringan permanen, bukan cuma di state kosong | f_065 menu-control | **1** — usulan |
| Satu bentuk laporan dipakai ulang lewat akordeon | summary-report-per-shift | **1** — usulan |
| Kuota = proporsi + terpakai + sisa | usage-dashboard | **1** — belum cukup, tandai sebagai usulan |
| Label aksi mengikuti keadaan | table-reservation-grid | **1** — belum cukup |
| Nilai + rasio dalam satu sel | orders-data-table | **1** — belum cukup |
| Laporan sebagai buku besar berpotongan | laporan-penjualan | **1** — usulan produk, bukan permukaan; harus ditanyakan |
| Kartu angka membawa uraiannya sendiri | dashboard-backoffice | **1** — belum cukup |
| Waktu sinkron terakhir ditampilkan selalu | dashboard-backoffice | **1** — tapi kontrak §4 sudah mewajibkannya untuk keadaan gagal |
| **Label di atas angka besar** | efferd · live-sales-dashboard · usage-dashboard | **3** — tapi **dibantah wireframe yang disetujui**, lihat §1.2 |
| Tombol baris tanpa bingkai | — | **0**, dan berlawanan dengan wireframe |

Baris terakhir dua-duanya keputusan saya di PR #32. Yang satu punya tiga sumber tapi
kalah oleh wireframe yang sudah disetujui pemilik; yang satu tidak punya sumber sama
sekali.

**Urutan wewenang yang dipakai seterusnya:** wireframe yang disetujui > kontrak berangka >
referensi produk > penalaran sendiri. Referensi tidak pernah cukup untuk membatalkan
sesuatu yang sudah disetujui — ia hanya cukup untuk mengusulkannya.

---

## 4. Yang dikerjakan berikutnya

### 4.1 Membatalkan dua penyimpangan saya di PR #32

| Kembalikan ke | Alasan |
|---|---|
| Angka besar dulu, lalu satu baris meta berisi label **dan** pembanding | Wireframe yang disetujui. Tiga referensi mendukung label-di-atas, tapi tidak satu pun mengalahkan persetujuan pemilik |
| Tombol baris **berbingkai** | Nol referensi mendukung varian tenang, dan wireframe menggambarnya berbingkai. Masalah "25 bingkai jadi deretan" dijawab dengan cara wireframe: kolom aksi sempit dan seragam |

### 4.2 Permukaan — sumbernya sudah ≥2, boleh dikerjakan

1. **Chip status di semua tabel** (3 sumber) — Pesanan, Menu, Stok, Promo, Pengaturan, Kasir
2. **Kepala panel per rute**: `Nama · cakupan · timestamp` + satu aksi (6 sumber)
3. **Satu tombol solid per layar** — Pengaturan sekarang punya dua, itu pelanggaran (4 sumber)
4. **`.kasir-ghd` naik ke ink-2** — 4.4:1 gagal AA di latar raised, bug yang sama sudah
   diperbaiki di sisi dv2
5. **`prefers-reduced-motion`** untuk transisi yang saya tambahkan — utang aksesibilitas,
   bukan preferensi

### 4.3 Produk — disetujui pemilik 2026-07-31

1. **Laporan jadi buku besar berpotongan.** `Total Penjualan` → dikurangi Diskon, Pajak,
   Service Charge → `Estimasi Pendapatan`. Potret pajak per pesanan sudah ada di database
   (migrasi `2026-07-27c`), jadi angkanya bisa direkonsiliasi. Nama baris terakhir memakai
   kata **"Estimasi"**, mengikuti Tantri — jujur soal mana angka yang perkiraan.
2. **Angka menyebut nama.** `Menu dibuka tamu · 0` → `Paling sering dibuka: <nama menu>`.
   `Analytics_Logs` menyimpan `click_menu` per menu, jadi datanya ada. Uji tindakan §0.3
   baru lolos setelah angkanya punya nama.
3. **Kuota AI tiga bentuk.** Proporsi + terpakai/total + sisa, menggantikan `128 tersisa`.

### 4.4 Belum dibuka, dan jujur soal alasannya

35 plate wireframe sisa · 15 needmcp · 25 tantri · ~100 frame admin kembar · 83 frame menu
tamu.

Frame `menu/` di luar lingkup: itu permukaan tamu, dikerjakan worktree `menu-ux`.
Sisa frame `admin/` sudah terbukti kembar. Sisa needmcp dan tantri masih mungkin
menyumbang, tapi sepuluh gambar terakhir semuanya **mengonfirmasi** keputusan yang sudah
punya ≥2 sumber, bukan mengubahnya — dan tiga temuan yang benar-benar mengubah arah
(§4.3) semuanya sudah muncul.

