# 3Diner — Strategi & Go-To-Market

> Artifact keputusan. Hasil brainstorm 2026-06-19. Acuan arah produk + pasar.
> Riset produk pesaing: lihat `Asset/research/4D-Smart-Menu-Summary.md`.

---

## 1. Posisi Produk

**3Diner = lapisan pengalaman + marketing untuk cafe, BUKAN POS.**

Menu digital berbasis QR dengan **dish 3D/AR**. Tamu scan QR → lihat menu → lihat dish dalam 3D → "View in AR" di meja → tombol order **redirect keluar** (GoFood/GrabFood/WhatsApp). Tanpa kasir, tanpa KDS, tanpa payment in-app.

**Kenapa bukan POS:** pasar POS Indonesia sudah padat (ESB, Majoo, Olsera, Moka, GoBiz). Lawan langsung = bakar modal, kalah. 3Diner masuk lewat celah yang incumbent tak punya: **3D/AR + smart menu estetik**.

> Build existing sudah mencerminkan ini: `redirect_link` per menu (order keluar), analytics `view_3d`/`click_menu`/`click_order`, subscription tier, tanpa modul POS.

---

## 2. Target Pasar

**Cafe mid-range s/d high-range di Lampung (fokus awal: Bandar Lampung).**

- Jual suasana, "Instagramable", tempat nongkrong.
- Dapat keunggulan jelas dari produk (wow-factor + buzz).
- Crowd: mahasiswa UNILA/ITERA + komunitas cafe-hopping lokal yang rapat.

Bukan: UMKM/warung massal (terlalu sensitif harga, tak butuh wow), bukan chain (sales cycle panjang) — keduanya fase nanti.

---

## 3. Hook Utama (Lampung-first)

**"Wow visual + UGC", dibingkai first-mover.**

Pitch: *"Jadi cafe pertama di Lampung yang tamunya bisa lihat menu 3D & AR — pelanggan foto, share, cafe rame sendiri."*

Alasan:
- Pasar tier-2 kecil + komunitas rapat → satu cafe viral cepat nular, buzz organik gratis.
- **First-mover novelty** = brag nyata di Lampung ("pertama"), susah ditiru cepat. Di Jakarta sudah ada pesaing; Lampung kosong.
- Cocok kantong cafe: nilai = footfall + konten IG, bukan software ops mahal.

Hook #2 = **brand premium** ("naik kelas dari QR menu flat").
Dibuang dari pitch: efisiensi operasi (cafe kecil tak punya nyeri ops), naik AOV (efek samping, bukan pitch).

---

## 4. Model Produksi 3D — Hybrid (AI image-to-3D)

**Cafe TAK bisa bikin model 3D sendiri = bottleneck inti. Solusi: hybrid, tanpa turun lapangan.**

1. **Self-serve (utama):** cafe upload foto dish ke dashboard → **AI image-to-3D** generate `.glb` → konversi `.usdz` (iOS). Basis credit.
2. **Done-for-you premium:** operator poles model hero dish (tetap remote, tanpa scan fisik) untuk onboarding/flagship.

**Catatan teknis & risiko:**
- Pipeline pakai API pihak ketiga: kandidat **Meshy / Tripo / Rodin (Hyper3D) / Luma**. Perlu riset banding kualitas+harga (belum dikunci).
- Biaya per-generate ~$0.2–0.6 = **variable cost** → wajib dibatasi credit per tier.
- Single-image→3D untuk makanan masih sulit (organik, mengkilap, translusen). Bagus untuk wow/novelty, belum photoreal. Mitigasi: izinkan multi-foto + fallback done-for-you.

---

## 5. Harga & Tier

Tier existing di kode: `'Tier 50k' | 'Tier 100k' | 'Tier 150k'` (IDR/bulan). Gerbang bayar: `status_lunas`.

**Pembeda: jumlah dish 3D aktif + jatah AI credit/bulan** (harga nempel ke biaya nyata API generate).

| Tier | Harga/bln | Dish 3D aktif | AI credit/bln | Ekstra |
|------|-----------|---------------|---------------|--------|
| 50k | Rp50.000 | ~5 | ~5 generate | analytics dasar |
| 100k | Rp100.000 | ~15 | ~15 generate | analytics penuh |
| 150k | Rp150.000 | unlimited/featured | ~30 + prioritas | custom branding, diskon done-for-you |

> Angka credit/dish = proposal awal, kalibrasi setelah tahu biaya API riil + margin.

---

## 6. Eksekusi GTM Lampung

1. **Pilot:** 3–5 cafe estetik flagship Bandar Lampung. Done-for-you: poles signature dish **gratis**, setup menu, kasih QR table-tent. Framing "cafe pertama di Lampung".
2. **Akuisisi:** manfaatkan IG cafe sendiri + komunitas cafe-hopping Lampung + crowd mahasiswa. Konten AR shareable = marketing organik. Micro-influencer cafe lokal.
3. **Loop bukti:** analytics dashboard ("X tamu lihat dish 3D bulan ini") → justifikasi perpanjang langganan.
4. **Land-expand:** pilot gratis → konversi ke tier bayar setelah footfall/buzz terbukti.
5. **Constraint:** biaya AI generate + effort poles per-dish harus ketutup harga tier.

---

## 7. Keputusan Terkunci vs Terbuka

**Terkunci:**
- Posisi: experience layer, bukan POS. Order via redirect.
- Target: cafe mid-high, Lampung-first.
- Hook: wow visual + UGC, first-mover.
- Model 3D: hybrid AI image-to-3D + done-for-you, tanpa scan lapangan.
- Tier basis: dish 3D + AI credit.

**Terbuka (perlu riset/keputusan lanjut):**
- API AI image-to-3D mana (Meshy/Tripo/Rodin/Luma) — banding kualitas makanan + harga.
- Angka pasti credit & dish per tier (setelah tahu biaya API).
- Pipeline konversi `.usdz` di server.
