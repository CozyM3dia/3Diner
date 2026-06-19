# 3Diner — Simulasi Finansial (v1)

> Artifact. Brainstorm 2026-06-19. Mendampingi `STRATEGY.md` + `MVP-SCOPE.md`.
> Semua angka = proposal/asumsi awal, BUKAN final. Adjust setelah data riil.

---

## Asumsi

| Item | Nilai | Catatan |
|------|-------|---------|
| Kurs | Rp16.000/USD | |
| Biaya AI generate | Rp8.000/dish (~$0.5) | **BELUM dikunci** — banding Meshy/Tripo/Rodin/Luma |
| QRIS MDR | 0,7% dari harga | fee tagih langganan |
| Free infra | Rp17.000/bln | Supabase+Vercel free, domain ~Rp200rb/th |
| Pro infra | Rp720.000/bln | Supabase Pro $25 + Vercel Pro $20 |
| Mix tier | 30% 50k / 50% 100k / 20% 150k | asumsi komposisi pelanggan |

Tier (dish 3D aktif + AI credit/bln): 50k=5 dish/1 gen · 100k=15/2 · 150k=30/3.

---

## Per-Cafe / Bulan

| Tier | Harga | Margin kotor/bln | Onboard 1x (bikin dish) | Payback onboard |
|------|-------|------------------|-------------------------|-----------------|
| 50k | Rp50.000 | Rp41.650 | Rp40.000 | 1,0 bln |
| 100k | Rp100.000 | Rp83.300 | Rp120.000 | 1,4 bln |
| 150k | Rp150.000 | Rp124.950 | Rp240.000 | 1,9 bln |

Margin kotor ~83% harga. Biaya bikin dish 3D balik dalam 1–2 bln.

---

## Break-Even (jumlah cafe nutup biaya tetap/bln)

| Regime | Biaya tetap | Break-even (mix) |
|--------|-------------|------------------|
| **Free infra** | Rp17.000/bln | **1 cafe** |
| **Pro infra** | Rp720.000/bln | **10 cafe** |

> Insight: **pertahankan free infra selama mungkin** → break-even cuma 1 cafe. Pindah Pro hanya saat limit free (egress/row) kepukul.

---

## Proyeksi Bulanan (mix 30/50/20, avg margin Rp79.135/cafe)

| Cafe | Gross margin | Net (free infra) | Net (pro infra) |
|------|--------------|------------------|-----------------|
| 5 | Rp395.675 | +Rp378.675 | −Rp324.325 |
| 10 | Rp791.350 | +Rp774.350 | +Rp71.350 |
| 20 | Rp1.582.700 | +Rp1.565.700 | +Rp862.700 |
| 30 | Rp2.374.050 | +Rp2.357.050 | +Rp1.654.050 |
| 50 | Rp3.956.750 | +Rp3.939.750 | +Rp3.236.750 |

---

## Payback Modal Awal (asumsi free infra)

Komponen modal contoh: domain, tooling, pilot 5 cafe ×15 dish gratis (Rp600.000), marketing, kredit API awal.

| Modal | 10 cafe | 20 cafe | 30 cafe |
|-------|---------|---------|---------|
| Rp3.000.000 | 3,9 bln | 1,9 bln | 1,3 bln |
| Rp7.000.000 | 9,0 bln | 4,5 bln | 3,0 bln |
| Rp15.000.000 | 19,4 bln | 9,6 bln | 6,4 bln |

---

## Risiko / Belum Dimodelkan

1. **Waktu & tenaga founder** = biaya terbesar, tak masuk model (dev, sales, QC model, support). Solo → bottleneck waktu, bukan kas.
2. **Harga API AI belum pasti.** Kalau Rp16.000/gen, biaya variabel 2×, margin turun.
3. **Bandwidth/egress** serving model 3D ke banyak customer = biaya tersembunyi di skala. Free tier limit: Supabase 5GB, Vercel 100GB/bln. Wajib CDN cache + kompres model (Draco/meshopt).
4. **Churn** belum dimodel — net growth yang menentukan.
5. **Collection** langganan bulanan di ID rawan nunggak → butuh QRIS auto/reminder + gate `status_lunas`.

---

## Baca Strategis

Di harga cafe-Lampung ini **skala side-income**: 50 cafe ≈ Rp3,9jt/bln net (free infra). Untuk jadi besar:
- Ekspansi kota lain setelah model Lampung terbukti.
- Add-on revenue: fee done-for-you premium, paket model, setup fee.
- Naikkan harga setelah nilai terbukti (analytics footfall).

Kekuatan model: margin tinggi + break-even sangat rendah (free infra) → risiko kas kecil. Kelemahan: ceiling pendapatan rendah tanpa ekspansi/add-on.
