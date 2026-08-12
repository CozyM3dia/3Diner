# 3Diner — Video Promosi (Remotion)

Video promosi 52,4 detik untuk 3Diner, 1920×1080 @ 30fps, bahasa Indonesia,
target pemilik kafe.

Arahnya bernama **"Coret Alasannya"**: enam keberatan yang benar-benar ada di
kepala pemilik kafe muncul sebagai chip, lalu dicoret satu per satu dengan bukti
dari produk asli. Harga terbaca di detik 6, bukan di detik 38 — itu inti
argumennya, karena pembunuh balasan WhatsApp nomor satu adalah "pasti mahal".

Semua aset visual diambil dari produk asli: screenshot dari
`https://3diner.vercel.app`, model 3D `.glb` dari Supabase Storage, logo dari
`C:\Kerja\3Diner\brand`, dan QR yang benar-benar bisa dipindai ke menu
`senja-kopi`.

## Render

```bash
npx remotion render Promo3Diner out/3diner-promo-v2.mp4 --codec=h264 --crf=18 --port=3579
```

`--port=3579` dipakai karena port 3000 sering ditempati dev server Next.js dari
`App/`. Kalau port itu bentrok juga, ganti angkanya.

Preview interaktif:

```bash
npx remotion studio --no-open --port=3579
```

Satu frame saja, untuk cek layout cepat:

```bash
npx remotion still Promo3Diner out/cek.png --frame=540 --scale=0.4 --port=3579
```

## Struktur

| File | Isi |
| --- | --- |
| `src/music.ts` | Properti terukur soundtrack + helper grid bar |
| `src/timeline.ts` | Tabel scene, dinyatakan dalam **bar** bukan detik |
| `src/theme.ts` | Warna, font, easing, skala tipografi |
| `src/Promo.tsx` | Urutan scene + lockup + rail progres |
| `src/Soundtrack.tsx` | Kurva volume musik + 14 cue SFX |
| `src/components/CoretanScene.tsx` | Kerangka yang dipakai enam beat keberatan |
| `src/components/Objection.tsx` | Chip, coretan, DigitRoll, kartu menu cetak |
| `src/scenes/` | Satu file per scene |
| `scripts/` | Pipeline aset (screenshot, model, logo, QR, audio) |

### Kenapa timeline-nya dalam bar

Soundtrack-nya **105,25 BPM**, bukan 120. Satu bar = 2,2803 detik = 68,41 frame.
Potongan di detik bulat — cara versi 1 disusun — akan meleset dari ketukan.

`src/timeline.ts` menyatakan tiap scene dalam hitungan bar, lalu `layout()` di
`src/music.ts` menghitung frame-nya. Batas scene karena itu **secara struktural
mustahil** jatuh di luar downbeat. Enam beat keberatan masing-masing dapat 2 bar
yang sama persis; kadensi rata itu tulang punggung filmnya.

Total 23 bar. Dua bar pertama adalah title card, lalu harga masuk sebagai
keputusan awal sebelum dua bar pra-hook makanan. Dengan begitu angka sudah
terbaca sekitar detik keenam; versi sebelumnya menaruh harga menjelang akhir
sehingga argumen "pasti mahal" datang terlambat.

Kalau ganti musik: jalankan `scripts/analyse-music.mjs`, perbarui `TRACK` di
`src/music.ts`, selesai. Semua scene ikut menyesuaikan.

## Aset

Semua perintah dijalankan dari folder `promo/`.

```bash
node scripts/prepare-assets.mjs
```

Mengunduh foto menu asli, menyalin logo (sekaligus membuang plat putih di
belakang mark dan menambahkan `viewBox` supaya bisa diskalakan), dan membuat
`public/qr-menu.svg` yang mengarah ke menu kafe.

```bash
node scripts/capture.mjs
```

Screenshot alur pelanggan dari produksi, ukuran iPhone. Tidak pernah membuat
pesanan.

```bash
node scripts/capture-dashboard.mjs
```

Screenshot dashboard pemilik. Membuka jendela browser dan **menunggu kamu login
sendiri**; script tidak membaca atau menyimpan password.

Model 3D ada di `public/models/`. Untuk mengganti hidangan, unduh `.glb` baru ke
sana dan pakai namanya lewat prop `dish` di `<Dish3D />`.

## Musik & SFX

```bash
node scripts/fetch-audio.mjs
```

Sumber: **Mixkit**. Lisensinya mengizinkan pemakaian komersial tanpa atribusi
dan tanpa akun, dan file penuhnya bisa diunduh langsung. Pixabay membalas 403
untuk akses otomatis; Freesound hanya menyediakan preview kualitas rendah tanpa
login — keduanya tidak dipakai.

- Musik: **"Close Up" — Michael Ramir C.** (Mixkit #1167), 1:35
- 15 SFX `.wav` penuh, bukan preview

Tiap SFX dinormalisasi ke −24 dB RMS dengan plafon puncak −1 dB, jadi angka
`volume` di `Soundtrack.tsx` berarti sesuatu dan bisa dibandingkan antar cue.

> Jangan pipe output script ini ke `head`: stdout yang tertutup di tengah jalan
> memotong penulisan file dan menghasilkan WAV 0 byte.

Track ini underscore yang rata — tidak punya drop bawaan. Seluruh dinamika
film datang dari `MUSIC_CURVE` di `Soundtrack.tsx` plus cue SFX, bukan dari
lagunya. Kalau ganti lagu, kurva itu yang perlu ditulis ulang.

### Kenapa bukan audio sintesis

Versi sebelumnya memakai musik dan SFX yang disintesis dari nol
(`scripts/make-audio.mjs`, masih ada sebagai cadangan offline). Hasilnya
terdengar sintesis. Track berlisensi menaikkan kelasnya lebih jauh daripada
revisi motion apa pun.

## Aturan yang lahir dari audit

Sebelum dipakai, 22 frame hasil render diaudit lewat lima lensa (keterbacaan,
brand, bahasa, kejujuran klaim, ritme). Yang berikut ini **bukan preferensi** —
melanggarnya mengulang cacat yang sudah pernah terjadi:

- **Setiap panel yang memuat angka contoh wajib memuat label "Data contoh" di
  frame yang sama, dan labelnya harus terbaca.** Label lama berukuran 17px lalu
  panelnya diperkecil 0,60 — tinggi efektifnya cuma ~10px. Sekarang 46px di
  sumber. Kalau skala panel diubah, hitung ulang.
- **Jangan pakai klaim "ukuran asli" untuk AR.** `App/src/components/viewer/ARSession.tsx`
  menormalisasi tiap model ke 0,35 m pada sisi terpanjang, mengalikannya dengan
  `modelScale` yang diatur pemilik, dan tamu masih bisa pinch-zoom. Badge-nya
  sekarang "PORSI DI ATAS MEJA".
- **Harga apa pun yang muncul harus cocok dengan menu produksi.** Panel "Atur
  menu" sempat menulis Steak Rp95.000 sementara screenshot HP di sebelahnya
  menampilkan Rp38.000. Harga asli: Steak Rp38.000, Pasta Meatball Rp50.000,
  Es Kopi Susu Rp22.000, Butter Croissant Rp25.000.
- **Harga tidak dihitung naik.** `DigitRoll` default `count={false}`: counter
  sempat menampilkan "Rp14.053" di tengah animasi — harga palsu di layar.
- **Teks keberatan hidup di satu tempat**, `src/objections.ts`. Tiap keberatan
  tampil tiga kali; menuliskannya per scene membuat ejaannya menyimpang.
- **Semua chip beat keberatan mulai di Y yang sama** (`TEXT_TOP` di
  `CoretanScene.tsx`). Memusatkan blok teks secara vertikal membuat jangkarnya
  bergeser ~50px antara beat yang punya subline dan yang tidak — terlihat saat
  potongan.
- **Rail progres dirender di atas grade**, warna flat `#FD5002`, tinggi terkunci
  4px. Versi gradien plus vignette membuat tidak ada satu piksel pun yang benar-benar
  mencapai oranye brand.
- **Pil label sistem maksimal 175px dari tepi.** Pil "MODE AR" sempat sampai
  1828px pada frame 1920.
- **Penulisan rupiah rapat tanpa spasi** (`Rp50.000`) dan periode selalu
  "per bulan", tidak pernah "/bulan".

Audit yang sama juga menolak 10 temuan setelah diverifikasi ulang — misalnya
klaim bahwa tebal coretan berubah-ubah 10–22px, yang ternyata mengukur bounding
box garis miring, bukan stroke-nya (konsisten 3–5px).

## Catatan

- Angka pada scene dashboard adalah **data contoh** dan diberi label demikian di
  layar. Label itu ada di chrome `DashboardWindow` dan tidak boleh terpotong —
  jangan geser panelnya keluar frame.
- Model 3D dirender lewat `@remotion/three`. `<ThreeCanvas>` sengaja baru
  di-mount setelah GLB selesai dimuat, dan ukurannya dibulatkan ke integer
  (ThreeCanvas menolak pecahan, sementara `size` biasanya hasil `interpolate`).
- Logo mark punya dua sisi berwarna navy, jadi di latar navy ia dipasang di atas
  kotak putih (`src/components/LogoMark.tsx`).
- Headline multi-baris memakai `\n` eksplisit, bukan pembungkusan otomatis —
  wrap otomatis sempat memutus "3D-nya." di tengah tanda hubung.
