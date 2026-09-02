# Sistem Desain — Papan Dapur (KDS)

Dokumen ini mengikat keputusan visual papan dapur 3Diner. Ia berlaku untuk
`src/app/kitchen.css` dan `src/components/kitchen/*`, dan **tidak** berlaku
untuk konsol pemilik (`dp.css`, `console.css`) atau aplikasi tamu
(`docs/DESIGN.md`).

Papan dapur adalah saudara kandung konsol pemilik, bukan produk lain. Ia
memakai bahasa visual yang sama — *editorial ledger* (`console.css`): hierarki
lahir dari skala tipe, berat, angka tabular, dan garis rambut, bukan dari kotak
kartu berwarna. Yang berbeda hanya jaraknya: konsol dibaca dari 50 cm oleh
orang yang duduk; papan ini dari 2–3 meter oleh orang yang berdiri memegang
wajan. Jadi skalanya lebih besar, kontrasnya lebih tegas, dan warna dipakai
untuk satu hal saja: memberi tahu seberapa mendesak sebuah tiket.

---

## 1. Konsep: Garis Api

Dapur adalah sistem termal. Pesanan masuk dingin, memanas saat dikerjakan, dan
menghangus kalau ditinggalkan. Seluruh bahasa visual dibangun di atas satu
tulang punggung itu — **suhu sebagai urgensi**.

Ini bukan metafora hiasan. Ia adalah model semantik yang dibuat terlihat,
sehingga seorang juru masak yang mengangkat kepala dari wajan bisa membaca
keadaan seluruh dapur dalam satu sapuan mata, tanpa membaca satu kata pun.

Rujukan yang mendasarinya:

| Sumber | Yang diambil |
|---|---|
| Toast KDS (Dynamic & Grid layout, KDS Appearance pane) | Tiket berukuran dinamis mengikuti jumlah item; ukuran teks sebagai setelan, bukan konstanta |
| Square KDS | Timer merah/kuning/hijau sebagai sinyal urgensi utama; hitungan item sepanjang hari |
| Fresh KDS | Sorotan warna yang dapat dibedakan; mode gelap; keterbacaan modifier |
| BOXS KDS (studi kasus Melody Chong) | Ketuk sekali → hitungan mundur → ketuk lagi untuk batal, alih-alih "urungkan" sesudah tulisan |
| Jorge Cisneros, KDS | Grid bertumpuk untuk memaksimalkan tiket yang terlihat; diuji di kondisi dapur sungguhan |
| VP0, *Restaurant KDS UI Guide* | "Modifier lebih nyaring dari nama item"; target bump seukuran header tiket; hitungan all-day |

### Dua sumbu, bukan satu

Papan sebelumnya memakai satu enum: *Pesanan Baru · Di Dapur · Lewat 30 Menit ·
Siap*. Tiga yang pertama adalah tahap kerja, yang keempat adalah umur. Sebuah
pesanan bisa sekaligus **sedang dimasak** dan **terlambat**, jadi satu enum
memaksa salah satunya hilang — dan yang hilang selalu tahap kerjanya, karena
cabang telat diperiksa lebih dulu.

Sistem ini memisahkannya:

- **Tahap** — `tahan · antre · masak · siap`. Menjawab *apa yang harus saya
  lakukan*. Menentukan tombol.
- **Panas** — `aman · waspada · telat`. Menjawab *seberapa mendesak*.
  Menentukan warna yang terbaca dari jauh.

---

## 2. Tipografi

Satu typeface: **Instrument Sans**, yang sama dengan konsol pemilik. Humanist
grotesk dengan angka tabular sungguhan — dan itulah alasannya dipilih konsol
untuk kolom uang, alasan yang sama berlaku di sini: papan ini menampilkan dua
puluh timer yang berdetak serentak, dan tanpa angka tabular setiap timer
bergeser satu-dua piksel tiap detik sampai seluruh papan terlihat gelisah
padahal tidak ada yang berubah.

Dipasang di akar `.kds`: `font-feature-settings: "cv01"` (mengikuti konsol) dan
`font-variant-numeric: tabular-nums`. Berat yang dipakai hanya 500 dan 600 —
hierarki dibangun dari ukuran dan warna tinta, bukan dari lompatan berat.

**Skala.** Satu pengali, `--kds-skala`, mengendalikan seluruh papan:

| Kerapatan | Pengali | Untuk |
|---|---|---|
| `normal` | `1` | Tablet di meja pass, dibaca sejangkauan tangan |
| `besar` | `1.25` | Monitor dinding, dibaca dari beberapa meter |

Setiap ukuran ditulis `calc(N * var(--kds-skala))`. Mengubah satu angka
menggeser seluruh sistem secara proporsional — bukan menambal ukuran satu per
satu, yang selalu berakhir dengan hierarki yang runtuh di salah satu kerapatan.

Ukuran acuan pada `--kds-skala: 1`:

| Peran | Ukuran | Bobot | Tinta |
|---|---|---|---|
| Timer tiket | 26px | 500 | ink; berubah warna hanya saat waspada/telat |
| Total produksi | 30px | 500 | ink |
| Nama meja | 18px | 600 | ink |
| Nama menu | 15.5px | 500 | ink |
| Jumlah porsi | 16px | 600 | ink-3; nada tahap bila >1 |
| Varian | 12.5px | 500 | ink-3 |
| Baris metadata & eyebrow | 12.5px / 11px kapital | 500 / 600 | ink-3 |
| Pil status | 12px | 600 | nada di atas cuci-nya |
| Label tombol bump | 14px | 600 | btn-ink |

---

## 3. Warna

Semua nilai OKLCH, mengikuti disiplin `console.css`: netral ditint ke hue navy
merek (258) supaya tidak ada abu mati, dan tidak ada hitam murni di mana pun.
Nilai gelap dan terang **bukan cerminan** satu sama lain — kedalaman di mode
gelap datang dari lightness permukaan, bukan bayangan.

### Tahap dan urgensi

Setiap nada punya *cuci* (wash) untuk pil status, seperti `--dv3-ok/-ok-wash`
di konsol. Tinta pil diukur terhadap cucinya sendiri, bukan terhadap kertas.

| Token | Arti |
|---|---|
| `--kds-tahan` | Tertahan di kasir — bukan jam dapur. Netral ink-4. |
| `--kds-antre` | Diterima, belum mulai. Navy seri-2 konsol. |
| `--kds-masak` | Sedang dikerjakan. Oranye merek — satu-satunya aksen. |
| `--kds-siap` | Matang, menunggu diantar. Hijau `ok` konsol. |
| `--kds-waspada` | Lewat 15 menit. Amber `warn` konsol. |
| `--kds-telat` | Lewat 30 menit. Merah `bad` konsol. |

### Aturan pemakaian

- Warna dijaga jauh di bawah 10% permukaan. Yang berwarna hanya: rel 3px,
  timer saat mendesak, titik dan pil status, jumlah porsi saat >1.
- Tombol bump **tidak** berwarna tahap. Satu gaya untuk semua tahap — tinta
  pekat (`--kds-btn`). Warna tahap sudah dibawa rel dan pil; tombol
  berwarna-warni di setiap kartu hanya menaikkan porsi warna sampai tak ada
  yang menonjol lagi.
- Tahap dipilih **sekali** per tiket ke `--nada` / `--nada-wash`, lalu
  diwarisi. Tidak ada elemen yang memilih ulang warnanya sendiri.
- Urgensi (`--panas-nada`) hanya menimpa **rel dan timer**. Kalau merah menelan
  seluruh kartu, papan kehilangan informasi yang menentukan tombol mana yang
  harus ditekan.
- Tiket yang sudah `siap` dibekukan di `aman`. Masakannya sudah keluar;
  menyalakannya merah hanya menambah alarm palsu.
- Timer tiket yang `aman` adalah tinta biasa. Kartu yang tenang harus terlihat
  tenang.

Status tidak pernah dibedakan warna saja (`brand/DESIGN_SYSTEM.md`, Aturan
Aksesibilitas). Setiap chip tahap punya **bentuk** titik sendiri: lingkaran
redup (tahan), lingkaran (antre), kotak (masak), belah ketupat (siap).

---

## 4. Tema

Papan dapur memakai kunci temanya sendiri: `tema-dapur`, dipasang sebagai
`data-kds` di `<html>` — bukan `data-theme` milik konsol.

Dua alasan operasional:

1. `ThemeSync` global menegakkan ulang `data-theme` setelah hidrasi. Apa pun
   yang papan ini setel di sana akan dikembalikan beberapa milidetik kemudian.
2. Tablet di dinding dapur dan laptop pemilik adalah dua perangkat dengan dua
   kebutuhan cahaya. Pemilik yang menyalakan mode terang dari rumah tidak
   seharusnya menyilaukan dapur yang buka sampai tengah malam.

**Gelap adalah bawaan.** Ia dirancang lebih dulu, bukan diturunkan dari tema
terang. Seluruh riset KDS sepakat: gelap memotong silau dapur dan membuat kode
warna urgensi menyala. Terang didukung penuh lewat toggle di bar pass.

Di dalam konsol (`bingkai="konsol"`), `data-kds` dicerminkan dari tema konsol
supaya papan tidak jadi satu-satunya kotak gelap di halaman yang terang.

---

## 5. Tata Letak

- **Grid `auto-fill`**, bukan jumlah kolom tetap:
  `repeat(auto-fill, minmax(calc(300px * var(--kds-skala)), 1fr))`.
  Tablet 10 inci dan monitor 43 inci sama-sama nyata; mengunci tiga kolom
  membuat salah satunya selalu salah.
- **Radius:** `6 · 10 · 999`. Satu deret, tanpa pengecualian.
- **Garis rambut, bukan kotak.** Baris item dipisah 1px `--kds-line`; tidak
  ada kotak di dalam kotak. Jumlah porsi adalah angka tabular telanjang dengan
  tanda `×` redup, bukan lencana.
- **Bar pass dua tingkat.** Atas: identitas dan sistem (jarang berubah).
  Bawah: keadaan pekerjaan (berubah tiap menit). Menumpuk keduanya memaksa mata
  memindai ulang nama kafe setiap kali sebuah tiket berpindah tahap.
- **Rel panas** setinggi kartu di tepi kiri, terisi dari bawah seiring umur.
  Antrean terbaca seperti deretan tabung ukur: mana yang hampir penuh, tanpa
  membaca satu angka pun.

### Anatomi tiket

Urutannya mengikuti urutan baca juru masak yang sedang buru-buru:

```
siapa (meja) → berapa lama (timer) → apa (item)
  → apa yang aneh (varian & catatan) → apa yang saya tekan (satu tombol)
```

Tidak ada yang lain di kartu itu.

**Catatan tidak pernah tenggelam.** Varian ditulis ink-3 di bawah nama menu;
catatan per baris dan catatan pesanan memakai pil/wash amber. Nama menu bisa
ditebak dari konteks, "tanpa gula" tidak bisa, dan piring yang salah hampir
selalu lahir dari modifier yang tidak pernah sampai ke mata juru masak.

---

## 6. Interaksi

**Target tekan seukuran baris.** Tangan bersarung tidak bisa mengenai kotak
centang 20 piksel, jadi tidak ada kotak centang — barisnya sendiri yang
ditekan. Tombol bump minimal 50px × lebar penuh kartu.

**Satu aksi per tiket.** Tidak ada tombol lain yang bersaing dengan bump.

| Tahap | Tombol | Transisi |
|---|---|---|
| `tahan` | *(tidak ada)* | Butuh check-in di Kasir |
| `antre` | Mulai Masak | `received → preparing` |
| `masak` | Tandai Siap | `preparing → ready` |
| `siap` | Serahkan | `ready → completed` |

**Jeda batal untuk aksi terminal.** Ketuk sekali → hitungan mundur 4 detik →
ketuk lagi untuk batal. Pola lazimnya adalah "urungkan" setelah perintah
terkirim, tapi `advance_order_status` tidak punya transisi pulang dari
`completed` — tidak ada yang tersisa untuk diurungkan. Jeda ini memindahkan
kesempatan batal ke **sebelum** penulisan, satu-satunya tempat ia masih nyata.

**Coretan plating bersifat lokal.** Baris yang sudah dicoret disimpan per
perangkat, bukan di database: ini catatan kerja juru masak, bukan status
pesanan, dan dua koki di dua stasiun mengerjakan bagian berbeda dari tiket yang
sama.

---

## 7. Gerak

Tiga gerakan di seluruh papan, masing-masing menjawab satu pertanyaan.

| Gerak | Menjawab | Durasi |
|---|---|---|
| Tiket masuk (fade + naik, bertingkat) | "Apa yang baru?" | 380ms, jeda dipotong di 170ms |
| Rel berdenyut saat telat | "Apa yang mendesak?" | 1.9s, berulang |
| Hitungan mundur pada bump | "Apa yang barusan saya tekan?" | 4s |

Selebihnya diam. Layar yang bergerak tanpa alasan di dapur yang sibuk adalah
layar yang menarik perhatian dari wajan.

`prefers-reduced-motion` dihormati — **kecuali** hitungan mundur batal.
Durasinya adalah jeda amannya, bukan hiasan; memangkasnya jadi 1ms berarti
tidak ada yang sempat membatalkan.

---

## 8. Larangan

Selain aturan anti-slop di `brand/DESIGN_SYSTEM.md`, papan ini melarang:

- Hitam murni — pakai `--kds-paper`. Warna di luar OKLCH bernada 258.
- Gradien dekoratif, orb, blob, glow. Tidak ada satu pun piksel untuk hiasan.
- Font selain Instrument Sans. Kapital bertracking lebar hanya untuk eyebrow.
- Tombol bump berwarna tahap, atau lebih dari satu tombol per kartu.
- Ikon di luar lucide, atau ketebalan garis yang berbeda-beda.
- Teks di bawah 11px pada `--kds-skala: 1`.
- Menyembunyikan tiket tertahan. Pesanan yang macet di kasir harus terlihat
  oleh seseorang.
- Menggabungkan menu yang sama dengan varian berbeda pada pandangan produksi.
  "Kopi tanpa gula" + "Kopi biasa" = "Kopi ×2" menghasilkan satu gelas yang
  salah setiap kali.
- Alarm merah pada tiket yang sudah siap.
- Aksi yang menyentuh kas (pembatalan, penerimaan uang). Itu tetap milik Kasir.
