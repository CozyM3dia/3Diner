# Serah terima — sapuan visual Konsol v2

**Untuk:** agent sesi berikutnya
**Baca dulu:** `PROJECT.md` di folder yang sama
**Satu pekerjaan:** permukaan visual `/dashboard-v2` dan `/kasir`. Fitur sudah selesai.

---

## 1. Kondisi yang kamu warisi, apa adanya

Pemilik menilai UI-nya **"dari segi artistik jelek banget"**. Itu penilaian yang benar,
dan sebabnya spesifik — bukan selera.

**Saya membangun tujuh rute dari kontrak berangka tanpa pernah membuka lagi gambar
referensinya.** Kontrak itu daftar batasan: maks 3 hue, baris 44px, 5 langkah tipe,
nol zebra. Batasan **mencegah keputusan buruk, tapi tidak menghasilkan keputusan
bagus**. Anggaran bukan desain.

Yang saya terapkan hampir semuanya bersifat larangan — nol zebra, warna selalu
didampingi kata, total ikut filter. Semuanya "jangan", nyaris tidak ada "begini
caranya".

Koreksi berlebihan juga terjadi: masalah awalnya dashboard "AI banget" (ornamen
berlebih, 10 kartu KPI, 7 hue, 8 sistem animasi). Saya buang semuanya dan berhenti di
situ. **Penahanan diri tanpa kerajinan itu cuma polos.** Efferd terlihat mahal bukan
karena sedikit, tapi karena presisi: jarak yang dihitung, tipografi yang memutuskan apa
yang penting, satu aksen yang dipakai sekali. Saya ambil "sedikit"-nya, bukan presisinya.

## 2. Yang SUDAH benar — jangan dibongkar

Struktur diturunkan dari riset dan sudah disetujui pemilik lewat wireframe v3.
Perombakan **permukaan saja**. Kalau kamu ingin mengubah bentuk, itu keputusan produk
dan harus ditanyakan dulu.

Yang harus selamat:

- Tujuh rute datar, tanpa grup. Bukan sidebar bergrup 16 item.
- Baris 44px seragam di semua tabel; teks dipotong, bukan dibungkus.
- Kolom identitas lengket kiri, kolom aksi lengket kanan.
- Total ada di **kaki tabel dan ikut saringan**, bukan kartu melayang di atasnya.
- Aksi baris selalu terlihat — hover-reveal dilarang (perangkat utamanya bersentuhan).
- Tiap keadaan dibawa **kata**, bukan warna saja.
- Kursor Sebelumnya/Berikutnya, bukan offset, bukan scroll tak hingga.
- Angka gagal tampil sebagai **`—` beserta alasannya**, bukan `0`.
- State kosong dinyatakan sebagai **hasil** ("Semua pesanan sudah ditangani"), tanpa
  CTA yang menyuruh bekerja lagi.
- Kalimat penjelas di bawah chart dan di jadwal menu. Chart memberi bentuk; kalimat
  memberi arti.

## 3. Cacat visual yang harus diperbaiki

Daftar ini dari melihat render sendiri, bukan dari teori.

| # | Cacat | Kenapa |
|---|---|---|
| 1 | **Skala tipe tidak ditegakkan** | Kontrak menetapkan 5 langkah (12 / 14 / 14-600 / 20 / 28). Saya pakai ukuran seadanya per komponen, jadi hierarkinya datar dan semua baris terbaca sama penting |
| 2 | **Tidak ada ritme spasi** | Kontrak menetapkan 6 langkah (4/8/12/16/24/32) dan rasio min 3:1 antar kelompok. Sekarang hampir semuanya 12px dan 16px, jadi tidak ada yang terasa terpisah |
| 3 | **Aksen oranye jadi warna tombol** | Dipakai di tiap baris, jadi tidak ada yang menonjol. Kontrak: aksi primer **satu** per layar, plus satu sorotan |
| 4 | **Panel tanpa subjudul** | Sudah dipasang di rute Laporan saja. Efferd memberi tiap panel judul **dan** satu baris penjelas cakupan — itu yang membuat angkanya bisa dipercaya tanpa tooltip |
| 5 | **KPI belum jadi pita bergaris** | Efferd memisahkan KPI dengan rule vertikal tipis, bukan empat kartu berbingkai. Hasilnya terbaca sebagai satu pita, bukan objek yang saling berebut |
| 6 | **Nol perlakuan fokus, hover, transisi** | Terasa mati saat disentuh. Kontrak mengizinkan maks 3 token durasi dan 1 easing — belum ada satu pun |
| 7 | **Baris tabel tanpa napas** | Tinggi 44px benar, tapi deretan abu seragam dari atas ke bawah tanpa pembeda apa pun |
| 8 | **State kosong tanpa bobot** | Kalimatnya benar, tapi tipografi dan ruangnya membuatnya terlihat seperti kesalahan |

## 4. Referensi — buka gambarnya, jangan baca ringkasannya

**Ini kesalahan yang saya buat. Jangan diulang.**

```
Asset/referensi/needmcp/     24 render wireframe, beberapa POS restoran
Asset/referensi/21st/         5 gambar, termasuk efferd-dashboard-2.png
Asset/referensi/tantri/      31 tangkapan POS Indonesia
Asset/                       231 gambar kompetitor + 190 frame video
```

Bacaan yang sudah ada di `docs/audit/2026-07-27-referensi-visual.md` — **empat render
sudah dibaca visual**, dan ini yang diambil:

**Dari Efferd** (`Asset/referensi/21st/efferd-dashboard-2.png`):
- Nyaris monokrom, **satu** aksen, dipakai cuma untuk arah delta
- Baris KPI pakai **garis pemisah, bukan kartu** → terbaca sebagai satu pita
- Chart monokrom, bukan seri berwarna-warni
- Hierarki dari **ukuran + bobot + nilai terang**, bukan hue
- Tiap panel punya judul **dan** satu baris penjelas
- All-clear state **menempati panel**, tidak disembunyikan

Yang **tidak** diambil dari Efferd: struktur halamannya, komposisi kartunya, gridnya.
Kegagalan dashboard lama bukan karena craft Efferd jelek — craft-nya bagus. Kegagalannya
menyalin **strukturnya** (papan pelaporan) untuk pekerjaan yang butuh **layar kerja**.

**Jebakan yang terlihat di render lain** — bukti bahwa pasal kontrak menjawab kegagalan
nyata, bukan kekhawatiran teoretis:

| Terlihat di | Jebakan |
|---|---|
| `order-history-table.webp` | Pil ringkasan melayang, **tidak ikut filter tab** — dua angka berbeda di satu layar |
| `dashboard-sidebar-overview.webp` | Empat KPI dengan delta **identik semua** (`+0,94`), status `Pending`, semua kolom sortable |
| `sales-analytics-view.webp` | Badge `Optimal` tanpa ambang; donut 4 hue yang maknanya hilang saat dicetak hitam-putih |
| `ordering-dashboard.webp` | Shift di dalam baris identitas (`Cashier • 1st Shift`) — mekanisme yang diambil |

**Aturan yang tetap berlaku:** satu referensi maksimal menyumbang **satu** keputusan,
dan tiap keputusan layout butuh **≥2 referensi produk berbeda**. Referensi dipakai untuk
**mekanisme**, tidak pernah untuk komposisi.

## 5. Kenapa ini murah — dan cara menjaganya tetap murah

Diukur, bukan diperkirakan:

| | |
|---|---|
| Aturan gaya terpusat di `globals.css` | **158** |
| Style inline di komponen | **10** (lebar skeleton) |
| Kelas Tailwind tersebar | **3** |
| Logika murni tanpa satu pun CSS | **1.097 baris** |

**Perombakan permukaan = menulis ulang satu blok CSS.** Nol sentuhan ke logika, nol
risiko ke fitur, dan 419 test tetap jadi jaringnya.

Untuk menjaganya:
- Semua gaya baru masuk `globals.css` dengan prefiks `.dv2-` / `.kasir-`
- Nol Tailwind tersebar, nol style inline baru
- Nama kelas mengikuti **isi**, bukan penampilan (`.dv2-col-impact`, bukan `.dv2-col-abu-kanan`)

**Peringatan dari kesalahan nyata:** `.dv2-bar` pernah dipakai dua kali — bilah header
shell dan batang chart. Aturan header (padding 10px 16px, min-height 44px) ikut menempel
ke tiap batang, dan grafik 30 hari mendorong halaman 255px lebih lebar dari layar.
**Cek tabrakan nama sebelum menambah kelas.**

## 6. Cara memverifikasi

Dev server: `.claude/launch.json` → nama **`3diner-dashboard-ux`**, port **3001**,
menunjuk ke `C:\Kerja\3Diner\.worktrees\dashboard-ux\App`.

**Login butuh manusia.** Agent tidak boleh mengisi password. Minta pemilik login sekali
di `http://localhost:3001/login`; sesinya bertahan di profil browser. Tanpa itu semua
rute hanya mengalihkan ke `/login` dan verifikasi visual mustahil.

Rute yang perlu dilihat:
```
/dashboard-v2                    Beranda      antrean + 3 angka
/dashboard-v2/pesanan            Pesanan      tabel + tab + kaki ikut filter
/dashboard-v2/menu               Menu         seleksi massal + toggle
/dashboard-v2/menu/[id]          Editor       5 tab
/dashboard-v2/stok               Stok         urutan mendesak + 2 dialog
/dashboard-v2/promo              Promo        3 jenis satu daftar
/dashboard-v2/laporan?mode=…     Laporan      4 mode, chart monokrom
/dashboard-v2/pengaturan         Pengaturan   perlu dilengkapi + bagian
/dashboard-v2/pengaturan/pajak   Pajak        formulir + pratinjau
/kasir                           Kasir        antrean + lapis 2 + struk
```

Gate sebelum commit:
```bash
npx tsc --noEmit && npx vitest run && npm run build
```

Pemeriksaan yang menangkap cacat nyata di sesi ini — jalankan lewat `javascript_tool`
di tiap rute:
```js
document.documentElement.scrollWidth > document.documentElement.clientWidth  // harus false
[...new Set([...document.querySelectorAll('.dv2-row')].map(r => Math.round(r.getBoundingClientRect().height)))]  // harus [44]
document.querySelectorAll('h1').length  // harus 1
```

## 7. Yang JANGAN dilakukan

- **Jangan sentuh `/dashboard` lama.** Ia memegang fitur yang belum pindah dan jadi
  pembanding cutover.
- **Jangan ubah `src/lib/dashboard-v2-*.ts`** untuk pekerjaan visual. Kalau perlu, itu
  sinyal perubahannya bukan permukaan.
- **Jangan jalankan migrasi** tanpa persetujuan eksplisit pemilik.
- **Jangan klik aksi yang menulis ke data produksi** saat memverifikasi. `advance_order_status`
  tidak bisa mundur. Pola aman: bikin kafe `ZZTEST` sendiri lewat service role, uji di
  situ, hapus di `finally`. Contoh lengkap ada di riwayat sesi ini.
- **Jangan mengarang angka yang tidak ada datanya.** Empat kali sudah terjadi — lihat
  `PROJECT.md` §6.

## 8. Saran urutan kerja

1. Minta pemilik login, lalu **buka ketujuh rute dan lihat semuanya** sebelum menyentuh
   satu baris CSS. Merancang tujuh layar sekaligus menghasilkan koherensi yang lebih baik
   daripada satu per satu.
2. Buka `efferd-dashboard-2.png` dan 3–4 render needmcp **di sebelah**, biarkan terbuka
   selama bekerja.
3. Tetapkan token dulu: skala tipe 5 langkah, skala jarak 6 langkah, 3 hue, 3 token
   durasi + 1 easing. Tulis sebagai custom properties di `globals.css`.
4. Terapkan ke shell dan satu rute (**Pesanan** paling representatif — tabel, tab, kaki,
   lapis 2). Tunjukkan ke pemilik, dua tab bersebelahan.
5. Setelah bentuknya disetujui, sapu enam rute sisanya + `/kasir`.
6. Terakhir: fokus, hover, transisi, `prefers-reduced-motion`.

Checklist review 33 baris ada di `docs/audit/KONTRAK-WIREFRAME.md` §6. Satu "ya" saja =
GAGAL. Jalankan sebelum menyerahkan.
