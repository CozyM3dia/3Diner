# 4D Smart Menu — Rangkuman Produk (Riset untuk 3Dinner Web Dashboard)

> Sumber: kanal YouTube [@4dsmartmenu](https://www.youtube.com/@4dsmartmenu) — 7 video resmi.
> Disusun dari transkrip auto-caption tiap video (lihat `transcripts/`).
> Tujuan: peta fitur lengkap sebagai acuan membangun 3Dinner Web Dashboard.

---

## Apa itu 4D Smart Menu

Menu restoran digital berbasis QR. Tamu scan QR → buka **smart menu** (web) → lihat dish, lihat model 3D ("4D dish") via AR, pesan langsung ke dapur. Tiga permukaan utama:

1. **Smart Menu** — yang dilihat tamu (publik, dibuka via QR).
2. **Admin Console** — dashboard owner/manajer (operasional + analitik + kontrol menu).
3. **Staff Console** — alat staff/waiter ambil order (laptop/tablet/HP).

Plus alat desain: **Menu Designer** dan **View Designer**.

---

## Daftar Video

| # | Judul | ID | Topik inti |
|---|-------|----|-----------|
| 1 | How the 4D Smart Menu Designer Works (Full Walkthrough) | `QEnsOxQZwWU` | Menu Designer end-to-end |
| 2 | A Complete Tour of the Admin Console | `0ASgkfS4ZZI` | Admin console + analitik |
| 3 | How to Set Up a 4D Dish | `DZ9tPIBSX_U` | Pasang model 3D ke dish |
| 4 | How to Set Up Table View with the View Designer | `WWmDihAtRmo` | Layout meja interaktif |
| 5 | How the Staff Console Works | `3xdlSulcG1o` | Ambil order staff |
| 6 | Build Your Entire Menu in One Click (AI Menu Extractor) | `DC74Sn4Ik1A` | Import menu dari PDF (AI) |
| 7 | How to Set Up Google Reviews | `EKb8dMv0B_c` | Integrasi Google review |

Link video: `https://www.youtube.com/watch?v=<ID>`

---

## 1. Menu Designer (`QEnsOxQZwWU`)

Editor utama smart menu. **Panel kiri = section (urut, harus diselesaikan berurutan), panel kanan = live preview** real-time.

**Section berurutan:**

1. **Personalized**
   - Restaurant name (display name di atas menu).
   - Default experience: default mode (light/dark) + default menu view (list/grid).
   - Currencies & languages: pilih default + bisa tambah multi-currency & multi-language (tamu ganti via ikon). Translasi otomatis.

2. **Smart Menu** (isi katalog) — dua cara:
   - **AI Menu Extractor** — import PDF menu (lihat video 6).
   - **Manual** — tambah kategori (pilih ikon, translasi instan, bisa edit manual) → tambah dish.
   - **Form dish:** gambar (nama dish auto diambil dari nama file gambar), veg/non-veg, harga (wajib); opsional: kalori, prep time (menit), ingredients, deskripsi.
   - Tombol **Generate details** (AI) → auto-isi ingredients + deskripsi + translasi dari nama dish.
   - Toggle **4D dish experience** = langkah awal jadikan dish 3D (lanjutan di video 3). Dish 4D dapat tag "4D".

3. **Theme & Style** — pilih tema (10+ tema, terus ditambah).
4. **Brand color** — ubah warna tema (berlaku di semua tema), tombol reset.
5. **Custom branding** — upload logo + cover sendiri untuk light & dark. Logo gantikan logo "4D smart menu" (kiri atas); cover gantikan video default "golden leaf".
6. **Features** (toggle on/off):
   - **Take order** → ikon cart + tombol "add to order". Off → cart hilang, tombol jadi "view detail".
   - **Collect review** → tombol review + tab Google review (isi Google Place ID). Tanpa Place ID, review masuk ke admin console.
   - **Call waiter** → tombol panggil waiter.
   - **Auto greetings** → sapaan di atas display name.
   - **Advanced layout** → buka View Designer (video 4).
7. **QR & Link** — QR permanen (tak berubah walau menu diedit). Download PNG/SVG, atur resolusi, kustomisasi QR.

**Publish:** tombol **Publish Live** → menu langsung tayang.

---

## 2. Admin Console (`0ASgkfS4ZZI`)

Default buka di **Active Kitchen**.

**Active Kitchen (KDS):**
- Order dikelompokkan per nomor meja.
- Ikon penanda asal order: tanpa ikon = dari smart menu (tamu), ada ikon = dari staff console. Ikon complimentary = item gratis dari staff. Note biru = customer note dari staff.
- Aksi: **Start all** (mulai masak) → **Mark done**. Semua done → hilang dari active, masuk **Live Feed / history**.

**Guest Feedback** — feedback & review dari smart menu (jika Place ID di-set, review ke Google; jika tidak, tampil di sini).

**Management (4 section):**

### Analytics (4 tab, filter: today/weekly/monthly/all-time, export PDF & CSV)
- **Revenue & Sales:** gross revenue, total orders, average order value, items sold, sales timeline, top revenue tables.
- **Kitchen & Staff:** avg cook time (start→done), avg wait time (order→done), staff calls, pending orders, activity heatmap/peak hours, live order status graph.
- **Menu & Dishes:** best seller, most loved, most viewed, jumlah dipesan, top items by volume, top items by revenue.
- **Customers:** total views, total interaction, unique visitors, return rate, device breakdown, interaction type.

### Table View
Lihat & kelola operasi secara imersif. Meja hijau = ada order aktif → klik → start cooking / mark served. Kelola meja idle: reserved / available / VIP. Day/night view, torch effect, tampilkan order delay, matikan idle tables, cek waktu (menit), tag, kontrol opacity peta & meja. Bisa diakses dari staff console juga.

### Menu Control (ubah real-time, tanpa buka Menu Designer)
- **Smart alert** — alert global custom di atas smart menu (pilih warna, update real-time).
- **Multi-menu** — buat menu per waktu (breakfast/lunch/dinner). Tambah offers per waktu/hari, mis. **Happy hour**: action type (discount), besaran diskon, timing, pilih item → save & apply.
- **Custom tags** — tag per dish (new, spicy level, cold, special; bisa diganti jadi gluten/lactose). Juga ubah harga, set % diskon, mark "few left"/"sold out", hide dish. Semua real-time global.

### Staff Manager
- Tambah staff: role icon, full name, unique ID, login username, password, role, tanggal join. = beri akses staff console.
- Edit profile. **Team overview:** total members, active staff, total orders taken, total items served.
- **Preferences:** ubah order notification sound & waiter call sound, tema, dan **lock management section** (fade out, perlu password admin buka) untuk lindungi data dari staff dapur biasa.

---

## 3. 4D Dish Setup (`DZ9tPIBSX_U`)

Setelah toggle "4D dish experience" di Menu Designer → dish muncul di **section 4D Dish** (status awal "no model"). Dua cara pasang model 3D:

1. **Upload manual** — file **GLB** + **USDZ** (mis. hasil export 3D software dengan animasi) → save.
2. **Generate with AI** — generate model dari foto dish (pakai 1 credit). Pilih pakai foto existing, atau upload foto khusus (jika background ada elemen mengganggu). Ada sample image untuk panduan.

Setelah generate: default ukuran 25×25 cm, atur via slider → **Apply to 4D dish**.

**Aturan publish penting:**
- Hanya assign / generate model → otomatis masuk smart menu, **tak perlu publish**.
- **Ubah ukuran** → wajib **Apply to 4D dish** lalu **Publish**.

Tamu lihat via tombol **"view on your dish"** (AR). Zoom: tombol tengah mouse / slider.

---

## 4. View Designer / Table View Setup (`WWmDihAtRmo`)

Buka: Menu Designer → Features → **Open advanced layout** (buka di tab baru).

- Butuh 2 gambar layout restoran: **day layout** + **night layout** (toggle antar keduanya).
- Buat meja: round / square / rectangle. Place, zoom (scroll mid-mouse), pan, atur opacity background & meja, scale.
- **Nomor meja = penting** (jadi table number operasional).
- Tools: right-click duplicate; **mirror** (horizontal) untuk sisi simetris; **select multiple** (drag pilih banyak); **unlock ratio** (scale bebas non-proporsional, bisa lock lagi).
- Setup sekali (one-time). Selesai → **Launch**.
- Hasil dapat diakses dari Admin Console & Staff Console. Bisa di-toggle off jika tak suka.

---

## 5. Staff Console (`3xdlSulcG1o`)

Diakses admin/owner/staff (akun dari Staff Manager). Jalan di laptop, tablet, HP.

- Lihat full menu → ambil order: pilih/ketik nomor meja → pilih item → **Send to kitchen**.
- Akses **Table View** dari sini (lihat operasi, ambil order, mark idle→available, mark served).
- **Complimentary** — tandai item gratis (tak masuk revenue).
- **Note** — staff tambah catatan saat order (tampil di admin console).
- **Assistance** — pilih meja → tombol bantuan → popup; muncul di table view admin. Panggilan waiter dari tamu masuk ke **service calls**.
- **Settings:** tema light/dark, sound on/off, display currency, logout.

---

## 6. AI Menu Extractor (`DC74Sn4Ik1A`)

Bangun seluruh menu dari PDF, satu klik.

- Punya PDF menu → import. Tak punya → ada **sample PDF template** (isi, export PDF, lalu import).
- Saat import beri 2 info: **menu language** + **currency**.
- Klik **Extract** → AI tarik semua detail (kategori + dish + detail). 
- Pilih **add selected to menu** (bisa uncheck kategori yang tak mau, mis. hindari duplikat).
- Detail (harga, dll) auto-terisi dari PDF. **Gambar dish tetap dipilih manual.**
- Selesai → **Publish Live**.

---

## 7. Google Reviews (`EKb8dMv0B_c`)

- Menu Designer → Features → pastikan **Collect review** ON (kalau off, tab Google review tak muncul).
- Isi **Google Place ID** (cari via place ID finder, mis. cari nama tempat → klik → copy Place ID → paste).
- **Publish Live**. Tamu klik "tap to review" → langsung buka halaman Google review.

---

## Implikasi untuk 3Dinner Web Dashboard

Entitas & modul inti yang perlu dimodelkan:

- **Surfaces:** Smart Menu (publik), Admin Console, Staff Console, Menu Designer, View Designer.
- **Data model:** Restaurant/brand settings, Category, Dish (gambar, veg flag, harga, kalori, prep time, ingredients, desc, translasi, tags, 4D flag, GLB/USDZ/AI-model), Table (nomor, posisi, shape, status), Order (item, meja, asal staff/guest, complimentary flag, note, status lifecycle: new→cooking→done), Staff (role, kredensial), Multi-menu/Offers (waktu/hari, diskon).
- **Real-time:** KDS active kitchen, table view status, menu control changes (alert/tags/harga/stock) global instan.
- **AI hooks:** generate dish details (text), AI menu extractor (PDF→menu), AI 3D model generator (foto→GLB, sistem credit).
- **3D/AR:** GLB + USDZ, ukuran cm, slider scale, view-in-AR.
- **Analytics:** revenue/sales, kitchen/staff timing, menu/dishes, customers; filter periode; export PDF/CSV.
- **Integrasi:** Google Place ID (review), QR permanen (PNG/SVG), i18n + multi-currency.
- **Lifecycle penting:** aturan publish (assign/generate model = no publish; ubah ukuran = wajib publish).

---

*Transkrip mentah tiap video tersimpan di `transcripts/<videoID>.txt`.*
