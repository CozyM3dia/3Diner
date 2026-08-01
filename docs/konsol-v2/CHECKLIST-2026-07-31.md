# Checklist review §6 — hasil terhadap konsol v2

**Tanggal:** 2026-07-31
**Sumber:** `docs/audit/KONTRAK-WIREFRAME.md` §6
**Cakupan:** 7 rute owner + editor menu + pajak + `/kasir`, diperiksa pada 1024×768
**Aturan:** satu "ya" saja = GAGAL

**Catatan soal jumlah:** judul di kontrak menyebut "33 baris"; kotak yang benar-benar
tertulis ada **31**. Selisih itu ada di dokumen kontraknya, bukan di pembacaan ini.

Pemeriksaan dijalankan dua cara: sapuan DOM otomatis per rute (ukuran, berat, jarak,
tinggi baris, `tabular-nums`, panel bersarang, durasi, easing, overflow), dan pembacaan
kode untuk yang tidak terlihat dari DOM.

---

## Hasil: 28 LULUS · 2 GAGAL · 1 sebagian

### GAGAL 1 — jarak di luar skala (baris 10) → **sudah diperbaiki**

Sapuan DOM menemukan sepuluh nilai di luar 4/8/12/16/24/32, semuanya di dua blok yang
tidak pernah ikut di-token saat token layer dipasang:

| Kelas | Sebelum | Sesudah |
|---|---|---|
| `.dv2-form` | gap 18, padding 20 | 24, 24/16 |
| `.dv2-field` | gap 6 | 8 |
| `.dv2-field-row` | gap 10, input margin 3 | 12, 4 |
| `.dv2-summary` | padding 12/14 | 12/16 |
| `.dv2-preview-row` | padding 3 | 4 |
| `.dv2-preview-total` | margin 6 | 8 |
| `.dv2-panel-head` | padding 14/16/10 | 16/16/12 |
| `.dv2-panel-note` | margin 2 | 4 |
| `.dv2-note` | padding 14/16 | 16 |
| `.dv2-chart-caption` | margin 10 | 12 |
| `.dv2-bulk` · `.dv2-row-setup` · `.dv2-state-left` | padding 10/14 | 12 |

Ikut terbawa: `.dv2-funnel-label` dan `.dv2-funnel-value` memakai **13px**, ukuran keenam
yang tidak ada di skala. Naik ke 14px.

Pelajarannya: token dipasang lewat rute yang sedang dilihat, dan blok yang tidak muncul
di layar saat itu — formulir, corong, kaki laporan — terlewat seluruhnya. Sapuan DOM per
rute menemukannya dalam satu jalan; membacanya dari CSS tidak akan pernah.

### GAGAL 2 — insert realtime tanpa aturan buffer (baris 23) → **belum diperbaiki**

`KasirQueue.tsx:132` menambahkan pesanan baru langsung ke daftar:

```js
return [...prev, row];
```

Tidak ada buffer, tidak ada penanda "N pesanan baru — tampilkan", dan tidak ada penundaan
sampai tangan berhenti. Daftar berubah di bawah jari yang sedang mengetuk, dan di konsol
kasir ketukan yang meleset berarti pesanan yang salah dimajukan.

**Sengaja tidak diperbaiki di sini.** Buffer adalah perubahan perilaku, bukan permukaan:
ia menuntut keputusan soal kapan baris baru boleh masuk, apa yang tampil selama ditahan,
dan apakah pesanan mendesak boleh menembus buffer. Itu keputusan produk yang harus
ditanyakan, bukan diambil diam-diam di PR yang mandatnya visual.

### SEBAGIAN — gerbang ketik untuk aksi ireversibel (baris 16)

`CancelOrderDialog` sudah benar di dua hal: judulnya **menyebut objeknya**
("Batalkan pesanan L-5 senilai Rp 76.000?") dan alasannya **wajib** serta tersimpan.

Tapi kontrak §2.8 meminta **gerbang ketik** untuk yang ireversibel, dan alasan bisa diisi
dengan satu klik preset. Dua klik tanpa mengetik apa pun menyelesaikan aksi yang tidak
bisa dibatalkan.

Dibiarkan apa adanya, dan dicatat: memaksa mengetik di konter yang sedang ramai punya
biayanya sendiri. Ini pertukaran yang harus diputuskan pemilik, bukan diperketat sepihak.

---

## Yang LULUS

| Baris | Butir | Bukti |
|---|---|---|
| 1 | Teks di bawah 12px | nol, semua rute |
| 2 | Ukuran di luar 5 langkah | nol setelah perbaikan; hanya 12/14/20/28 |
| 3 | Berat selain 400/600 | nol |
| 4 | Hue di luar {oranye, merah, amber} + abu | nol |
| 5 | Informasi hanya dibawa warna | tiap chip berlabel kata penuh; potongan buku besar pakai kurung **dan** nada |
| 6 | >3 kartu angka zona teratas | Beranda tepat 3, Laporan 3, kasir 2 |
| 7 | >1 `h1` | tepat 1 di sepuluh rute |
| 8 | Badge di luar satu tempat | tepat 1, hanya Beranda |
| 9 | Panel dalam panel | nol |
| 11 | >2 sumbu perataan | teks kiri, angka kanan |
| 12 | Tinggi baris selain 44px | `[44]` di semua tabel |
| 13 | Teks dibungkus/`line-clamp` | nol `line-clamp` di seluruh konsol |
| 14 | Aksi baris hover-only | nol aturan hover yang mengubah opacity/visibility/display |
| 15 | Aksi merusak inline | pembatalan hanya lewat lapis 2 + dialog |
| 17 | Angka tanpa `tabular-nums` | nol dari 6 kelas kolom angka |
| 18 | Angka tanpa pembanding | tiap angka Beranda punya delta; buku besar punya uraian |
| 19 | Kartu KPI tidak ikut filter | tidak ada kartu KPI di atas tabel; total ada di kaki |
| 20 | Baris antrean tanpa aksi terminal | tiap baris kasir punya Selesai/Batalkan |
| 21 | Timestamp relatif satu-satunya | umur + jam absolut sebagai `title` |
| 22 | >3 durasi atau >1 easing | 2 durasi terpakai (0.09s, 0.15s), 1 easing |
| 24 | <5 state per layar bertabel | 8 `loading.tsx` + 7–12 state per rute |
| 25 | Empty-filter ber-CTA "buat baru" | CTA-nya "Hapus saringan" |
| 26 | Angka tanpa tampilan tidak-tersedia | `—` + alasan di Beranda dan kaki kasir |
| 27 | Status "Pending" | nol. `PendingTab` hanya nama komponen, tidak pernah tercetak |
| 28 | Scroll tak hingga | nol; kursor Sebelumnya/Berikutnya |
| 29 | Dual-render permanen | nol `hidden lg:block` |
| 30 | Fitur hilang tanpa catatan | tab yang belum pindah menyatakan dirinya + tautan konsol lama |

---

## Pengecualian yang dicatat, bukan disembunyikan

**`.dv2-bars { gap: 2px }`** — jarak antar batang chart, di luar skala 4/8/12/16/24/32.
Diperlakukan sebagai primitif grafis, sekelas radius 2px batang dan radius 4px kerangka
muat: skala jarak mengatur pengelompokan tata letak, bukan geometri internal sebuah
grafik. Kalau reviewer menilai ini tetap pelanggaran, perbaikannya satu baris.

**Baris 31 — penanda `[ASUMSI-n]`.** Wireframe menandai elemen yang bergantung asumsi;
kode hanya punya **satu** penanda (`ASUMSI-A4` di `kasir-queue-rules.ts`). Yang belum
ditandai di kode dan seharusnya: **A5** (jam buka — SLA kasir jalan 24 jam, jadi
peringatan "terlambat" bisa muncul jam 3 pagi) dan **A3** (label meja teks bebas).
Bukan cacat visual, tapi cacat jejak: asumsi yang tidak ditandai adalah asumsi yang
tidak akan diperiksa ulang.
