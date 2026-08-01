# Product

## Register

product

## Users

**Pemilik kafe kecil di Bandar Lampung**, 1–3 orang staf, sering merangkap jadi kasirnya
sendiri. Membuka konsol di sela melayani tamu — bukan duduk menganalisis, tapi melirik
sebentar lalu kembali bekerja. Perangkat utamanya **tablet konter 768–1024 landscape**
(`ASUMSI-A1`, belum diverifikasi lapangan), HP 390px kedua, laptop ketiga.

Dua permukaan, dua pekerjaan berbeda:

- **`/kasir`** — kelas operasional. "Apa yang harus saya kerjakan sepuluh menit ke depan?"
  Dipakai sambil berdiri, tangan basah, layar kena cahaya etalase.
- **`/dashboard-v2`** — kelas katalog & kelola. "Apa yang perlu diubah, apa yang terjadi
  minggu lalu?" Dipakai lebih tenang, biasanya setelah tutup.

## Product Purpose

Konsol operasional untuk kafe yang menerima pesanan lewat QR meja. Bukan papan pelaporan —
**layar kerja**. Kegagalan dashboard sebelumnya bukan karena jelek, tapi karena tidak punya
pendapat tentang apa yang dikerjakan pemiliknya: sepuluh kartu KPI, lima chart, seluruh
tabel inventory, semuanya berbobot sama.

Sukses diukur dari satu hal: **kafe baru bisa jualan di hari pertama tanpa mengatur apa
pun**, dan pemiliknya belajar tujuh rute lebih cepat daripada enam belas yang rapi. Itu
yang menentukan apakah layanan ini bisa dijual berlangganan.

## Brand Personality

**Tenang · terus terang · bisa diandalkan.**

Bicara bahasa Indonesia sehari-hari, bukan bahasa POS Amerika. "Pesanan", bukan tiket atau
check. "Bahan", bukan SKU. "Menunggu 6 menit", bukan elapsed.

Nada yang dituju: alat yang tidak pernah membesar-besarkan dan tidak pernah menyembunyikan.
Angka yang gagal diambil bilang "—" beserta alasannya, bukan "0". Laporan menyebut
"Estimasi", bukan "Pendapatan". Nol yang dipilih dibedakan dari nol yang kebetulan.

Pembanding kelas terbaik: **Linear** (padat tapi tenang, hierarki dari berat dan spasi) dan
**Stripe** (tabel angka yang bisa dipercaya, keadaan yang tidak pernah ambigu).

## Anti-references

Dari jebakan yang terlihat langsung di dua puluh referensi yang dibuka, tercatat lengkap di
`docs/konsol-v2/BACAAN-REFERENSI.md`:

- **Kartu KPI berderet yang tidak ikut saringan tabel** — dua angka berbeda di satu layar
  menghancurkan kepercayaan pada keduanya
- **Hue sebagai identitas kategori** — donat empat warna dengan legenda, seri chart
  berwarna-warni; maknanya hilang saat dicetak hitam-putih
- **Status "Pending"** — tidak menyebut siapa pemegang bola
- **Badge tanpa ambang** (`Optimal`) — tidak bisa ditindaklanjuti maupun dibantah
- **Ambang disembunyikan di tooltip** — layar jadi tidak bisa dipindai
- **Merah untuk brand DAN untuk kegentingan sekaligus** — begitu keduanya bertemu, tidak
  ada yang bisa dibedakan
- **Denah lantai per venue** — aset gambar tiap pelanggan, biaya onboarding yang membunuh
  langganan
- **Kepadatan diturunkan demi kelapangan** di layar operasional. Lapang itu bagus di rute
  kelola, racun di antrean kasir.

## Design Principles

1. **Tiap angka harus bisa ditindaklanjuti.** Uji: "kalau nilainya jelek, apa yang dilakukan
   pemilik hari ini?" Tidak ada jawaban → turun ke lapis 2. Ini aturan yang membunuh sepuluh
   kartu KPI, dan yang mencegahnya kembali.

2. **Sebut pemegang bola.** Tiap keadaan menyatakan siapa yang ditunggu — kamu, kami, atau
   tamu. Kosakata yang tidak menyebutnya dilarang.

3. **Jujur soal yang tidak diketahui.** Angka yang gagal tampil sebagai "—" beserta
   alasannya dan waktu sinkron terakhir. Merender "0" saat query gagal adalah kegagalan
   paling berbahaya yang ada, karena tidak terlihat seperti kegagalan.

4. **Batasan mencegah keputusan buruk; hanya kerajinan yang menghasilkan keputusan bagus.**
   Anggaran berangka bukan desain. Penahanan diri tanpa kerajinan cuma polos.

5. **Referensi dipakai untuk mekanisme, tidak pernah untuk komposisi.** Satu referensi
   maksimal menyumbang satu keputusan; keputusan layout butuh ≥2 sumber berbeda. Urutan
   wewenang: wireframe yang disetujui > kontrak berangka > referensi produk > penalaran
   sendiri.

## Accessibility & Inclusion

- **WCAG AA**, diverifikasi per permukaan — bukan per palet. Tangga abu yang lolos di latar
  panel bisa gagal di latar raised; itu sudah pernah terjadi dan lolos ke produksi.
- **Tidak ada informasi yang hanya dibawa warna.** Tiap warna wajib didampingi kata.
  Kombinasi merah–hijau sebagai pembeda utama dilarang.
- **Lantai teks keras 12px**, tanpa pengecualian. Jarak baca konter dan silau etalase.
- **`prefers-reduced-motion` dihormati penuh** — gerak dimatikan, bukan dipercepat.
- **Target sentuh minimal 32px**, baris 44px. Perangkat utamanya bersentuhan, dan hover
  tidak pernah terjadi di sana.

## Keputusan yang masih terbuka

- **Tema gelap belum pernah diuji terhadap adegan fisiknya.** Kalimat adegan — pemilik
  melirik tablet konter di bawah cahaya tropis dari etalase — mengarah ke terang, bukan
  gelap. Konsol gelap sekarang diwarisi dari token dashboard lama, bukan dipilih. Menunggu
  `ASUMSI-A1` diverifikasi dengan satu observasi 90 menit di konter.
