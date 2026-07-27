# Revisi Usulan IA — setelah diuji terhadap 27 screenshot produk Tantri

**Tanggal:** 2026-07-27
**Menggantikan bagian 3 dari** `2026-07-27-usulan-ia-dashboard.md`. Sisanya tetap berlaku.
**Metode:** 5 agen membaca 27 screenshot produk asli, lalu satu agen menguji 15 keputusan IA terhadap bukti itu — diinstruksikan mencari yang **membantah**, bukan yang membenarkan.

Hasilnya: **6 dari 15 keputusan dibantah atau dilemahkan.** Itu justru tanda pengujiannya bekerja. Kalau semuanya lolos, agennya cuma mengangguk.

---

## 1. Yang dibantah, dan revisinya

### D5 — Rute Meja memegang tagihan → **DIBANTAH PALING TELAK**

Sel meja Tantri (`reservasi.png`) hanya berisi **nomor (01–21), kapasitas ("4 orang"), dan ilustrasi denah**. Tidak ada nominal, tidak ada durasi duduk, tidak ada jumlah item, tidak ada nama pelanggan. Uang hidup di tempat lain: nav `Transaksi` membawa badge **80**, dan seluruh layar tagihan adalah halaman tersendiri.

Tantri memperlakukan Meja sebagai **papan status yang harus terbaca dari jarak jauh**, bukan pemegang tagihan.

> **Revisi D5:** Meja = papan baca cepat. Ketuk → drawer/halaman tagihan. **Kepemilikan data tagihan tetap di rute Pesanan.** Kalau kartu meja diisi angka, ia kehilangan justru sifat yang bikin berguna saat jam sibuk.

Catatan tambahan: state meja Tantri disampaikan lewat **dua saluran warna yang saling bertentangan** — meja terisi = badge MERAH + ilustrasi HIJAU pekat; meja kosong = badge HIJAU + ilustrasi abu pudar. Jangan tiru. Pilih satu saluran.

### D4 — Pesanan dikelompokkan per meja → **tidak ada bukti, dan bukti menarik ke arah lain**

Tidak ada satu pun layar daftar pesanan Tantri di 27 screenshot. Yang ada justru:

- Checkout membawa badge **`No. Kursi` `L-5`** — kursi, bukan meja
- Tagihan dipecah **per ORANG bernama** — sembilan nama, masing-masing bawa pajak dan service fee sendiri
- **`Order Ke - 1`** — satu tagihan punya beberapa gelombang pesanan

Wadah alaminya adalah **tagihan**, dan meja/kursi cuma salah satu atributnya. Begitu satu meja punya dua pembayar, pengelompokan per meja pecah.

> **Revisi D4:** pesanan dikelompokkan per **tagihan**; tagihan punya atribut meja.

### D2 — Konsol lantai ber-PIN → **mekanismenya salah tempat**

PIN di Tantri bukan gerbang permukaan:

- `pengaturan-pin-auth.png` — PIN adalah **field pada form Tambah Karyawan** (`PIN *` → `Atur PIN` → modal 6 digit)
- `log-pin-auth.png` — PIN mengotorisasi **satu aksi**, dan lognya menyimpan kolom `Modul` = `Pembatalan Pesanan`

Tidak ada satu pun layar kunci PIN di depan konsol.

Konsekuensi praktis kalau tetap dipaksakan: PIN di pintu akan dibuka sekali di awal shift dan konsol tinggal terbuka seharian. **Kuncinya jadi teater** dan tidak menghasilkan jejak yang berguna.

> **Revisi D2:** buang PIN dari pintu. Bukti mendukung **PIN-per-aksi (D7)**, bukan PIN-per-rute. Kalau konsol perlu identitas, yang dibutuhkan adalah *"siapa yang sedang shift"*, bukan gembok.

### D3 — Grup KELOLA dikunci → **polanya sembunyikan, bukan kunci**

Tantri memisahkan lewat **peran** (`manajemen-karyawan.png`: kolom `Role` = Master, Manager Cabang, Kasir, Waiter — Master hanya satu orang) dan lewat **aplikasi berbeda**. Rail POS sama sekali tidak memuat item backoffice — item itu **tidak digembok, ia tidak ada**.

> **Revisi D3:** tampilkan berdasarkan peran. Grup terkunci yang tetap terlihat mengundang percobaan dan membebani kognisi tiap hari demi pengaman yang jarang dipakai. Gerbang hanya di aksi (D7).

### D9 — Analitik dan Penjualan tetap dua rute → **dilemahkan**

`laporan-penjualan.png` punya dropdown **`Summary`** di kanan atas: satu halaman laporan dengan **mode yang bisa diganti**. `summary-report-per-shift.png` menaruh laporan sebagai **grup bersarang** (`Summary Report` → `Laporan Per-Shift`), bukan rute datar.

Pola Tantri: tambah **scope** (hari → shift → outlet), bukan tambah rute. Dua rute datar hari ini akan jadi empat begitu ada laporan pajak dan laporan per-kategori.

> **Revisi D9:** satu rute `Laporan` + pemilih scope/mode, atau grup `Laporan` dengan anak.

Peringatan penamaan gratis dari mereka: layar bernama **`Laporan Keuangan` ternyata layar saldo dompet**, bukan laporan. Nama rute yang menyesatkan itu murah dibuat dan mahal diperbaiki.

### D10 — Label nav pakai nama tempat kerja → **dibantah oleh seluruh kosakata nav Tantri**

Semua **ITEM** nav adalah kata benda entitas:

```
Dashboard · Produk · Pesanan · Pelanggan · Pengaturan
Home · Katalog · Transaksi · Pelanggan · Table · Pengaturan
Cabang · Karyawan · Shift Karyawan · Daftar Stok · Daftar Pemasok
```

Sebaliknya, **GRUP** memakai nama pekerjaan: `Inventori`, `Pengelolaan Meja`, `Shifting`, `Summary Report`.

> **Revisi D10:** grup boleh dinamai tempat/pekerjaan (LANTAI, KATALOG, KELOLA), **item harus dinamai objek yang dicari orang.** Item bernama tempat bikin pencarian gagal — orang mencari "Menu", bukan "Katalog".

### D8 — peringatan yang terbukti dari Tantri sendiri

Memisah editor dan pembaca **menghasilkan kosakata pecah** kalau tidak dikunci lebih dulu. Bukti dari produk mereka:

| Backoffice | POS | untuk hal yang sama |
|---|---|---|
| `4 pax` | `4 orang` | kapasitas meja |
| `Map Meja` | `Table` | denah |
| `Produk` | `Katalog` | menu |
| `Aksi` | `Action` | kolom tabel |
| `Nama Bahan` | `Nama Bahan Baku` | bahan |

> **Syarat D8:** tetapkan glosarium **sebelum** dua permukaan dibangun.

### D1 — tidak dibantah, tapi nol bukti

Layar Dashboard Tantri tidak ada di 27 screenshot. Yang terlihat justru: Tantri **tidak menaruh "hari ini" di dashboard**. Sinyal kerja dikirim lewat **badge angka pada nav** — `Pesanan 12`, `Transaksi 80`, `Perlu Persetujuan 2`.

> **Implikasi:** kalau `/dashboard` jadi layar kerja **tanpa badge di nav**, orang tetap harus membukanya untuk tahu ada kerjaan. Badge bukan hiasan — ia bagian dari keputusan D1.

---

## 2. Tujuh belas hal yang muncul di screenshot tapi tidak terwakili di D1–D15

Diurutkan dari yang paling murah dan paling langsung mengubah bentuk rute.

1. **Kapan pembayaran terjadi.** Toggle `Bayar Sekarang?` (mati = pesan dulu bayar belakangan). Satu toggle menentukan apakah rute Meja/Pesanan perlu konsep tagihan terbuka sama sekali — dan **D5 serta D6 bergantung padanya**.
2. **Metode bayar dikelompokkan menurut SIAPA yang menyelesaikan** — `Non-Tunai` / `Bank` / `Kasir`, plus pembedaan `QRIS` vs `QRIS Static`. Penanda "bayar di kasir" bisa dibangun tanpa gateway apa pun.
3. **Kanal keluar dokumen.** `Kirim Faktur ke WhatsApp`, `Download PDF` per tagihan, ikon bagikan. **Struk diperlakukan sebagai URL.**
4. **Pembatalan sebagai status, bukan penghapusan.** `Dibatalkan` sebagai cabang terminal, plus `Riwayat` sebagai layar terpisah dari antrean aktif.
5. **Badge penghitung pada nav dan tab** — selalu menempel pada label, tidak pernah berdiri sendiri.
6. **Pelanggan sebagai modul.** Identitas = nomor telepon; baris = nama → telepon → `Rp 736.000 · 6 Item`. Di Tantri ini destinasi tab bar sejajar Pesanan. Di usulan 3Diner: **tidak ada sama sekali.**
7. **Reservasi** — empat status dengan penghitung, dua timestamp berbeda peran (waktu pesan vs waktu kunjungan).
8. **Area/lantai, kapasitas meja, dan editor denah.** D5 menyebut Meja tanpa menyebut zona, kapasitas, atau siapa yang menata.
9. **`Order Ke - 1`** — satu tagihan, beberapa gelombang pesanan. Konsekuensi model data langsung untuk D4/D6.
10. **Nomor yang bisa diucapkan.** `Nomor Order 156` dipisah dari `ID Order`; `KW001`, `SKU TR-0000001`, `IDTR-00001`, nomor meja `01`–`21`. D6 dan D7 sama-sama tidak berguna tanpa nomor yang bisa disebut di telepon.
11. **Rantai stok lengkap**, bukan satu rute Stok: Pemasok sebagai master data · Pembelian dengan harga (jalan menuju HPP) · Opname sebagai log append-only tanpa kolom Aksi · ambang minimum per bahan dengan peringatan inline di baris.
12. **Absensi adalah permukaan lantai, bukan backoffice.** `Masuk Shift` + swafoto + lokasi. Usulan menaruh "Staf & Shift" di KELOLA — padahal absensi dikerjakan staf di lantai, bukan pemilik saat tutup toko.
13. **Scope outlet hidup di shell**, bukan filter per halaman. Selektor `Outlet`/`Cabang` di puncak sidebar, di atas semua item nav. Meski 3Diner single-outlet, keputusan "scope di shell" jauh lebih murah diambil sekarang.
14. **Status integrasi pembayaran sebagai kolom + CTA inline** (`Aktivasi Xendit` di dalam sel tabel) — bentuk siap pakai untuk onboarding QRIS per kafe.
15. **Media cetak sebagai bagian IA.** Table tent membawa nomor meja tercetak, URL menu versi teks sebagai cadangan kalau scan gagal, edukasi 3 langkah Scan–Pesan–Bayar, dan daftar metode bayar yang diterima.
16. **Catatan per ITEM pesanan.** Ikon dokumen di sebelah stepper, prefiks `Note:` konsisten di lima layar.
    → **Terverifikasi di kode 3Diner:** `notes` hanya ada di level `Order` (`types/index.ts:168`). `CartItem` dan `OrderItem` **tidak punya field catatan.** Jadi "burger tanpa cabai tapi kentang extra pedas" tidak bisa diungkapkan hari ini. Ini lubang nyata.
17. **State prasyarat dan batas.** Tombol `Konfirmasi Split Bill` nonaktif tanpa alasan tertulis, versus teks bantuan `(Maksimal Range: 31 Hari)` yang ditulis di muka. **Tidak satu pun dari 15 keputusan menyentuh state kosong, error, atau disabled.**

---

## 3. Batas pengujian ini — dibaca sebelum dipercaya

- **Nol state kosong, error, validasi gagal, dan loading di seluruh 27 screenshot.** Semuanya happy-path terisi data. Keputusan IA yang tidak pernah diuji terhadap state kosong biasanya pecah pada hari pertama kafe baru dibuka.
- **D1 tidak bisa diuji sama sekali** — layar Dashboard Tantri tidak ada. Bukti paling bernilai berikutnya: Home POS Tantri, atau pembanding Olsera/Majoo/Pawoon/GoBiz.
- **D4 dan D5 tidak bisa diuji lebih jauh** — tidak ada layar daftar `Transaksi`, dan tidak ada layar setelah sel meja diketuk. Justru dua layar itu yang menentukan jawabannya.
- **D2 bertumpu pada ketiadaan.** Tidak ada layar kunci di 27 gambar — tapi ketiadaan pada render marketing bukan bukti kuat.
- **Sebagian besar item sidebar backoffice sengaja diburamkan.** Jangan pakai Tantri sebagai rujukan jumlah atau urutan rute.
- Isi menu kebab, form Tambah, dropdown `Summary`, panel Filter, format `Export` — semuanya tertutup.
- Dua file tertukar dengan namanya: `stok-opname.png` sebenarnya Daftar Pemasok, `daftar-pemasok.png` sebenarnya Daftar Stok Opname.

### Dan yang paling penting, tidak terjawab oleh screenshot apa pun

> Apakah kafe target di Lampung benar-benar membutuhkan split bill, reservasi, shift, dan absensi — atau ini fitur untuk kafe rantai Bandung yang bukan pasar 3Diner?

Tantri jelas menyasar merchant multi-cabang: selektor outlet di puncak sidebar, distribusi stok antar-cabang, empat tingkat peran. **Menyalin IA-nya berarti menyalin asumsi ukuran merchantnya.**

Sumber yang dibutuhkan: wawancara 3–5 pemilik kafe Lampung. Bukan gambar produk pesaing.

Itu item `A1-1` dan `A1-2` di checklist persiapan — dan sekarang ada lima pertanyaan konkret untuk dibawa ke sana.
