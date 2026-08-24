# Eksplorasi: Ganti Tripo dengan Model Open-Source (Self-Host / Finetune)

Status: **eksplorasi, belum keputusan.** Angka harga di sini estimasi per 2026-08 dan
wajib diverifikasi ulang sebelum dipakai untuk keputusan belanja.

Konteks saat ini: `App/src/lib/tripo.ts` memanggil Tripo v2 `image_to_model`
(texture + PBR, `texture_quality: detailed`, `face_limit: 150000`), lalu
`convert_model` → USDZ untuk AR iOS. Biaya diasumsikan ~$0.2–0.6/model
(`docs/STRATEGY.md` §4, `docs/FINANCIAL-SIM.md`), dibatasi lewat `CREDIT_COST.model3d = 1`.

---

## 1. Koreksi framing: "finetune" bukan langkah pertama

Pertanyaan aslinya "finetune model opensource biar murah". Dua hal ini terpisah:

| Tujuan | Cara | Effort |
|---|---|---|
| **Murah** | Self-host model open-source apa adanya (zero-shot) | Sedang |
| **Kualitas khusus makanan** | Finetune / LoRA di atas model itu | Sangat besar |

Yang menurunkan biaya adalah **self-hosting**, bukan finetuning. Finetuning
menaikkan kualitas dan justru **menambah** biaya (data + GPU training).

Blocker finetuning yang sering diremehkan: image-to-3D butuh **ground truth mesh**,
bukan foto. Tidak bisa finetune dari kumpulan foto makanan saja. Sumber mesh:

1. **Fotogrametri sendiri** — iPhone LiDAR / COLMAP / Gaussian splat → mesh.
   Realistis ~30–60 menit per hidangan termasuk cleanup. Untuk dataset LoRA yang
   layak (≥500–2000 pasang) = 250–2000 jam kerja. Tidak feasible solo.
2. **Distilasi dari Tripo** — generate pakai Tripo, pakai outputnya sebagai target
   training. **Cek ToS Tripo dulu** — training model kompetitor dari output API
   umumnya dilarang eksplisit. Anggap jalur ini tertutup sampai terbukti sebaliknya.
3. **Objaverse-XL subset makanan** — ada beberapa ribu mesh, tapi mayoritas aset
   game bergaya stylized, bukan makanan fotoreal. Mismatch domain besar.

**Kesimpulan bagian ini: finetune dicoret dari roadmap jangka pendek.**

---

## 2. Kandidat model open-source (self-host, zero-shot)

| Model | Lisensi | VRAM | Waktu/model | Catatan |
|---|---|---|---|---|
| **TRELLIS** (Microsoft) | MIT | ~16 GB | ~15–30 s | Lisensi paling aman. Geometri bagus, tekstur oke. Output GLB langsung. |
| **Hunyuan3D 2.1** (Tencent) | Tencent Community | ~20–24 GB | ~40–90 s | Kualitas + PBR terbaik di kelas open. Lisensi melarang EU/UK/KR — Indonesia aman, tapi baca ulang kalau ekspansi. |
| **Hunyuan3D-2mini** (0.6B) | Tencent Community | ~8–12 GB | ~20–40 s | Muat di GPU konsumen. Kualitas turun. |
| **TripoSR** | MIT | ~6 GB | ~1 s | Cepat sekali, tapi tanpa PBR dan geometri kasar. Cocok untuk *preview*, bukan final. |
| **Stable Fast 3D** | Stability Community | ~8 GB | ~1 s | Cek klausa komersial Stability sebelum dipakai produksi. |

Rekomendasi kalau jadi self-host: **TRELLIS** (lisensi bersih) untuk jalur utama,
**TripoSR** untuk preview instan di dashboard.

---

## 3. Hitungan biaya

### Sewa GPU (RunPod / Vast.ai, estimasi)

| GPU | ~$/jam | Model/jam (@60 s) | ~$/model |
|---|---|---|---|
| RTX 4090 | 0.34–0.44 | 60 | **~0.007** |
| L40S | ~0.8 | 60 | ~0.013 |
| A100 40GB | 1.1–1.6 | 90 | ~0.015 |

Dengan overhead cold start + idle (asumsi efisiensi 50%): **~$0.015/model**.
Vs Tripo $0.2–0.6 → **13×–40× lebih murah per model**.

### Tapi: volume 3Diner terlalu kecil untuk itu berarti

Dari `FINANCIAL-SIM.md`: 50 cafe × ~15 dish = ~750 model, dan itu sebagian besar
**one-time saat onboarding**, bukan berulang. Anggap steady state 300 model/bulan:

| Skenario | Biaya/bulan |
|---|---|
| Tripo @ $0.4 | ~$120 (≈ Rp2 jt) |
| Self-host serverless @ $0.015 | ~$5 (≈ Rp80 rb) |
| **Hemat** | **~Rp1,9 jt/bulan** |

Ongkos untuk mendapat hemat itu:
- Build awal: container GPU + queue + retry + storage + USDZ converter. **40–80 jam.**
- Ops berjalan: cold start, OOM, driver, versi CUDA, monitoring. Tak pernah nol.
- Kehilangan fitur Tripo gratisan: konversi USDZ, rigging, retopology, SLA.

**Titik impas kasar: >1.000–2.000 model/bulan** baru self-host menang jelas.
Di bawah itu, Rp1,9 jt/bulan tidak sebanding waktu founder — yang sudah
diidentifikasi sebagai bottleneck utama di `FINANCIAL-SIM.md` §Risiko poin 1.

### Opsi ketiga: beli GPU sendiri

RTX 3090/4090 bekas ~Rp15–25 jt. Marginal cost setelah itu ~listrik saja
(400 W × 1 menit ≈ nol). Payback vs Tripo di 300 model/bln ≈ **10–12 bulan**,
dan barangnya sekalian jadi dev box. Menarik kalau memang mau beli GPU toh.

---

## 4. Yang sebenarnya lebih menguntungkan sekarang

Tiga langkah ini menurunkan biaya lebih besar dari ganti model, dengan effort jauh lebih kecil.

### 4.1 Library model bersama (dampak terbesar)

Long tail makanan Indonesia itu **pendek**. Nasi goreng, ayam geprek, mie ayam,
es teh, kopi susu — dish yang sama muncul di puluhan cafe. Kalau 40% menu bisa
dilayani dari library kurasi yang di-generate sekali:

- Biaya variabel per cafe baru turun ~40% **tanpa menyentuh model AI apa pun**.
- Onboarding cafe baru jadi lebih cepat (jual sebagai fitur, bukan penghematan).
- Bisa jadi add-on revenue ("paket model") yang sudah disebut di `FINANCIAL-SIM.md` §Skala.

Butuh: tabel katalog dish global + matching nama/foto + izin reuse di ToS cafe.

### 4.2 Pre-processing foto sebelum kirim ke Tripo

Foto makanan mentah (piring, meja, tangan, background ramai) bikin geometri Tripo
kacau → generate ulang → bayar 2–3×. Segmentasi subjek (SAM2 / rembg) + background
putih + auto-crop sebelum upload:

- Turunkan retry rate. Ini penghematan langsung ke tagihan Tripo.
- Effort kecil (satu step di `api/tripo/generate`), tanpa GPU sendiri.
- **Lakukan ini duluan.** Kemungkinan besar ROI tertinggi per jam kerja.

### 4.3 Preview murah + final berbayar

TripoSR self-host (~1 s, GPU kecil, MIT) untuk preview instan saat cafe upload foto.
Cafe approve → baru panggil Tripo yang berbayar. Memotong generate yang
"ternyata fotonya jelek" sebelum uang keluar.

---

## 5. Rekomendasi urutan

1. **Sekarang:** pre-processing foto (§4.2). Murah, langsung menurunkan tagihan.
2. **Sekarang:** verifikasi harga Tripo asli per model — `$0.2–0.6` masih tertulis
   "BELUM dikunci" di dua dokumen. Semua matematika di atas bergantung angka ini.
3. **Kuartal berikut:** library model bersama (§4.1). Dampak biaya + produk terbesar.
4. **Tunda:** self-host TRELLIS sampai volume >1.000 model/bulan atau ada GPU
   nganggur. Siapkan abstraksi provider di `src/lib/tripo.ts` supaya swap nanti murah.
5. **Coret:** finetune model sendiri. Terhalang data mesh, bukan terhalang uang.

---

## 6. Hal yang perlu diverifikasi

- [ ] Harga Tripo per `image_to_model` (texture+pbr) yang sebenarnya di tagihan.
- [ ] Retry rate saat ini — berapa % generate diulang karena hasil jelek.
- [ ] ToS Tripo soal penggunaan output sebagai data training.
- [ ] Berapa % dish across cafe yang duplikat (bukti kuantitatif untuk §4.1).
- [ ] Lisensi Tencent Hunyuan terbaru kalau TRELLIS ternyata kurang untuk makanan.
