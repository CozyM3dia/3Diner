# 3Diner — Brand Design Guidelines

> Diturunkan dari `Asset/3Diner Brand Design.png` + warna eksak dari `Asset/Logo 3Diner Only.svg`.
> Acuan visual untuk smart menu + Web Dashboard MVP.

---

## 1. Brand Essence

- **Nama:** 3Diner
- **Tagline:** *"Lihat Sebelum Memesan"* (See before you order)
- **Kategori:** menu makanan interaktif 3D/AR untuk cafe
- **Kepribadian:** modern, teknis tapi hangat, playful-premium, food-forward
- **Logo mark:** kubus 3D (box) dengan garpu+sendok membentuk "3D", disambung wordmark "iner" → **3Diner**

---

## 2. Color Palette

### Primer
| Peran | Hex | Catatan |
|-------|-----|---------|
| **Navy (utama)** | `#022C60` | warna brand dominan, teks, header, dark surface |
| **Orange (aksen)** | `#FD5002` | CTA, highlight, ikon aktif, "3D" |
| **Off-white (BG)** | `#FDFDFD` | background utama light mode |

### Navy — variasi
| Hex | Pakai |
|-----|-------|
| `#002355` | navy paling gelap (shadow/depth) |
| `#022C60` | navy utama |
| `#1A3B6A` / `#254473` | navy muda (hover, border) |
| `#51698F` | navy desaturasi (teks sekunder di dark) |

### Orange — variasi
| Hex | Pakai |
|-----|-------|
| `#FD4C0E` / `#FD5002` | orange utama |
| `#FC6A41` / `#FC733B` | orange terang (hover) |
| `#FDD8C3` / `#FCE8DF` | orange tint lembut (badge bg, highlight halus) |

### Netral (cool gray, turunan navy)
| Hex | Pakai |
|-----|-------|
| `#CFD9E4` | border, divider |
| `#E0E5EB` / `#E0E7EE` | surface abu muda, card bg |

**Rasio pakai:** ~70% navy/netral, ~20% putih, ~10% orange (aksen — jangan berlebihan).

---

## 3. Typography

- **Typeface:** **Poppins** (geometric sans). Satu keluarga untuk semua.
- **Weights:** Light 300 · Regular 400 · Medium 500 · SemiBold 600 · Bold 700.
- **Pemakaian:**
  - Display / heading: Poppins SemiBold–Bold.
  - Body: Poppins Regular.
  - Label / caption: Poppins Medium, sedikit letter-spacing.

**Skala tipe (saran):**
| Token | Size / Line | Weight |
|-------|-------------|--------|
| Display | 40 / 48 | 700 |
| H1 | 32 / 40 | 700 |
| H2 | 24 / 32 | 600 |
| H3 | 20 / 28 | 600 |
| Body | 16 / 24 | 400 |
| Small | 14 / 20 | 400 |
| Caption | 12 / 16 | 500 |

---

## 4. Iconography & Graphic Element

- **Ikon:** gaya **line/outline**, stroke konsisten, sudut membulat halus. Warna orange `#FD5002` saat aktif, navy `#022C60` saat default.
- **Elemen grafis khas:** potongan diagonal navy↔orange (sudut tajam) sebagai aksen banner/section. Pakai hemat sebagai pembatas atau header dekoratif.
- **Sudut radius:** membulat sedang (≈12–16px card) — selaras logo kubus yang soft.

---

## 5. Logo Usage

File tersedia di `Asset/`:
- `Logo 3Diner.png` — logo + wordmark penuh.
- `Logo 3Diner Only.png` / `.svg` — mark kubus saja (favicon, avatar).

**Aturan:**
- Clear space ≥ tinggi huruf "D" di sekeliling logo.
- Light mode: logo full color di atas `#FDFDFD`.
- Dark mode: logo di atas navy `#022C60`/`#002355`; pastikan kontras (versi putih bila perlu).
- **Jangan:** ubah warna logo di luar palette, regang/distorsi, kasih bayangan berlebih, taruh di atas background ramai tanpa kontras.

---

## 6. Mode Light & Dark

Smart menu mendukung dua mode (sesuai produk):
| | Light | Dark |
|--|-------|------|
| Background | `#FDFDFD` | `#022C60` / `#002355` |
| Teks utama | `#022C60` | `#FDFDFD` |
| Teks sekunder | `#51698F` | `#CFD9E4` |
| Surface/card | `#E0E7EE` | `#0D3166` |
| Aksen/CTA | `#FD5002` | `#FD5002` (tetap) |

Orange tetap aksen di kedua mode (kontras tinggi di navy maupun putih).

---

## 7. Design Tokens (untuk kode)

```css
:root {
  /* brand */
  --color-navy:        #022C60;
  --color-navy-dark:   #002355;
  --color-navy-soft:   #254473;
  --color-navy-muted:  #51698F;
  --color-orange:      #FD5002;
  --color-orange-bright:#FC6A41;
  --color-orange-tint: #FDD8C3;
  /* neutrals */
  --color-white:       #FDFDFD;
  --color-border:      #CFD9E4;
  --color-surface:     #E0E7EE;
  /* semantic (light) */
  --bg:        var(--color-white);
  --text:      var(--color-navy);
  --text-muted:var(--color-navy-muted);
  --accent:    var(--color-orange);
  --radius:    14px;
  --font: "Poppins", system-ui, sans-serif;
}
```

---

## 8. Do / Don't

**Do:** orange hemat sebagai aksen · Poppins konsisten · kontras tinggi navy/putih · foto makanan jadi bintang (visual-first) · whitespace lega.

**Don't:** banjir orange · campur font lain · teks navy di atas navy (kontras rendah) · radius/gaya ikon tak konsisten · logo terdistorsi.
