# 3Diner Customer Checkout Design

## Direction

The customer checkout is a calm, mobile-first table-order flow. It should feel like the final page of a well-made cafe menu: warm while editing, precise at commitment, and quiet after submission. The interface uses familiar controls and explicit consequences rather than decorative checkout theatre.

## Workflow

1. **Pesananmu** — edit items, quantities, table, and notes in one continuous page.
2. **Konfirmasi & bayar** — lock the order summary, show the canonical server quote and its tax/service breakdown, choose QRIS or cashier with native radios, and commit with a channel-specific action.
3. **Payment/status route** — preserve token navigation and show the selected payment action immediately. Loading, transient error, missing, active, completed, and cancelled states are distinct.

Do not render a three-step progress rail. Completion lives on the order route, not inside checkout.

## Visual System

- Canvas: `#F6F4EF` paper; grouped surfaces: `#FFFDF8`; primary text: `#082B52`; muted text: `#52677D`; borders: `#D8DFE6`.
- Accent: use orange for selection and emphasis. Filled primary actions use navy text on warm orange or a darker AA-compliant orange with white.
- Typography: Poppins. Page title 24/30, section title 18/24, body 14/21, metadata 12/18. No essential 10px copy.
- Spacing scale: 4, 8, 12, 16, 24, 32. Mobile gutter 16px; content max-width 560px.
- Radii: 12px controls, 16px single confirmation surface. Avoid stacking many elevated cards.
- Elevation: only the confirmation/payment surface and sticky commit bar may use subtle elevation.
- Controls: 44px minimum target; quantity controls are not cramped; native radios preserve arrow-key behavior.
- Motion: 120–180ms opacity or 4px translation only. Disable under reduced motion.

## Component Rules

- One page heading, one primary action, and one authoritative total per stage.
- Item editing uses flat rows and dividers. Variants and item notes remain visible.
- The commit bar always repeats table, canonical total, and the selected consequence.
- QRIS copy says “QRIS” and the final button says “Kirim & tampilkan QRIS”. Cashier copy says “Bayar di kasir” and “Kirim & tampilkan kode kasir”.
- Inline errors use `role="alert"`; stage headings receive focus after transitions; the first invalid field receives focus on validation failure.
- Offline and stock failures preserve cart, table, notes, payment choice, and stage.

## Responsive Contract

- At 375px, item rows use `64px minmax(0, 1fr)` and move quantity controls below details when needed.
- No horizontal scrolling at 375px or 430px.
- Sticky bars respect safe-area insets and never cover the last form content.
- Desktop retains the same reading order in a centered column; it does not become a dashboard grid.

## Anti-patterns

- No ornamental gradients, sheen animations, decorative progress rail, urgency pulse, generic card soup, repeated summaries, ambiguous “Kirim pesanan” copy, or orange buttons with failing white-text contrast.

---

# Owner Console Design (dashboard-v2)

Ditulis ulang **2 Sep 2026** (rebuild "editorial ledger"). Versi 26 Agu — ruang kerja gelap dengan token `--dash-*` — sudah tidak berlaku; kanvasnya terang dan tokennya `--dv3-*` di `src/app/console.css`. Rujukan brand: `brand/UI_TOKENS.md`.

## Direction

Konsol owner dibaca seperti halaman data koran keuangan yang tertata. Ia menjawab dua pertanyaan dalam hitungan detik: **berapa uang masuk periode ini dibanding periode sebelumnya**, dan **apa yang butuh disentuh sekarang**. Hierarki lahir dari skala tipe, berat, angka tabular, dan garis rambut — bukan dari kotak kartu. Kartu nyaris tidak dipakai; kepadatan datang dari tipografi dan ritme spasi.

Kalimat adegannya: owner membuka laptop jam 9 pagi di meja dekat jendela kafe yang terang, lalu mengecek lagi dari ponsel jam 23.30 saat tutup kasir. Karena itu **terang adalah kanvas utama** dan mode gelap dirancang tersendiri, bukan hasil membalik warna.

## Token Contract (`src/app/console.css`)

- Warna ditulis **OKLCH**. Netral ditint ke hue navy merek (258) dengan chroma 0.002–0.022 — tidak ada abu mati.
- **Dua nada oranye, bukan satu.** `--dv3-accent` (terang) hanya untuk marka data, indikator, dan cincin fokus. `--dv3-accent-ink` (dalam) untuk teks kecil dan tombol terisi, karena oranye terang gagal 4.5:1 baik melawan kertas maupun melawan putih.
- Aksen dijaga di bawah 10% permukaan: aksi utama, seleksi aktif, satu marka data. Selebihnya netral.
- Mode gelap mengambil kedalaman dari lightness permukaan, bukan bayangan. Teks terang dikompensasi lewat letter-spacing + line-height (Instrument Sans mulai di wght 400, jadi menurunkan berat bukan pilihan).
- Blok alias menuntun `--dp-*` warisan ke token `--dv3-*`, sehingga 11 halaman lama ikut berganti palet tanpa disentuh satu per satu.
- **Tipografi: Instrument Sans** untuk konsol; Poppins tetap memegang permukaan pelanggan. Alasannya terukur, bukan selera: figur tabular Instrument Sans terbukti membuat `111111` dan `000000` sama lebar (144px pada 40px), sedangkan proporsional meleset 92px vs 165px — kolom uang tak akan pernah sejajar tanpa itu. Kontinuitas merek di konsol dipikul warna dan navy, bukan huruf.

## Dua lembar analitik (2 Sep 2026)

Analitik dipecah menjadi dua halaman dari satu laporan, keduanya membaca rentang `?from&to` yang sama dan berbagi kepala (`AnalyticsHeader`: kicker sans kecil dengan tracking, judul berupa pertanyaan, tab garis-bawah, pemilih rentang, catatan pembanding). Menukar tab membawa rentangnya ikut — dua lembar tidak pernah membicarakan periode yang berbeda.

| Lembar | Rute | Pertanyaan yang dijawab | Isi |
|---|---|---|---|
| **Ringkasan** | `/dashboard-v2` | Bagaimana kafe berjalan, dan apa yang perlu disentuh sekarang? | Pendapatan lunas + sparkline kumulatif · strip (pesanan, nilai rata-rata, tamu buka menu, konversi) · **Jam ramai** (matriks hari×jam) · Butuh perhatian · **Corong tamu** (QR → 3D → mulai pesan → masuk → lunas) · Paling dilirik · Pesanan berjalan |
| **Penjualan** | `/dashboard-v2/penjualan` | Dari mana uang datang, kapan, lewat apa? | Pendapatan lunas + sub-ledger (lunas, rata-rata, item, belum lunas, batal) · **Pendapatan harian** (batang + garis pembanding) · **Laju periode** (kumulatif vs pembanding) · Metode pembayaran · Terlaris · Kategori · Status pesanan · Transaksi terbaru + **Unduh CSV** yang sungguhan |

Empat bentuk grafik, masing-masing untuk satu pertanyaan — jangan tambah bentuk kelima tanpa pertanyaan baru:

| Bentuk | Pertanyaan | Komponen |
|---|---|---|
| Batang harian dengan penanda pembanding (bullet) | Berapa per hari, dibanding hari yang sama periode lalu? | `RevenueChart` |
| Garis kumulatif (satu-satunya garis yang sah: kumulatif memang kontinu) | Sampai hari ini, di depan atau di belakang laju periode lalu? | `CumulativeChart`, `Sparkline` |
| Matriks hari-minggu × jam, satu hue navy, puncak beraksen | Kapan kasir dan dapur harus penuh? | `HeatmapJam` (runtuh ke profil 24 jam bila rentang < 7 hari) |
| Batang komposisi bertumpuk + daftar berlabel langsung | Lewat apa / dalam status apa? | `MixBar`, `Funnel` |

**Satu wajah di konsol: Instrument Sans.** Kicker halaman, anotasi grafik ("+Rp 120.000 di depan laju periode lalu"), rasio lanjut di corong, dan label bagian hari (Pagi/Siang/Sore/Malam) memakai sans yang sama — lebih kecil, berat medium, tracking — bukan serif miring. Serif tidak dipakai di konsol.

**Gerak** satu koreografi saja: blok naik 6px + memudar masuk berjeda 55ms (`.dv3-reveal` dengan `--i`), batang tumbuh dari garis dasar, sel matriks memudar per kolom. Tidak ada gerak lain; semuanya mati di `prefers-reduced-motion`.

## Aturan penyajian data

- **Batang, bukan garis, untuk deret harian.** Garis menarik ruas antara dua hari yang tak pernah berhubungan, sehingga jeda kosong terbaca sebagai penurunan bertahap. Garis hanya dipakai bila rentang > 31 hari — atau untuk deret **kumulatif**, yang memang kontinu (nilai hari ke-5 memuat hari ke-4). Garis kumulatif periode ini berhenti di hari terakhir yang sudah lewat; hari yang belum tiba diarsir, bukan dikosongkan, supaya tak terbaca sebagai penjualan yang mendatar.
- **Matriks jam × hari-minggu hanya untuk rentang ≥ 7 hari.** Satu Sabtu tidak mewakili "Sabtu"; di bawah seminggu ia runtuh menjadi profil 24 jam. Kolom jam dipangkas ke jam buka efektif (minimal 08–21) supaya matriks tidak dipenuhi kolom malam yang selalu kosong.
- **Corong menyatukan dua sumber** (Analytics_Logs untuk buka menu / lihat 3D / mulai pesan; Orders untuk masuk / lunas) ke satu skala, dan menulis rasio lanjut antar langkah. Kolom pembanding menaruh cacah periode lalu, bukan persen: pada cacah kecil persentase lebih dramatis daripada kenyataannya. Delta `this_week/last_week` bawaan RPC tidak dipakai — ia terpaku 7 hari dan tidak mengikuti rentang; RPC dipanggil dua kali (rentang terpilih + pembanding).
- **Tidak ada donat.** Sudut dan luas adalah atribut preattentive terlemah; panjang di atas garis dasar bersama yang terkuat (NN/g). Perbandingan bagian-terhadap-keseluruhan disajikan sebagai batang horizontal berperingkat.
- **Peringkat memakai uang, bukan cacah.** Menu diperingkat oleh kontribusi pendapatan (sepuluh kopi murah tidak mengalahkan dua steak); kategori diukur pendapatan, bukan jumlah item di dalamnya.
- **Delta wajib punya periode pembanding sungguhan** — rentang setara panjangnya, tepat sebelum yang dipilih. Persentase yang ditulis tangan dilarang. Bila pembandingnya nol, tulis "Tanpa pembanding"; jangan mengarang "+100%" atau "∞".
- **Rasio tanpa penyebut ditulis em dash, bukan 0%.** "0% selesai" mengaku ada pesanan yang gagal; kenyataannya belum ada pesanan.
- **Garis dasar grafik adalah informasi**, bukan hiasan: ia memakai `--dv3-ink-4` (≥3:1). Garis panduan di tengah boleh samar.
- Setiap grafik menyertakan tabel `sr-only` berisi angka persisnya.

## Ambang operasional

Kebijakan produk, bukan detail teknis; terkumpul di `AMBANG` pada `src/lib/dashboard-metrics.ts`. Tagihan yang belum lunas lewat 45 menit dan pesanan yang masih di dapur lewat 30 menit naik ke panel **Butuh perhatian**, maksimum 6 baris, terurut paling genting dulu. Satu pesanan hanya boleh muncul sekali.

## Primitives (`src/components/dashboard-v2/primitives.tsx`)

| Primitive | Catatan perilaku |
|---|---|
| `Tabs` | label ber-counter gaya template `(48)`; counter hanya untuk angka yang bisa mencapai nol |
| `StatusPill` | pill badge (Active/Expired-style); warna lewat CSS var `--pill`, tone dari token |
| `SlideOver` | panel detail kanan; Escape/scrim/tombol tutup + focus trap via Radix |
| `EmptyState` | judul + penjelasan + satu CTA nyata; tanpa handler = tanpa tombol (bukan tombol mati) |
| `Field` | input + label terikat `htmlFor`; error `role="alert"` + `aria-invalid`; hint hanya saat valid |

Setiap kontrol wajib punya behavior nyata — anti-pola template Dream POS (link mati, filter dekoratif, pagination kosong) dilarang menular. State loading (skeleton `RouteSkeleton`), empty, error inline, disabled beralasan adalah syarat keluar tiap layar.

## Auth & Error Semantics

`StaffContext.error: true` membedakan *gagal memuat* dari *bukan staf*. Layar masuk menampilkan tiga pesan berbeda (salah kredensial / bukan staf / nonaktif / gagal periksa → coba lagi) dan tidak me-signOut saat pemeriksaan gagal. Fokus: outline oranye 2px offset 2px — terukur 3,38:1 di kanvas terang dan 6,79:1 di kanvas gelap, lolos WCAG 1.4.11 di keduanya.

Saat kueri Dashboard gagal, layar sengaja **tidak menampilkan angka apa pun**. Angka yang salah pada konsol uang lebih berbahaya daripada layar yang mengaku gagal.

## Harness visual (`/dev-preview`)

Keadaan langka — kafe yang baru dibuka, rentang tanpa satu pun pembayaran lunas, tumpukan tagihan yang menua — nyaris mustahil dipentaskan di database sungguhan tanpa mengotorinya, sehingga empty state biasanya baru terlihat ketika seorang owner menemuinya lebih dulu di produksi. `/dev-preview` menjalankan `DashboardView` (Ringkasan) dan `PenjualanView` yang sama persis dengan fixture dan pemilih skenario (`?view=penjualan&s=ramai|sepi|baru|tertinggal`). Peristiwa tamu datang dari `peristiwaFixture`, bukan RPC.

Gerbangnya: `notFound()` di luar `NODE_ENV=development` (rute ini berada di luar cakupan `proxy.ts`), dan ia tidak pernah menyentuh Supabase — seluruh isinya dari `dashboard-fixtures.ts`.
