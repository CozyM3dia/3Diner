# Design System: Konsol 3Diner (owner + kasir)

> **Cakupan.** Berkas ini mengatur `/dashboard-v2` dan `/kasir` — permukaan **pemilik**.
> Aplikasi menu **tamu** punya sistemnya sendiri di `docs/DESIGN.md` (terang, mobile-first
> 375px, bottom nav). Keduanya sengaja berbeda: tamu memindai QR sambil duduk, pemilik
> melirik tablet konter sambil bekerja. Jangan pinjam aturan dari berkas yang satunya.
>
> **Wewenang.** `brand/UI_TOKENS.md` adalah sumber kebenaran untuk warna, huruf, radius,
> dan bayangan. Berkas ini **menurunkan** aturan pemakaian dari token itu untuk konsol; ia
> tidak boleh menciptakan nilai baru. Tiap penyimpangan dari brand ditandai eksplisit
> beserta alasannya — sejauh ini hanya ada satu, di tangga teks.
>
> **Konflik yang belum diselesaikan:** `brand/UI_TOKENS.md` menetapkan Orange `#FD5002`,
> sedangkan `Asset/build-asset/DESIGN.md` menetapkan Signal Orange `#F05A22`. Kode memakai
> `#FD5002`. Dua dokumen brand tidak boleh berbeda soal satu-satunya aksen yang ada; perlu
> diputuskan mana yang menang.

## 1. Visual Theme & Atmosphere

Alat konter, bukan papan pelaporan. Kepadatan tinggi, ketenangan tinggi, dekorasi nol.

Rasa yang dituju ada di persilangan **Linear** dan **Stripe**: hierarki lahir dari berat,
ukuran, dan nilai terang — tidak pernah dari hue; angka disusun supaya bisa dibandingkan
sekilas tanpa dihitung. Yang membuatnya terasa mahal bukan ornamen, tapi **presisi**:
jarak yang dihitung, garis rambut yang nyaris tak terlihat tapi konsisten, dan satu aksen
yang muncul paling banyak dua kali per layar.

Kedalaman datang dari **tangga luminансi permukaan**, bukan dari bayangan. Bayangan hanya
milik lapisan yang benar-benar mengambang.

**Tema gelap adalah keputusan yang belum diuji** — lihat `PRODUCT.md` §Keputusan terbuka.
Semua token warna di bawah ditulis supaya bisa dibalik jadi terang tanpa menyentuh satu
pun komponen.

## 2. Color Palette & Roles

Strategi: **Restrained** — netral bernada brand plus satu aksen di bawah 10% permukaan.

**Permukaan (4 tingkat, naik makin terang):**
- `--sf-canvas` `#060E1B` — kanvas dokumen, jeda antar seksi
- `--sf-panel` `#0D1829` — latar baris dan isi
- `--sf-raised` `#132136` — chrome: kepala tabel, kepala kelompok, pita seleksi
- `--sf-hover` `#16253C` — baris tersorot; **hanya** ada supaya latar baris tidak pernah
  dipakai untuk zebra

**Tangga teks (4 tingkat), diverifikasi terhadap DUA latar:**

| Token | Nilai | vs panel | vs raised |
|---|---|---|---|
| `--ink-1` | `#E9EEF6` | 13.4:1 | 11.6:1 |
| `--ink-2` | `#9FB2C9` | 8.2:1 | 7.5:1 |
| `--ink-3` | `#6E88A8` | 4.9:1 | **4.4:1 — gagal AA** |
| `--ink-4` | `#4A6484` | 2.8:1 | — |

**Aturan yang lahir dari tabel itu:** permukaan raised memakai `ink-2`, bukan `ink-3`.
Tangga yang diverifikasi hanya terhadap satu latar akan bocor di latar lain — sudah pernah
terjadi dan lolos sampai produksi.

`ink-4` **hanya** untuk kontrol nonaktif, yang memang tidak boleh terbaca sebagai sesuatu
yang bisa dikerjakan.

**Aksen — 3 hue, tidak lebih:**
- `--orange` `#FD5002` — aksi primer (**tepat satu per layar**) + badge antrean. Bukan
  penanda kategori, bukan penanda posisi nav.
- `--semantic-warning` `#F59E0B` — "mendekati batas, perhatian"
- `--semantic-danger` `#EF4444` — "lewat batas atau gagal, tindakan sekarang"

Tiap warna **wajib** didampingi kata. Dicetak hitam-putih, tiap layar harus tetap terbaca.

**Garis rambut:** `--dash-border` untuk pemisah dalam kelompok, `--dash-border-strong`
untuk batas yang memisahkan tugas (kaki tabel, bingkai kontrol).

## 3. Typography Rules

**Poppins**, sesuai `brand/UI_TOKENS.md` — satu keluarga untuk brand, dashboard, dan
permukaan tamu. Brand melarang memperkenalkan default baru, termasuk Inter dan termasuk
tumpukan huruf sistem. Konsol pemilik memakai logo dan warna yang sama dengan permukaan
tamu; memberinya huruf berbeda memecah satu produk jadi dua yang kebetulan sewarna.

Kalau kepadatan angka terbukti bermasalah, jalannya lewat `font-feature-settings` dan
tracking, bukan lewat mengganti keluarga.

**Lima langkah, tidak boleh ke-6.** Skala berfungsi sebagai kode: pembaca belajar "ukuran
ini artinya label". Kode hanya bisa dipelajari kalau simbolnya sedikit.

| Token | Nilai | Tugas |
|---|---|---|
| `--t-meta` | 12px / 400 | label kolom, satuan, timestamp, helper |
| `--t-body` | 14px / 400 | **fondasi** — isi baris, paragraf, nilai field |
| — | 14px / 600 | header kolom, judul panel, nama objek |
| `--t-title` | 20px / 600 | judul halaman, tepat satu per halaman |
| `--t-figure` | 28px / 600 | angka utama, maks 3 per layar |

**Berat: tepat dua**, 400 dan 600. 500 dan 700 tidak bisa dibedakan andal dari tetangganya
pada 14px, jadi menambahkannya menambah biaya tanpa menambah perbedaan yang terbaca.

**Lantai keras 12px**, tanpa pengecualian. Jarak baca konter dan silau etalase.

**Angka:** `tabular-nums` di setiap kolom numerik, plus `slashed-zero`. Di konsol yang
menampilkan nomor meja dan nominal berdampingan, nol yang bisa tertukar dengan huruf O
adalah kesalahan pembacaan yang nyata, bukan kehalusan tipografi.

## 4. Component Stylings

**Kontrol dasar** — tiap komponen interaktif punya tujuh keadaan: default, hover, focus,
active, disabled, loading, error. Ship tanpa salah satunya = belum selesai.

- **Tombol:** tinggi min 32px, radius `--r-ctl` 8px, bingkai 1px. Hover hanya di
  `@media (hover: hover)` — perangkat utamanya bersentuhan, dan aturan hover yang
  tersangkut setelah ketukan meninggalkan tombol menyala pada objek yang sudah selesai.
  `:active` menekan 1px: layar sentuh tidak punya hover untuk bilang "tanganmu sampai",
  dan ketukan tanpa tanda ditekan dua kali.
- **Tombol primer:** oranye pekat, **tepat satu per layar**. Dua tombol terisi berarti
  tidak ada yang primer.
- **Chip keadaan:** bingkai 1px + isian sangat tipis, radius `--r-ctl`, teks `--t-meta`.
  Bingkai memberi keadaan sebuah **batas**, jadi ia terbaca sebagai nilai dari himpunan
  tertutup. Nada warna hanya menambah penekanan di atas kata yang sudah lengkap.
- **Baris tabel:** tinggi **44px seragam**, teks dipotong bukan dibungkus. Baris yang
  tingginya berubah menggeser posisi tombol, dan tangan yang hafal tempatnya menekan baris
  yang salah.
- **Kepala tabel:** lengket, latar raised, `ink-2`, uppercase `letter-spacing: 0.04em`.
- **Kaki tabel:** total yang **ikut saringan aktif**. Bukan kartu melayang di atas tabel.
- **Kolom lengket:** identitas di kiri, aksi di kanan. Tanpa ini baris jadi anonim setelah
  digeser.
- **Pita angka:** rule vertikal tipis antar kolom, **nol bingkai kartu**. Kartu berbingkai
  terbaca sebagai objek yang saling berebut; rule membuatnya terbaca sebagai satu pita.
- **Buku besar:** label kiri, nilai kanan, potongan dalam kurung **dan** bernada, satu
  baris hasil dipisahkan garis. Bentuknya seperti struk karena pemilik kafe sudah membaca
  ratusan struk.
- **Lapisan mengambang** (dialog, menu): satu bayangan, backdrop gelap. Satu-satunya tempat
  bayangan diizinkan.
- **Kerangka muat:** berbentuk seperti isi yang akan menggantikannya — kolom, lebar,
  perataan, tinggi baris sama persis. Spinner halaman penuh dilarang.
- **State kosong:** menempati panel, judul 20px, badan maks 46ch. Di layar operasional
  kosong sering **kabar baik**, dan tipografi kecil membuat kabar baik terbaca seperti
  kesalahan.

## 5. Layout Principles

- **Perangkat utama tablet 768–1024 landscape.** Bukan mobile-first, bukan desktop-first.
- **Skala jarak 6 langkah:** 4 / 8 / 12 / 16 / 24 / 32. Di luar daftar = salah.
- **Rasio 3:1** antara jarak dalam kelompok (8) dan antar kelompok (24). Proximity yang
  mengelompokkan tanpa border; menambah garis di atasnya berarti membayar dua kali.
- **Tepat dua sumbu perataan** per layar: teks rata kiri, angka dan aksi rata kanan.
- **Kedalaman panel maks 1 lapis.** Panel bersarang selalu salah.
- **Maks 4 kelompok visual** per layar operasional, 5 untuk kelola. Kelompok kosong tidak
  dirender.
- Tabel menggulir ke samping di bawah lebar minimumnya, dengan kolom identitas dan aksi
  tetap lengket. Menggulir lebih baik daripada memotong nama keadaan.

## 6. Motion & Interaction

**Tiga durasi, satu easing.** Lebih dari itu terbaca sebagai dua produk yang ditempel.

- `--d-fast` 90ms — umpan balik tekan
- `--d-base` 150ms — hover, fokus, warna
- `--d-slow` 240ms — masuk/keluar lapisan
- `--e` `cubic-bezier(0.22, 1, 0.36, 1)` — ease-out eksponensial. Tanpa bounce, tanpa
  elastic.

Gerak menyampaikan **keadaan**, bukan dekorasi. Tidak ada urutan animasi saat halaman
dimuat: konsol dibuka untuk mengerjakan sesuatu, bukan untuk ditonton.

Hanya `transform` dan `opacity`. Tidak pernah properti layout.

`prefers-reduced-motion: reduce` mematikan gerak sepenuhnya — `none`, bukan dipercepat.
Umpan balik tekan tetap ada lewat warna.

## 7. Anti-Patterns (BANNED)

- Zebra striping. Latar baris harus tetap tersedia untuk menandai keadaan nyata.
- Hue sebagai penanda kategori atau identitas seri chart.
- Informasi yang hanya dibawa warna.
- Kartu KPI di atas tabel yang tidak ikut saringannya.
- Lebih dari 3 angka besar di zona teratas.
- Lebih dari satu `h1`, atau badge berangka di lebih dari satu tempat.
- Aksi baris yang hanya muncul saat hover.
- Aksi merusak sebagai tombol inline, atau konfirmasi ya/tidak untuk yang ireversibel.
- Status "Pending", atau status apa pun yang tidak menyebut pemegang bola.
- Scroll tak hingga, dan paginasi offset pada daftar yang menerima baris baru.
- Dual-render tabel + kartu permanen.
- Bayangan untuk apa pun yang tidak benar-benar mengambang.
- Emoji, gradient text, glassmorphism dekoratif, side-stripe border tebal.
- Modal sebagai pikiran pertama. Habiskan dulu kemungkinan inline dan bertahap.
