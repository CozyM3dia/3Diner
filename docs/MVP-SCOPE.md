# 3Diner — Ruang Lingkup MVP

> Artifact keputusan. Hasil brainstorm 2026-06-19. Mendampingi `STRATEGY.md`.
> Tujuan MVP: cukup untuk hook "wow visual + UGC" di pilot cafe Lampung.

---

## 1. Yang Sudah Ada (App / smart menu customer-facing)

Next.js (App Router, Turbopack) + Three.js + `@google/model-viewer` + gaussian-splats + Supabase + Vercel. Repo `CozyM3dia/3Dinner_Website`.

- Cafe page `[slug]` → menu grid → detail `[menu_id]` → viewer 3D `/3d` → AR.
- Dua pipeline AR: `.glb`/`.usdz` (model-viewer, kompat tinggi iOS+Android) & `.ply` gaussian splat (WebXR, Android only).
- Tombol order = `redirect_link` (keluar ke GoFood/Grab/WA).
- Analytics log: `click_menu` | `view_3d` | `click_order`.
- Data layer `USE_DUMMY` flag — tinggal switch ke Supabase.

**Status: tinggal poles + sambung Supabase.**

---

## 2. Data Model Existing (acuan dashboard)

```
Cafe:  id_cafe, nama_cafe, alamat_cafe, slug_url, qr_token_customer,
       subscription_type ('Tier 50k'|'Tier 100k'|'Tier 150k'),
       status_lunas (bool), created_at
Menu:  id_menu, cafe_id, nama_menu, harga_menu, description_menu,
       model_3d_url, redirect_link, created_at
AnalyticsLog: id_log, cafe_id, menu_id,
       event_type ('click_menu'|'view_3d'|'click_order'), duration, created_at
```
Tabel Supabase: `Cafes`, `Menus`, `Analytics_Logs`. Gate publik: `getCafeBySlug` cek `status_lunas = true`.

**Perlu ditambah untuk MVP hybrid:** field/tabel jatah & pemakaian AI credit (mis. `ai_credits_quota`, `ai_credits_used` di Cafe), status job generate model (queued/processing/done/failed), `usdz_url` terpisah dari `model_3d_url` (`glb`).

---

## 3. Web Dashboard — INI YANG DIBANGUN (folder kosong)

### 3a. Sisi Cafe Owner
- **Auth** Supabase (login per cafe).
- **Menu CRUD**: nama, harga, deskripsi, `redirect_link`.
- **Upload model 3D MANUAL**: upload file `.glb` (+ `.usdz` opsional iOS) → simpan ke storage (Cloudflare R2) → set `model_3d_url`. Validasi tipe/ukuran file. **Tanpa AI generate di MVP.**
- **QR**: tampilkan + download (PNG/SVG) dari `slug_url`/`qr_token_customer`.
- **Analytics**: total view, view 3D, klik order per menu + tren. = bukti nilai buat cafe.
- **Profil cafe**: nama, alamat, slug; lihat tier + jumlah dish terpakai.

> Catatan: di praktik pilot, operator yang upload `.glb` (done-for-you). UI upload tetap dipakai cafe maupun operator.

### 3b. Sisi Super-Admin (operator)
- Onboard cafe: buat record cafe, set `slug_url`, `subscription_type`, `status_lunas`.
- Toggle `status_lunas` = gerbang bayar (langganan jatuh tempo → matikan menu publik).
- Upload/kelola model `.glb` untuk cafe (done-for-you).

---

## 4. Penyimpanan & Serving Model 3D (MVP)

1. Upload `.glb` (+ `.usdz` opsional) lewat dashboard.
2. Simpan ke **Cloudflare R2** (egress gratis — wajib, lihat `INFRA-LIMITS` di sim) → URL ke `model_3d_url`.
3. Serve via R2 + cache header immutable.
4. (Disarankan) kompres `.glb` Draco/meshopt sebelum upload, target ≤5MB.

**DEFER ke fase 2 — Pipeline AI Image-to-3D:** upload foto → API generate (Meshy/Tripo/Rodin/Luma, belum dikunci) → `.glb` → konversi `.usdz` → metering credit. Tidak dibangun di MVP.

---

## 5. Di Luar Lingkup MVP (YAGNI — tunda)

**AI image-to-3D generate + metering credit (fase 2)**, KDS / active kitchen, payment in-app, ordering in-app (cart), staff console, table view / view designer, multi-bahasa, multi-currency, happy-hour / multi-menu / custom tags, auto-greeting, call-waiter, Google review integration, AI menu extractor (PDF).

> Semua ada di pesaing 4D, tapi tak perlu untuk hook Lampung. Tambah belakangan kalau terbukti perlu.

---

## 6. Definition of Done (MVP)

- Pilot cafe bisa: login → kelola menu → **upload `.glb` manual** → menu tayang di QR publik → tamu lihat 3D/AR → lihat analytics.
- Operator bisa: onboard cafe, set tier, toggle bayar, upload model done-for-you.
- Smart menu publik live di Vercel dengan data Supabase nyata (bukan dummy), model dilayani dari Cloudflare R2.
