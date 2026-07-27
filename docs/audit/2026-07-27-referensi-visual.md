# Referensi visual dashboard — inventaris dan bacaan

**Tanggal:** 2026-07-27
**Pemicu:** wireframe v3 disetujui. Aturan riset kita: `Asset/referensi/` dibiarkan kosong sampai wireframe disetujui, supaya urutan "struktur dulu, gambar belakangan" bisa diperiksa dari tanggal file. Syarat itu sekarang terpenuhi.
**Aturan yang tetap berlaku:** satu referensi maksimal menyumbang **satu** keputusan, dan tiap keputusan layout butuh **≥2 referensi produk berbeda**. Referensi dipakai untuk **mekanisme**, tidak pernah untuk komposisi.

---

## 0. Koreksi terhadap catatan sesi sebelumnya

Sesi sebelumnya mencatat "needmcp kosong untuk wireframe web". **Itu salah, dan penyebabnya kesalahan query, bukan katalognya.**

needmcp memakai `platform: "desktop"`, bukan `"web"`. Filter `platform=web` mengembalikan nol dari katalog berisi **190 wireframe**, di antaranya **23 kategori Dashboard** dan beberapa yang secara eksplisit POS restoran. Katalognya selama ini ada.

Konsekuensinya: kesimpulan lama "sumber referensi dashboard sangat tipis" tidak berlaku lagi. Yang tetap benar: Dribbble dan galeri halaman marketing tetap bukan sumber untuk kelas masalah ini.

---

## 1. Inventaris — apa yang sekarang ada di disk

| Sumber | Jumlah | Lokasi | Sifat |
|---|---|---|---|
| **needmcp** | 24 | `Asset/referensi/needmcp/` | Wireframe render, 1920px, sebagian POS restoran |
| **21st.dev** | 5 | `Asset/referensi/21st/` | Termasuk `efferd-dashboard-2` — sumber kegagalan lama |
| **Tantri** | 31 | `Asset/referensi/tantri/` | POS Indonesia, tangkapan produk hidup |
| **Tantri / 4D (repo)** | 231 + 190 frame video | `Asset/` | dari riset kompetitor sebelumnya |

Tiga folder pertama sebelumnya hanya ada di direktori temp sesi lama dan bisa hilang sewaktu-waktu. Sekarang di repo.

**Nol dari Dribbble.** Berkas Dribbble yang ada di disk milik worktree `menu-ux` — itu kerja menu pelanggan oleh agent lain, bukan dashboard.

---

## 2. Yang diperiksa langsung, bukan dari deskripsinya

Empat render dibaca visual. Masing-masing dicatat sebagai **mekanisme yang diambil** dan **jebakan yang ditolak**.

### 2.1 `order-history-table` — riwayat pesanan POS

**Diambil:** tab status sebagai filter utama, kolom `Payment` sejajar `Total` sehingga metode bayar bisa dipindai tanpa membuka baris, dan aksi tunggal `View` per baris.

**Ditolak — dan ini yang paling berguna:** pil `Today: $1,420.80 (32)` melayang di kanan atas, **terpisah dari tabel dan tidak mengikuti filter tab**. Saat tab `Cancelled` aktif, angka itu tetap menampilkan total hari ini. Dua angka berbeda di satu layar, dan pengguna tidak diberi tahu yang mana menjawab apa.

Ini persis §2.6. Wireframe v3 menaruh total di **baris footer tabel yang ikut filter**. Referensi ini jadi bukti lapangan bahwa pelanggarannya nyata dan lazim, bukan kekhawatiran teoretis.

Catatan kedua: status `kitchen` tidak menyebut siapa pemegang bola — pelanggaran kosakata yang sama dengan "Pending".

### 2.2 `ordering-dashboard` — POS input manual

**Diambil:** baris identitas kasir `Courtney Henry · Cashier • 1st Shift` menempatkan **shift di dalam identitas**, bukan sebagai panel terpisah. v3 sudah memakai bentuk yang sama (`Rina · sejak 15.00`) — referensi ini mengonfirmasinya, bukan mengubahnya.

**Diambil:** ringkasan pembayaran menampilkan `Tax (10%)` sebagai **baris tersendiri di atas Total**, selalu, bukan dilebur ke dalam total.

**Yang paling berharga: pembenaran atas apa yang TIDAK kita bangun.** Seluruh 70% kiri layar ini adalah grid menu berfoto + keranjang — infrastruktur untuk kasir yang mengetik pesanan. Karena semua pesanan 3Diner masuk dari QR meja, **seluruh blok itu tidak diperlukan**. Konsol Kasir kita mendapat layar penuh untuk antrean, bukan sepertiga sisa.

Ini juga menunjukkan biaya keputusan sebaliknya: kalau suatu saat input manual diminta, yang ditambahkan bukan satu tombol — melainkan grid, keranjang, pemilih varian, dan alur bayar.

### 2.3 `system-settings-form` — konfigurasi POS

**Diambil:** `Tax Rate (%)` sebagai field kelas satu di konfigurasi toko, sejajar nama toko. v3 sudah menempatkannya begitu di Pengaturan.

**Diambil, mekanisme baru:** `Drawer Summary` — `Float · Cash · Card · Expected`, di mana **Expected = Float + Cash saja**, kartu tidak dihitung karena tidak masuk laci. Itu satu baris yang mengubah "berapa uang masuk" jadi "berapa yang harus ada di laci sekarang" — bisa langsung dicocokkan.

**Belum diadopsi**, dan sengaja: rekonsiliasi laci kas adalah wilayah POS penuh, dan keputusan produk kita menolak jadi system of record untuk uang. Dicatat di sini supaya kalau nanti tutup-shift dibangun, mekanismenya sudah jelas — bukan diciptakan ulang.

### 2.4 `sales-analytics-view` + `dashboard-sidebar-overview` — dua konfirmasi

Dua referensi berbeda, dua keputusan yang masing-masing sekarang punya bukti ≥2 sumber:

**Chart monokrom dengan satu batang digelapkan.** Muncul di dua-duanya, dan di Efferd. Tiga sumber independen. Ini menyelesaikan aturan "≥2 referensi" untuk keputusan chart di rute Laporan — yang di v3 sudah digambar persis begitu.

**Sidebar bergrup berlabel.** `MAIN MENU / CUSTOMERS / MANAGEMENT / SETTINGS` di sini, `Product / Workspace / Administration` di Efferd. Dua sumber. Tapi lihat bagian 3 — pengelompokan tidak menyelamatkan jumlahnya.

---

## 3. Empat jebakan yang terlihat di render, bukan di teori

Referensi ini paling berguna bukan sebagai contoh yang ditiru, melainkan sebagai **bukti bahwa pasal kontrak menjawab kegagalan nyata**.

| Yang terlihat | Di mana | Pasal yang menjawab |
|---|---|---|
| **Empat KPI seragam, deltanya identik semua** — `+0,94 last year` di keempat kartu | `dashboard-sidebar-overview` | §1.1 maks 3, dan tiap angka wajib punya pembanding yang benar |
| **Badge tanpa ambang** — `Avg Order $29.62` diberi label `Optimal`, tanpa memberi tahu ambangnya. Tidak bisa ditindaklanjuti maupun dibantah | `sales-analytics-view` | §0.3 uji tindakan |
| **Donut empat hue + legenda** — kategori dikodekan lewat warna, jadi maknanya hilang saat dicetak hitam-putih | `sales-analytics-view` | §1.3 maks 3 hue, tidak ada informasi yang hanya dibawa warna |
| **Status `Pending`** hidup di tabel transaksi | `dashboard-sidebar-overview` | §4 kosakata wajib menyebut pemegang bola |

Dua tambahan yang tidak masuk tabel tapi layak dicatat:

- **Semua kolom sortable** (panah di tiap header) di `dashboard-sidebar-overview` — §2.10 menyebut ini GAGAL. Sortir di mana-mana artinya tidak ada yang memutuskan urutan default mana yang benar.
- **16 item nav dalam 4 grup.** Pengelompokan membuatnya terbaca, tapi tidak membuatnya sedikit. Konsol Owner kita **7 rute tanpa grup** — dan tujuh yang datar lebih cepat dipelajari daripada enam belas yang rapi.

---

## 4. Apa yang berubah pada wireframe v3

**Tidak ada.** Empat referensi ini mengonfirmasi keputusan yang sudah diambil dan tidak membantah satu pun:

| Keputusan v3 | Status setelah referensi |
|---|---|
| Total di footer tabel, ikut filter | dikuatkan — pelanggarannya terlihat hidup di `order-history-table` |
| Chart monokrom, satu batang disorot | dikuatkan — 3 sumber independen |
| Baris pajak selalu dirender, termasuk saat nol | dikuatkan — 2 sumber |
| Shift di dalam identitas kasir | dikuatkan — 1 sumber |
| Konsol Kasir tanpa grid menu & keranjang | dikuatkan — biayanya jadi terlihat |
| Maks 3 angka besar | dikuatkan lewat kegagalan pembanding di 2 sumber |
| Tujuh rute datar tanpa grup | dikuatkan lewat kontras 16-item |

Itu hasil yang diharapkan, dan urutannya penting: struktur dikunci lebih dulu, gambar dibuka sesudah. Kalau referensi dibuka duluan, sulit dibedakan mana yang keputusan dan mana yang kebetulan disalin.

**Satu mekanisme dicatat untuk nanti, belum diadopsi:** `Expected = Float + Cash` untuk tutup laci.

---

## 5. Yang masih tidak bisa dijawab referensi mana pun

Nol dari 24 render needmcp menampilkan **state kosong, gagal muat, atau data panjang**. Semuanya happy-path dengan angka pendek dan nama pendek. Kontrak state 5-wajib di v3 tidak punya satu pun referensi visual — dan justru itu bagian yang paling sering pecah di hari pertama kafe baru.

`ASUMSI-A1` — perangkat dan jarak baca pemilik — tetap tidak terjawab. Dua puluh empat gambar desktop 1920px tidak memberi tahu apa pun tentang tablet konter di kafe Bandar Lampung. Satu observasi 90 menit menjawabnya.
