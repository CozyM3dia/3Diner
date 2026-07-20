# HANDOFF: 3Diner Dashboard shadcn Rebuild — lanjutan session baru

Baca file ini penuh sebelum menyentuh kode. Lalu baca:
1. Spec: `App/docs/superpowers/specs/2026-07-19-dashboard-shadcn-rebuild-design.md`
2. Plan: `App/docs/superpowers/plans/2026-07-19-dashboard-shadcn-rebuild.md` (Task 0-9, revisi owner sudah masuk)
3. Brand: `C:\Kerja\3Diner\brand\UI_TOKENS.md` + `DESIGN_SYSTEM.md`

## Posisi sekarang

- Repo: `C:\Kerja\3Diner` (App = `C:\Kerja\3Diner\App`). Branch aktif:
  **`feature/dashboard-shadcn-rebuild`** — 11 commit di atas main, SUDAH pushed.
- Gate terakhir SEMUA HIJAU: `npx tsc --noEmit` 0 · `npm test -- --run` **135/135**
  (baseline 116 + 19 baru) · eslint file-berubah 0 error · `npm run build` lulus.
- Lint baseline global: 44 error/12 warning PRA-rebuild, semua di luar scope
  dashboard — file `App/docs/superpowers/plans/lint-baseline-2026-07-19.{txt,json}`.
  Gate = file berubah 0 error; global tidak boleh ada pasangan file:rule BARU.

## Selesai (commit di branch)

| Commit | Isi |
|---|---|
| `05278c8`, `f85af03`, `917fd70` | spec + implementation plan (sudah 2x revisi owner) |
| `c663c71` | lint baseline reproducible |
| `6f53b4b` | shadcn init (radix base, nova preset) + bedah globals.css (pulihkan `--border #CFD9E4`, radius scale Tailwind default, `--font-sans` -> Poppins) + token adapter `.dash-root, .dash-portal-root` + `#dash-portal-root` di shell + 8 primitive ui (button, dialog, alert-dialog, sheet, tooltip, popover, collapsible, sonner). CATATAN: folder `brand/` ikut ter-commit (dibiarkan, source of truth ter-version) |
| `3273c71` | purge font Geist yang di-inject shadcn init dari `layout.tsx` (brand: Poppins only) + hapus globals.css.bak |
| `aa6e7ad` | Shell: `LazyMotion(domAnimation, strict)` + sidebar mobile via `system/DashSheet.tsx` (wrapper Sheet, animasi CSS bawaan = pemilik motion tunggal) + Sonner `<Toaster position="top-right"/>` + Tooltip hamburger 44px. `ui/sheet.tsx` & `ui/alert-dialog.tsx` HANYA dapat passthrough prop `container` |
| Task 3 commit | `src/components/dashboard/system/`: DashboardPageHeader, DashboardPanel, DashboardMetric (StatCard.tsx kini alias ke sini), DashboardToolbar, DashboardStates (Empty/Error/Skeleton), StatusBadge, ResponsiveDataView, ConfirmAction, fields, portal, index barrel + `tests/dashboard-system.test.tsx` |
| `1842fe0` | Analytics (`dashboard/page.tsx`) + Revenue re-base ke system components; StatusBadge di Pesanan Terbaru revenue |
| `2e4f5f3` | MenuTable -> ResponsiveDataView + StatusBadge; drag/sort/search utuh; label test dijaga PERSIS |
| Orders commit (terakhir) | OrdersClient -> Sonner: `toast.custom` dengan `id = id_order` (dedupe), chime tetap 1x, toast status realtime id `"realtime-status"` (disconnect warning / reconnect success, guard unmount `disposed`), fix lint setState-in-effect lama via rAF, hapus portal toast lama. Tests `tests/orders-sonner.test.tsx` |

## SISA PEKERJAAN (urutan eksekusi)

### Task 6b — Announcements + Scheduler restyle
- File: `src/components/dashboard/AnnouncementForm.tsx`, `SchedulerClient.tsx`,
- Ganti section card manual -> `DashboardPanel`, label field -> `Field` dari
  `@/components/dashboard/system`, badge live "Tampil/Tersembunyi" scheduler ->
  `StatusBadge kind="active" label="Tampil"` / `kind="inactive" label="Tersembunyi"`.
- JANGAN sentuh: state logic, `saveAnnouncement`, `setMenuAvailability`,
  `isMenuAvailableNow`, PhoneMockup preview.

### Task 7 — Settings + QR
- `SettingsForm.tsx`: pakai `Field` system (hapus Field lokal duplikat), section -> `DashboardPanel`. Logic/upload/preview utuh.
- `QrSmartMenu.tsx`: disclosure "Sesuaikan Tampilan QR" -> `Collapsible` shadcn
  (animasi bawaan primitive atau tanpa animasi — JANGAN Framer di primitive).
  Chips boleh `Button variant="secondary"` asal minHeight 44px tetap.
  SEMUA test QR (`tests/qr-smart-menu.test.ts`, 17 test) harus hijau TANPA diubah.
  Matrix/export PNG>=2048/SVG vector/EC-H/aria-live utuh.

### Task 5b — Inventory modals (ditunda dari Task 5)
- `StockAdjustmentModal.tsx` + `RecipeEditor.tsx` (+ `InventoryItemForm.tsx`):
  shell modal custom -> `Dialog` shadcn dengan `container={getDashPortal() ?? undefined}`
  (pola: `system/ConfirmAction.tsx`). Logic adjust/recipe TIDAK berubah.
  Test terkait: `tests/dashboard-inventory-actions.test.ts`, `tests/recipe-editor.test.ts` — harus tetap hijau.
- `InventoryWorkspace.tsx`: header -> `DashboardPageHeader`/`DashboardPanel` bila mudah.

### Task 8 — Hardening + UX audit (detail lengkap di plan Task 8)
- Hapus kode mati HANYA setelah grep 0 referensi (cek `dashboard/StatCard` imports).
- Audit motion: `grep -rn "framer-motion" App/src` -> dashboard hanya boleh
  `LazyMotion|domAnimation|m|AnimatePresence|useReducedMotion`; TIDAK ada `motion.`.
- UX audit gate (dari review owner): tabular-nums semua kolom angka/rupiah;
  tooltip di SEMUA icon-only button semua halaman; empty state ber-CTA konkret;
  degraded states didokumentasikan (realtime disconnect sudah; partial data =
  pola `failedLoads` inventory; session expired = redirect middleware).
- QA browser 390/768/1024/1280/1440: no horizontal overflow (JS check), keyboard,
  console bersih, reduced-motion.
  **Dashboard butuh LOGIN — Claude DILARANG mengisi password. Minta user login
  di Browser pane (`preview_start` name `3diner-app`, port 3000), lalu lanjut QA.**
  Screenshot API pane sering timeout -> pakai `read_page` + JS check.

### Task 9 — Delivery
1. Full gate: tsc, `npm test -- --run`, eslint compare vs baseline JSON
   (tidak boleh ada pasangan file:rule error BARU), `npm run build`.
2. `gh pr create` ke main (branch sudah di origin). Body: checklist parity + hasil gate.
3. Merge setelah hijau -> checkout main -> pull -> deploy:
   `npx vercel deploy --prod --cwd C:\Kerja\3Diner\App` -> verifikasi status READY.
   FALLBACK terverifikasi: jalankan `npx vercel deploy --prod` dari repo root
   `C:\Kerja\3Diner`. Push TIDAK auto-deploy (integrasi git Vercel disconnected).
4. Laporan final sesuai bagian DELIVERABLE/FINAL REPORT di prompt owner + spec.
5. Update memory: `C:\Users\Sibgha\.claude\projects\C--Users-Sibgha\memory\project_3diner.md`.

## GOTCHAS KRITIS (pelajaran sesi sebelumnya — jangan diulang)

1. **JANGAN tulis/ubah file via PowerShell/Bash** (Set-Content merusak UTF-8 ->
   mojibake `Â·`). Hanya tool Edit/Write. Sudah kejadian 1x di dashboard/page.tsx.
2. **shadcn add/init bisa merusak file global**: pernah menimpa `--border`,
   `--radius`, dan meng-inject Geist ke layout.tsx. Kalau perlu `shadcn add`
   komponen baru: cek diff globals.css + layout.tsx sesudahnya, buang perubahan
   di luar file komponen baru.
3. **Portal rule**: konten portal dashboard -> `container={getDashPortal() ?? undefined}`.
   Kelas portal root = `dash-portal-root`, BUKAN `dash-root` (mencegah nested root).
4. **Motion ownership**: primitive Radix/shadcn memakai animasi CSS bawaannya.
   Framer (`m.*` dalam LazyMotion strict) hanya untuk motion buatan sendiri.
   Sonner tidak boleh dibungkus AnimatePresence. Jangan campur `motion.*`.
5. **String test terkunci**: "Resep aktif", "Stok kurang", "Tanpa resep",
   `aria-label="Daftar menu"`, "Edit", copy QR ("Tautan disalin",
   "Gagal mengunduh QR. Coba lagi.", dst). Jangan ubah.
6. **jsdom tanpa matchMedia** — test yang me-render shell/Sonner/ResponsiveDataView
   butuh stub (pola: `tests/dashboard-shell-shadcn.test.tsx`).
7. **eslint react-hooks ketat** (baru): tanpa setState sinkron di body effect
   (pakai rAF/subscription callback), tanpa membuat komponen saat render;
   render-time state reset pattern OK (lihat `DashboardShell` `lastPath`).
8. **Commit kecil per task + gate penuh sebelum tiap commit. JANGAN `git add -A`**
   (itu yang menyeret brand/ + .bak masuk repo).
9. Deploy prod saat ini: https://3diner.vercel.app (main). Branch ini belum
   ter-deploy — deploy hanya setelah PR merge.
10. `NEXT_PUBLIC_SITE_URL=https://3diner.vercel.app` sudah di-set di Vercel prod
    env (dipakai QR Smart Menu). Jangan dihapus.

## Perintah verifikasi standar (dari `C:\Kerja\3Diner\App`)

```
npx tsc --noEmit
npm test -- --run
npx eslint <files-yang-diubah>
npm run build
```

## Prompt pembuka yang disarankan untuk session baru

"Lanjutkan rebuild dashboard shadcn 3Diner. Baca
`C:\Kerja\3Diner\App\docs\superpowers\plans\2026-07-19-shadcn-rebuild-handoff.md`
dan ikuti sisa pekerjaan dari Task 6b. Branch `feature/dashboard-shadcn-rebuild`."
