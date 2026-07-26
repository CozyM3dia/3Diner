# Kontrak Wireframe Dashboard 3Diner v1

**Tanggal:** 2026-07-27
**Sumber:** studi 5 topik craft dashboard operasional (Linear, Stripe, Vercel, Datadog, Front, Shopify, Toast KDS, Bloomberg, Tufte, Few, Carbon/Polaris/Primer) — 79 mekanisme, lalu diturunkan jadi anggaran berangka.
**Sifat:** alat review. Tiap aturan ditulis supaya bisa dinyatakan **LULUS / GAGAL** dengan melihat wireframe. Aturan yang tidak bisa gagal tidak boleh ada di sini.

---

## 0. Aturan pengatur

### 0.1 Dua kelas layar

Satu angka untuk semua layar adalah penyebab dashboard lama gagal.

| Kelas | Rute | Pertanyaan layar | Kepadatan |
|---|---|---|---|
| **A — Operasional** | Hari Ini · Pesanan · Meja & Tagihan · Stok · `/kasir` | "Apa yang harus saya kerjakan sepuluh menit ke depan?" | Padat |
| **B — Katalog & Kelola** | Menu · Promo & Pengumuman · Penjualan · Analitik · Staf & Shift · Pengaturan | "Apa yang perlu diubah / apa yang terjadi minggu lalu?" | Sedang–lapang |

### 0.2 564 fitur tetap ada, tapi tidak semuanya di lapis 1

- **Lapis 1** (baris/daftar) — untuk **memilih** objek mana yang dikerjakan
- **Lapis 2** (detail/sheet/halaman edit) — untuk **mengerjakan** objek itu
- **Lapis 3** (menu sekunder, Pengaturan) — jarang dipakai dan/atau merusak

Review **GAGAL** kalau ada fitur **hilang**. Review **LULUS** kalau fitur pindah lapis. Tiap wireframe wajib menyertakan daftar *"fitur yang dipindahkan ke lapis 2/3"* — bukan daftar *"fitur yang dihapus"*.

### 0.3 Uji tindakan

Setiap angka, kartu, badge, dan kolom di lapis 1 harus lolos:

> **"Kalau nilainya jelek, apa yang dilakukan pemilik hari ini?"**

Tidak ada jawaban → turun ke lapis 2. Ini aturan yang membunuh 10 kartu KPI, dan yang mencegahnya kembali.

---

## 1. Anggaran berangka

### 1.1 Objek setara

| Anggaran | Kelas A | Kelas B | Alasan |
|---|---|---|---|
| Objek setara per kelompok visual | **maks 3** | **maks 5** | Pembedaan preattentive hanya jalan untuk sedikit tingkat; di atas 5, mata beralih ke pembacaan sekuensial dan "sekilas" jadi mustahil |
| Kelompok visual tingkat atas per layar | **maks 4** | **maks 5** | Panjang halaman = jumlah pekerjaan nyata. Kelompok kosong **tidak dirender** |
| Kartu angka besar di zona teratas | **maks 3** | **maks 3** | Turun dari 10. Zona teratas layar operasional milik antrean, bukan angka |
| `<h1>` per halaman | **tepat 1** | **tepat 1** | Turun dari 3 |
| Badge berangka di seluruh aplikasi | **tepat 1 tempat** | — | Badge angka = janji "ada N hal menunggu tindakanmu". Satu badge yang tidak bisa dinolkan merusak kepercayaan pada semua badge |
| Aksi terlihat per baris | **maks 2** + 1 overflow | sama | <3 aksi di balik menu = 2 keputusan tambahan × N baris. ≥3 inline = target sentuh berdesakan |
| Tombol solid (primary) per layar | **tepat 1** | **tepat 1** | Dua tombol terisi = tidak ada yang primer |

### 1.2 Skala tipe — 5 langkah, tidak boleh ke-6

| Token | Nilai | Tugas |
|---|---|---|
| `t-meta` | 12px / 400 | Label kolom sekunder, satuan, timestamp arsip, helper |
| `t-body` | 14px / 400 | **Fondasi.** Isi baris tabel, paragraf, nilai field |
| `t-strong` | 14px / 600 | Header kolom, judul panel, nama objek, label status |
| `t-title` | 20px / 600 | Judul halaman (`h1`), satu per halaman |
| `t-figure` | 28px / 600 / `tabular-nums` | Angka utama. **Maks 3 per layar** |

Skala berfungsi sebagai **kode** — pembaca belajar "ukuran ini artinya label". Kode hanya bisa dipelajari kalau simbolnya sedikit. Turun dari 12 ukuran.

**Lantai keras 12px, tanpa pengecualian.** Worktree sekarang punya 86 kemunculan 8/9/10px — tidak terbaca di jarak konter maupun di bawah silau.

**Berat huruf: tepat 2** (400 dan 600). 500/700 dilarang — tidak bisa dibedakan andal dari 400/600 pada 14px.

### 1.3 Warna — 3 hue total

| Peran | Jumlah | Arti (wajib muncul sebagai teks di UI) |
|---|---|---|
| Aksen brand (oranye) | 1 hue | Aksi primer + satu sorotan per layar. **Bukan penanda kategori** |
| Merah | 1 hue | "Lewat batas / gagal — tindakan sekarang" |
| Amber | 1 hue | "Mendekati batas — perhatian" |
| Tangga abu teks | 4 tingkat | utama / sekunder / redup / nonaktif |
| Tangga abu permukaan | 3 tingkat | kanvas / panel / baris-hover |

Turun dari 7 hue. Salience warna itu relatif — 7 aksen berarti tidak ada yang menonjol. Itu persis gejala "warna-warni tapi datar".

Aturan turunan:
- Urutan kuantitatif (umur pesanan, tingkat stok) di-encode sebagai **intensitas satu hue + label teks + urutan sortir**, bukan hue berbeda. Intensitas dipersepsi ordinal tanpa diajari; hue tidak.
- **Tidak ada informasi yang hanya dibawa warna.** Setiap warna wajib didampingi kata.
- Kombinasi merah–hijau sebagai pembeda utama: dilarang.
- **Zebra striping: dilarang.** Latar baris harus tetap tersedia untuk menandai keadaan nyata (pesanan telat, stok habis).

### 1.4 Ruang dan bentuk

| Anggaran | Nilai |
|---|---|
| Skala jarak | **6 langkah**: 4 / 8 / 12 / 16 / 24 / 32. Di luar daftar = GAGAL |
| Dalam kelompok | 8 · **antar kelompok** 24 · **antar seksi** 32 (rasio min 3:1 supaya proximity mengelompokkan tanpa border) |
| Sumbu perataan per layar | **tepat 2** — satu kiri (label/teks), satu kanan (angka & aksi) |
| Kedalaman panel | **maks 1 lapis.** Panel bersarang = GAGAL |
| Radius | 2 nilai (kecil untuk kontrol, sedang untuk panel) |
| Shadow | 1 nilai, hanya untuk lapisan mengambang |

---

## 2. Pola tabel — berlaku di Pesanan · Menu · Stok · Penjualan

1. **Baris = objek yang bisa dibuka.** Kolom hanya memuat yang dibutuhkan untuk **memilih** baris, bukan mengerjakannya.
2. **Tinggi 44px, satu baris teks.** Panjang → `truncate` + `title`. `line-clamp` dan `wrap` **dilarang**.
3. **Header lengket**, tinggi sama dengan baris.
4. **Kolom identitas terkunci kiri, kolom aksi lengket kanan.** Tanpa ini, baris jadi anonim setelah scroll dan pengguna bertindak pada baris yang salah.
5. **Angka rata kanan, `tabular-nums`, presisi dikunci per kolom, "Rp" di header bukan di sel.**
6. **Ringkasan = baris total di footer yang IKUT filter aktif** — bukan kartu KPI terpisah di atas tabel. Dua angka berbeda di satu layar menghancurkan kepercayaan pada keduanya.
7. **Aksi baris selalu terlihat.** Hover-reveal **dilarang** — perangkat dominan bersentuhan.
8. **Aksi merusak tidak pernah inline.** Konfirmasi wajib **menyebut nama/nomor objek**; gerbang ketik untuk yang ireversibel. Band merah hanya untuk yang benar-benar tidak bisa dibatalkan.
9. **Waktu:** durasi berjalan untuk baris aktif, tanggal absolut untuk arsip (absolut selalu tersedia sebagai `title`).
10. **Satu sort default per layar.** Semua-kolom-sortable = GAGAL.
11. **Semua state daftar hidup di URL** (tab, filter, sort, kursor, query).

### Putusan dual-render

**Dual-render permanen (`hidden lg:block` + `lg:hidden`) DILARANG** — dua sumber kebenaran, id ganda, tiap baris muncul dua kali di pohon aksesibilitas.

**Pola `ResponsiveDataView` dipertahankan** (kedua cabang hanya selama mode belum diketahui, lalu satu cabang saja ter-mount). Itu sudah benar.

**Breakpoint turun 1024 → 768px** — 768–1023 adalah tablet konter, perangkat kerja utama. `[ASUMSI-A2]`

**Kartu <768 bukan tabel diputar vertikal.** Maks **3 field**, urutan identik dengan urutan kolom.

**Scroll tak hingga: dilarang di seluruh dashboard.** Daftar yang menerima insert saat dibaca (riwayat pesanan, mutasi stok) pakai **kursor Sebelumnya/Berikutnya** — offset menggeser jendela saat baris baru masuk, sehingga baris bisa **terlewat**, dan pesanan terlewat berarti pesanan tidak dikerjakan.

### Spesifikasi per layar

| | Pesanan | Menu | Stok | Penjualan |
|---|---|---|---|---|
| Kalimat layar | "Mana yang belum dikerjakan dan menunggu paling lama?" | "Item mana yang perlu dimatikan/diubah harganya hari ini?" | "Bahan apa yang habis sebelum sempat belanja?" | "Hari/menu mana yang bergerak, dan berapa totalnya?" |
| Sort default | **Umur turun** | **Urutan manual** (urutan menu adalah data) | **Rasio sisa:ambang naik** | Tanggal terbaru |
| Tab (berhitungan) | Perlu dimasak · Siap diantar · Semua hari ini | Aktif · Nonaktif · Semua | Menipis · Habis · Semua | — |
| Seleksi massal | tidak | **ya** | opsional | tidak |
| Aksi inline | Konfirmasi · Tunda | Toggle aktif · Edit | Sesuaikan stok · Tandai dibeli | — |

---

## 3. Antrean "Perlu keputusan" — zona teratas Hari Ini

Bukan ringkasan. Satu antrean berisi **hanya** hal yang belum diputuskan.

- **Setiap baris wajib punya aksi terminal** yang membuatnya **hilang** dari layar: Terima / Tolak / Gabungkan / Tunda. Baris tanpa aksi terminal tidak boleh ada.
- **Tunda adalah state kelas satu**, bukan dismiss. Preset kontekstual: *"sampai buka besok"*, *"sampai supplier balas"*, *"sampai model 3D selesai"*. Item kembali otomatis kalau ada aktivitas baru padanya.
- **Definisi antrean ditulis dan ditampilkan.** Satu baris sampah merusak kepercayaan pada seluruh antrean.
- **Urutan grup:** Butuh keputusan sekarang → Mendekati batas → Menunggu pihak lain → Selesai hari ini. **Grup kosong tidak dirender.**
- **Deadline ditulis sebagai konsekuensi, bukan umur.** *"Batal otomatis 18:40"*, bukan *"masuk 18:10"*. Kalau tidak ada konsekuensi nyata dari keterlambatan, jangan pasang timer sama sekali.
- **Konsolidasi:** satu tindakan sama untuk N item → satu baris (*"6 model 3D gagal — lihat"*, bukan 6 baris).
- **Jam SLA berhenti di luar jam buka.** Notifikasi "terlambat" jam 3 pagi adalah cara tercepat pemilik mematikan notifikasi. `[ASUMSI-A5]`

---

## 4. Kontrak state — 5 wajib per layar

Wireframe dengan <5 state = **GAGAL**, tanpa diskusi. Tinggi kontainer = tinggi 5 baris tabel supaya tidak ada lompatan layout.

| # | State | Judul | Isi | Aksi | Larangan |
|---|---|---|---|---|---|
| 1 | **Memuat** | — | — | — | Skeleton **berbentuk tabel** — kolom, lebar, perataan, tinggi baris persis sama. Spinner halaman penuh dilarang |
| 2 | **Ada isi** | (tabel) | (tabel) | Baris + toolbar | Saat refetch: baris lama tetap tampil + indikator kecil |
| 3 | **Kosong — perdana** | "Belum ada pesanan masuk" | Apa yang akan muncul di sini | **CTA setup** | — |
| 4 | **Kosong — hasil filter** | "Tidak ada bahan yang cocok" | **Sebutkan kriteria aktif** | **[Hapus filter]** | CTA "buat baru" sebagai aksi utama **DILARANG** — memancing entri ganda karena pengguna mengira datanya hilang |
| 5 | **Gagal memuat** | "Gagal memuat data" | Alasan + **waktu sinkron terakhir berhasil** | **[Coba lagi]** | Kalau ada data lama, tetap tampilkan dengan penanda "mungkin usang" |

**State bonus wajib Kelas A —** *kosong karena semua beres*, dinyatakan sebagai **hasil**: *"Semua pesanan sudah ditangani — terakhir 18:42"* + ringkasan hari ini, **tanpa CTA yang menyuruh bekerja lagi**.

### Kontrak angka

Setiap angka punya **tiga tampilan**: nilai · nol · **tidak-tersedia** (dengan alasan + waktu sinkron terakhir).

> **Merender "0" saat query gagal adalah kegagalan paling berbahaya di dokumen ini** — karena tidak terlihat seperti kegagalan. Pemilik menyimpulkan kafenya sepi padahal integrasinya putus.

### Kosakata status wajib menyebut pemegang bola

**"Pending" dilarang.**

- Model 3D: *Menunggu unggahan (kamu) / Sedang diproses (kami) / Gagal, perlu file baru (kamu) / Siap tayang*
- Pesanan: *Baru / Disiapkan / Siap / Selesai / Ditunda / Dibatalkan*

---

## 5. Asumsi yang ditandai

Wireframe wajib menandai elemen ini dengan `[ASUMSI-n]` supaya reviewer tahu apa yang belum dikunci.

| # | Belum diketahui | Asumsi | Kalau salah |
|---|---|---|---|
| **A1** | Perangkat & jarak baca pemilik | **Tablet 768–1024 landscape di konter = utama**, HP 390 kedua, laptop ketiga | Semua angka §1.4 bergeser. **Penentu tunggal terbesar** |
| **A2** | Breakpoint responsif | Turun ke 768px | Sia-sia kalau ternyata HP (tapi tidak merusak) |
| **A3** | Apakah kafe menomori meja | **Meja = label teks bebas maks 6 karakter**, wajib ada "Bawa pulang"/"Tanpa meja" | Kolom bisa diperkecil & disortir numerik |
| **A4** | Ambang "terlambat" | Mendekati 10 mnt, Terlambat 15 mnt, dikonfigurasi per outlet | Warna & sort default berubah, mekanismenya tidak |
| **A5** | Jam buka tersimpan di Supabase? | Ya, semua hitungan SLA pakai jam buka | Sementara pakai 24 jam, **ditandai eksplisit** |
| **A6** | Berapa staf per outlet | **1 orang.** Header antrean tetap "Terakhir disentuh 18:42 · Rina" | Jadi "Jaga sekarang: Rina (sore)" dengan rotasi |
| **A7** | Kepadatan data cukup untuk sparkline? | **Sparkline tidak dibangun di v1** | Sparkline dengan 3 titik lebih buruk daripada tidak ada |
| **A8** | Kontras tangga abu 4 tingkat | "Redup" hanya untuk teks ≥14px non-esensial, wajib diverifikasi ≥4.5:1 | Tangga turun jadi 3 tingkat |
| **A11** | Meteran kredit AI | Turun ke Pengaturan, tidak di layar operasional | Naik jadi bullet di Hari Ini |

---

## 6. Checklist review — satu wireframe, satu lembar

Wireframe **GAGAL** kalau ada satu saja "ya":

☐ Teks di bawah 12px
☐ Ukuran huruf di luar 5 langkah
☐ Berat huruf selain 400/600
☐ Hue di luar {oranye, merah, amber} + tangga abu
☐ Informasi yang **hanya** dibawa warna (hilang saat dicetak hitam-putih)
☐ Lebih dari 3 kartu angka di zona teratas Kelas A
☐ Lebih dari 1 `h1`
☐ Badge berangka di luar satu tempat yang ditetapkan
☐ Panel di dalam panel
☐ Jarak di luar skala 4/8/12/16/24/32
☐ Lebih dari 2 sumbu perataan
☐ Tinggi baris selain 44px, atau tinggi baris campur dalam satu tabel
☐ Teks tabel dibungkus/`line-clamp` alih-alih dipotong
☐ Aksi baris yang hanya muncul saat hover
☐ Aksi merusak sebagai tombol inline
☐ Konfirmasi ya/tidak untuk aksi ireversibel (bukan gerbang ketik)
☐ Angka rata kiri/tengah, atau tanpa `tabular-nums`
☐ Angka tanpa pembanding (delta / target / ambang)
☐ Kartu KPI di atas tabel yang **tidak** ikut filter tabel
☐ Baris antrean tanpa aksi terminal
☐ Timestamp relatif sebagai satu-satunya penanda umur pada item ber-deadline
☐ Lebih dari 3 token durasi atau lebih dari 1 easing
☐ Insert realtime otomatis tanpa aturan buffer
☐ Layar bertabel dengan <5 state tergambar
☐ Empty-state-filter dengan CTA "buat baru" sebagai aksi utama
☐ Angka tanpa tampilan "tidak-tersedia"
☐ Status bernama "Pending", atau status yang tidak menyebut pemegang bola
☐ Scroll tak hingga
☐ Dual-render tabel+kartu permanen
☐ Fitur **hilang** tanpa tercatat di daftar "dipindahkan ke lapis 2/3"
☐ Elemen bergantung asumsi §5 tanpa penanda `[ASUMSI-n]`

---

## 7. File yang terpengaruh saat implementasi

Untuk penyusun wireframe — **bukan untuk diedit sekarang**:

`system/ResponsiveDataView.tsx` (breakpoint 1024 → 768, baris 37) · `system/DashboardStates.tsx` (1 varian → 5) · `system/DashboardMetric.tsx` (buang count-up rAF) · `MenuTable.tsx` · `InventoryTable.tsx` (buang `line-clamp-2`) · `OrdersClient.tsx` (buffer insert + flash sekali + toast coalescing + toast "realtime terputus" jadi state persisten) · `system/ConfirmAction.tsx` (identitas objek + gerbang ketik) · `globals.css` (`prefers-reduced-motion` blanket → per-kelas; token durasi jadi 3)
