# Peta Fitur Gabungan — Tantri × 4D Smart Menu × 3Diner

**Tanggal:** 2026-07-27
**Metode:** 6 agen bedah paralel (situs, Play Store, help center, blog, harga, ulasan) + verifikasi kode langsung di repo.
**Status:** bahan keputusan. Belum ada kode ditulis.

---

## 0. Tiga koreksi terhadap asumsi awal

**1. "160+ fitur" Tantri adalah klaim pemasaran.**
Yang bisa dibuktikan dan diberi nama hanya **±40 sub-fitur** di dalam 10 pilar. Klaim mereka sendiri tidak konsisten: halaman Waiter App menulis "30+", materi lama "120+", halaman depan "160+". Tidak ada satu pun halaman yang mengenumerasi 160 item.

Konsekuensinya untuk target *"mayoritas fitur Tantri ada di 3Diner"*: targetnya bukan 160, tapi ±40 — dan sebagian di antaranya justru **sebaiknya tidak dibangun** (§4).

**2. Cacat pajak lebih buruk dari laporan saya sebelumnya.**
Saya sebelumnya bilang keranjang mencetak `Rp0`. Verifikasi ulang: `OrdersClient.buildReceiptHtml` (baris 116–225) **tidak punya baris pajak sama sekali** — bukan nol, tapi absen. Dan `Orders` hanya menyimpan `total`, tidak ada `subtotal`/`tax_amount`. Jadi datanya memang tidak pernah dipisah.

Tantri menjadikan pemisahan subtotal → service charge → pajak → total sebagai materi pemasaran tersendiri.

**3. AI image-to-3D bukan pembeda terhadap 4D.**
4D punya "4D DishGenerator" (generate model dari foto, 1 kredit). Pembeda 3Diner di sini bukan keberadaan fiturnya, tapi **harganya**.

---

## 1. Model bisnis Tantri — bagian yang paling penting dipahami

| | Angka |
|---|---|
| Aplikasi untuk owner | **Gratis** |
| Biaya sistem | **Rp1.000/transaksi — dibebankan ke pelanggan lewat struk** |
| Alternatif langganan | Rp250.000/bulan atau Rp2.650.000/tahun per outlet |
| Bundling hardware | Rp3,5 juta – Rp12,2 juta |
| Android | `com.tantriapp` v1.91.8, 5.000+ install |

Moat mereka **bukan software**. Paket Rp1.000/struk justru yang dapat promosi berbayar, konten sosmed, artikel SEO, visitasi, grup WA per merchant, dan listing Food Bazaar. Fitur bisa ditiru dalam hitungan bulan; distribusi tidak.

Lantai harga pesaing: **Tantri Rp250k/outlet, 4D ~Rp310k/bulan.** 3Diner Rp50k. Itu aset komersial terkuat 3Diner, dan paling mudah dirusak dengan mengejar paritas fitur.

---

## 2. Di mana keputusan strategi berada

### Tantri punya, 4D nol

POS/kasir · pembayaran tamu + QRIS · **pajak & service charge** · struk & multi-printer · open/close bill · split bill · split payment · void & refund · shift & laci kas & rekonsiliasi · stok opname/PO/supplier · multi-outlet · PIN auth + audit trail

Ini sisi yang **paling mahal dibangun tapi paling sulit ditiru balik**. 4D menolak menyentuh uang secara sadar — supaya bisa menjual satu SKU di 60 negara. Artinya mereka **tidak akan** bergerak ke sini, dan kalau 3Diner membangunnya, keunggulan itu permanen terhadap seluruh kategori "AR menu".

### 4D punya, Tantri nol

Menu 3D/AR · semua AI (Menu Reader, generate details, image-to-3D) · **signup self-serve + trial + wizard** · layar kerja sebagai default konsol · metrik cook time & wait time · call waiter + service calls · Google Review routing + feedback inbox · item complimentary yang dikecualikan dari revenue · analitik perilaku tamu · live table view di atas denah asli · publish live + feature toggles + multi-tema · kuota AI seumur akun

Blok ini **murah** — mayoritas biaya kecil, tidak butuh skema baru.

> **Celah menang termurah yang ada:** keluhan Play Store nomor satu Tantri adalah *tidak bisa daftar sendiri, harus lewat sales, langsung uninstall*. Biaya membangun signup self-serve sedang; efeknya besar.

**Posisi yang belum ditempati siapa pun:** sisi Tantri yang mahal + sisi 4D yang murah.

---

## 3. Aset 3Diner yang tidak boleh hilang saat rebuild

Jujur: dari 5 yang saya sebut sebelumnya, hanya **2** yang benar-benar tidak dimiliki keduanya.

> **KOREKSI 2026-07-27 (dari mining video demo Tantri).** Baris pertama tabel ini semula
> menyatakan resep sebagai unik terhadap Tantri. **Salah.** Video "Live Demo Fitur Inventory"
> memperlihatkan Tantri punya **Resep Produk** dengan gramasi: `Katalog → pilih produk →
> Resep Produk → nyalakan → Tambah Bahan → jumlah` (contoh 200 ml sirup lemon per 1 Fruity Lemon),
> plus integrasi ke kasir lewat `Pengaturan → Outlet → Integrasi Inventory`.
>
> Yang tersisa unik adalah **level varian** — resep yang menempel ke pilihan varian, bukan ke
> produk. Tantri belum terbukti punya itu. Klaim penjualannya harus dipersempit.
>
> Video yang sama juga memperlihatkan **Produksi** (bahan setengah jadi: komposisi + gramasi +
> harga produksi + pengingat stok menipis) — 3Diner **tidak punya** ini sama sekali.

| Aset | Unik vs Tantri | Unik vs 4D | Catatan |
|---|---|---|---|
| ~~Inventory berbasis resep~~ → **resep sampai level VARIAN** (`Menu_Option_Recipes`) | Hanya di level varian | Ya | Tantri punya resep per-produk. Yang unik tinggal resep per-varian |
| **Varian harga-delta yang menembus ke pengurangan stok** | Ya | Ya | **Ini moat teknis yang sesungguhnya**, bukan resepnya |
| Corong pra-transaksi `click_menu → view_3d → click_order` | Ya | Sebagian | Corong bertahapnya unik; klaimnya harus tepat |
| AI image-to-3D | Ya | **Tidak** | Jual sebagai "AR dengan harga warung", bukan "satu-satunya" |
| Struk termal 80mm | **Tidak** | Ya | Paritas, dan sekarang belum benar (tanpa baris pajak) |
| QRIS | **Tidak** | Ya | Unggul mutlak vs 4D, ketinggalan vs Tantri |
| Harga Rp50–150k | Ya | Ya | Aset komersial terkuat |

**Aturan rebuild:** tiap layar baru harus lolos tes — *"apakah `Menu_Option_Recipes`, corong pra-transaksi, kredit AI, dan QRIS masih terjangkau dari sini?"* Kalau tidak, layarnya salah.

---

## 4. Enam belas yang sebaiknya **tidak** dibangun

Mengejar angka 160 adalah mengejar bayangan. Yang ditolak, beserta alasannya:

| # | Ditolak | Alasan inti |
|---|---|---|
| 1 | Absensi selfie + geotagging | Produk HR, bukan POS. Kafe 5–15 orang pakai grup WA |
| 2 | Multi-outlet + distribusi stok antar outlet | Menyisipkan `Outlet` menyentuh RLS + setiap query + setiap laporan. Tunda sampai ada 3 pelanggan membayar untuk cabang kedua |
| 3 | Purchase Order + pemasok + kadaluarsa | Alur perusahaan, bukan alur kafe. Yang menyakitkan adalah **selisih stok** → cukup stok opname + food cost |
| 4 | Laporan laba rugi / arus kas / neraca | Akuntansi, bukan POS. Tantri sendiri hanya menaruhnya di blog, tidak di halaman fitur |
| 5 | Bundling hardware | Modal tertahan di stok, gudang, garansi, RMA. Ganti: daftar hardware teruji + tautan toko pihak ketiga |
| 6 | **Rp1.000/struk dibebankan ke tamu** | Merusak kesan premium yang dijual menu 3D; ulasan Tantri sendiri berisi *"duit pas bayar ditambah terus"*. Dan secara ekonomi kafe 100 struk/hari = Rp3jt/bulan, jauh di atas tier Rp150k — begitu owner sadar, mereka pindah |
| 7 | Saldo prabayar internal | Menyeret ke wilayah uang elektronik dan lisensi BI |
| 8 | Direktori merchant publik | Tantri butuh 2.157 listing agar terasa hidup, dan hanya punya 24 di Lampung. Direktori dengan 8 kafe terbaca sebagai bukti produk sepi. Bangun setelah ~50 merchant aktif satu kota |
| 9 | Jasa SEO/sosmed/visitasi | Jasa manusia, margin negatif di Rp50–150k. Tantri sanggup karena menagih per transaksi |
| 10 | Reservasi berbayar DP + waiting list | DP = sengketa refund. Kafe mid-high Lampung jarang penuh sampai perlu antrean |
| 11 | Save Bill terpisah dari Open Bill | Tantri memisahkannya untuk menambah hitungan fitur. Mekaniknya sama — satu entitas `Bills` menutup keduanya |
| 12 | Refund otomatis lewat gateway | Bangun **void** (sebelum bayar) saja; refund cukup dicatat manual + alasan + penyetuju |
| 13 | Mode offline penuh | Replikasi lokal + resolusi konflik = kelas masalah tersendiri. Yang realistis: **toleran-putus** — cache menu, antre order lokal, kirim saat pulih, status koneksi jujur. Tantri sendiri mengaku tidak punya offline |
| 14 | Multi-currency (tolak), multi-bahasa (tunda) | Lampung bertransaksi rupiah |
| 15 | Integrasi GoFood/GrabFood/ShopeeFood | Tidak dimiliki Tantri maupun 4D. API mitra tertutup untuk POS kecil |
| 16 | Barcode scanner | Fitur retail yang terbawa karena Tantri menjual bundling hardware |

---

## 5. Empat gelombang

### Gelombang 1 — "Layak jual & layak dipakai"
Tanpa perubahan skema besar. Hanya tambah kolom + dua tabel kecil (`Service_Calls`, `Feedback`).

- **Kepatuhan fiskal** — pisahkan subtotal / service charge / PBJT di `Orders`, keranjang tamu, dan struk termal
- **Kokpit operasional gaya 4D** — layar kerja jadi default, kartu dikelompokkan per meja, stempel waktu mulai-masak/selesai, indikator telat
- **Menu Control realtime** — ubah harga/tag/sold-out tanpa buka editor, bulk happy hour, slider skala 3D, QR SVG
- **Suara tamu** — call waiter, service calls, routing Google Review, inbox feedback
- **Analitik penutup celah** — cook/wait time, filter periode (sekarang terkunci 14 hari di `analytics.ts`), per metode bayar, alert stok, food cost dari resep
- **Akuisisi** — signup self-serve + trial, wizard onboarding, plafon kredit AI seumur akun

> **Syarat lulus:** struk mencetak PBJT dengan benar · owner login langsung melihat pesanan berjalan · kafe baru bisa daftar sendiri sampai menu tayang tanpa menghubungi siapa pun.

### Gelombang 2 — "Kasir & siklus tagihan"
Skema baru: `Tables`, `Bills`, `Payments`, `Staff`. Urutan: `Tables` → `Bills` → kasir → `Staff`+PIN → void → split bill/payment.

Setelah gelombang ini 3Diner berhenti jadi "menu digital" dan **jadi sistem pencatat uang.** Ini gelombang paling mahal dan paling menentukan.

> **Syarat lulus:** satu meja bisa dibuka, ditambah pesanan berkali-kali dari QR maupun kasir, dipecah tagihannya, dibayar tunai+QRIS, dan dicetak — semuanya tercatat atas nama staf tertentu.

### Gelombang 3 — "Orang, kendali, uang yang bisa diaudit"
Shift + laci kas + closing + audit trail + voucher + database pelanggan + stok opname + pemisahan konsol operasional/manajemen. Ini yang membuat kafe dengan 5+ karyawan berani percaya.

### Gelombang 4 — "Skala & ekspansi"
Denah lantai, reservasi, multi-outlet, purchasing, multi-printer, toleran-putus, multi-bahasa, loyalty, afiliasi. Bagus, tapi tidak satu pun memblokir penjualan pertama di Lampung.

---

## 6. Peringatan yang bukan tentang fitur

Membangun POS di harga Rp50–150k/bulan memindahkan risiko dari **pengembangan** ke **dukungan**. Begitu 3Diner mencatat uang, setiap gangguan jadi gangguan kas — dan keluhan Tantri yang paling pedas justru soal ini: *"kalau ada gangguan tidak ada tanggung jawabnya"*.

Sebelum gelombang 2 dirilis, anggarkan waktu untuk yang tidak terlihat di peta fitur mana pun: pemulihan data, jejak audit, halaman status, SOP eskalasi. Itu yang menentukan apakah harga murah terbaca sebagai "terjangkau" atau "belum jadi".

---

## 7. Belum diverifikasi

- Angka install Play Store dan ulasan diambil pada 2026-07-27; berubah setiap saat.
- Harga Tantri dari halaman publik; paket bundling hanya lewat form demo.
- Struktur Admin Console 4D sebagian dari riset transkrip video Juni 2026 di `Asset/research/`, belum dikonfirmasi ulang ke produk hidup.
- Belum ada akses ke produk hidup Tantri maupun 4D — keduanya butuh akun/sales.
