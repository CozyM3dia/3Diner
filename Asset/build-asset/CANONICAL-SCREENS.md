# Canonical Screens — 3Diner Stitch Project
**Project:** `projects/7296933986229050877` ("3Diner Design")
**URL:** https://stitch.withgoogle.com/projects/7296933986229050877
**Audit:** /impeccable AI-slop pass — 2026-06-20
**Versi:** v2 (in-app ordering + POS flow)

Project punya variant duplikat dari iterasi. Gunakan HANYA screen ID kanonik di bawah. Sisanya hapus di Stitch UI.

---

## Customer App — Screen Kanonik (10 screen, urut flow)

| # | Screen | Canonical ID | Catatan |
|---|--------|--------------|---------|
| 1 | Cafe Home (+ cart FAB) | `0fcdeaed03ba48dca09fab1133764adf` | Floating cart badge ditambah |
| 2 | Dish Detail (qty + Tambah ke Pesanan) | `6a797d1446b4424ca941813685f742c2` | v2 — ganti CTA jadi qty stepper + add-to-cart |
| 3 | 3D Viewer | `33df3f926b064614a192452d781d5fd7` | dark, model floating |
| 4 | AR Mode | `82fb6527b71049229795ae1d97379c3c` | kamera + model di meja |
| 5 | Search Results | `5756fa8c360749e8b52c37a8815ab51c` | harga orange |
| 6 | Empty State | `30ed1123949c438085094dc2b32eee26` | cafe not found |
| 7 | **Keranjang / Ringkasan Pesanan** | `faeb18d9e8e147faa2d970c6ab5893a9` | multi-item cart + input nomor meja |
| 8 | **Pilih Pembayaran** (cash/QRIS) | `fdc643f4ca3347d08f9078695668aeca` | banner "Pesanan Terkirim" + 2 metode |
| 9 | **QRIS Payment** | `137bd61ca23c459d84547ca716b63587` | QR asli + countdown |
| 10 | **Status Pesanan** | `ee8fc4fdd72046d197e28303f9c5617e` | timeline Diterima→Disiapkan→Siap |

**Flow:** 1 → 2 (→3→4 opsional) → +cart → 7 → 8 → (9 QRIS / kasir cash) → 10

---

## Screen Usang (hapus di Stitch UI)

| Screen | ID | Alasan |
|--------|-----|--------|
| Dish Detail v1 | `e8aebc66668c47a1aa170d9467b26bc0` | CTA lama "Pesan Sekarang" redirect (pre-pivot) |
| 3D Viewer v1 | `c29ba4f3b8384ad49f7f18c208b7f70e` | garis stripe + kotak hitam |
| 3D Viewer (Clean dup) | `91dec9b1304347ff898969420e45e9cc` | duplikat |
| Search v1 | `6898b35bd8e54e41b52d8a0e9a789f58` | placeholder Americano |
| Search (Polished dup) | `abe6c5a914324844b286c50aee0b990f` | harga navy (langgar aturan) |

---

## Status Slop (final)

Semua 10 screen kanonik **lolos audit /impeccable**. Tidak ada: gradient text, side-stripe border, hero-metric template, glassmorphism dekoratif, emoji, Inter font, pure black. Harga selalu orange `#F05A22`. Glassmorphism hanya di panel AR/3D (legit, over kamera/3D).

Satu limitasi mockup (bukan slop kode): kotak gelap produk di 3D Viewer = baked render Stitch; di produksi `<model-viewer>` transparan → seamless.

---

## Dashboard Cafe (POS) — fase berikutnya, WAJIB
Belum dibuat. Order customer (screen 7-10) harus mendarat di sini.
- Live order feed per meja (real-time)
- Order detail + ubah status (Diterima → Disiapkan → Siap)
- Konfirmasi pembayaran (cash diterima / QRIS auto via gateway)
- Menu CRUD + upload model 3D (.glb/.usdz)
- Analytics

---

## Next Step Implementasi
Download HTML tiap screen kanonik → port ke Next.js `C:\Kerja\3Diner\App`:
- Screen 1,2,5,6,7,8,9,10 = light theme, port langsung ke komponen
- Screen 3,4 = dark, ganti mockup render dengan `<model-viewer>` live (.glb/.usdz)
- Backend: tabel **Orders** (Supabase) + integrasi QRIS gateway (Midtrans/Xendit)
- Mockup nomor meja, order#, total = hardcoded di Stitch → bind ke data real saat implementasi
