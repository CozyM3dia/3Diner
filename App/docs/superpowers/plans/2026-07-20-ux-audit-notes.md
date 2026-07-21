# UX Audit Notes — Task 8 Hardening (2026-07-20)

Hasil audit gate Task 8 (plan `2026-07-19-dashboard-shadcn-rebuild.md`).

## Dead code

- `dashboard/StatCard.tsx` (alias DashboardMetric): grep 0 referensi -> DIHAPUS.
- `useModalFocus` + `focusableElements` + `focusableSelector` (StockAdjustmentModal):
  konsumen terakhir (StockAdjustmentModal shell, InventoryDialog) sudah pindah ke
  Radix Dialog -> DIHAPUS bersama Task 5b.
- Duplikat `inputStyle`/`Field` lokal: SettingsForm, InventoryItemForm, RecipeEditor,
  StockAdjustmentModal sekarang pakai `dashInputStyle`/`dashInputClass` system.

## Motion audit

- `grep -rn "framer-motion" App/src` -> hanya `DashboardShell.tsx`:
  `import { LazyMotion, domAnimation } from "framer-motion"`. LULUS.
- Tidak ada `motion.*` di file dashboard. Primitive Radix/shadcn memakai animasi
  CSS bawaan (Dialog/AlertDialog/Sheet/Collapsible). Sonner tidak dibungkus
  AnimatePresence. LULUS.
- `prefers-reduced-motion: reduce` global kill switch di globals.css:514. LULUS.

## Tabular-nums

- Kolom angka/rupiah: menu (harga), inventory (stok/minimum/harga/mutasi),
  orders (total), revenue (qty x, revenue, waktu), DashboardMetric — sudah tabular.
- Ditambahkan pada audit ini: DonutChart center total, RevenueChart tooltip,
  revenue "Pesanan Terbaru" baris rupiah.

## Tooltip icon-only

Ditambahkan `title` (+ `aria-label` bila belum ada):

- FileUpload tombol X "Hapus"
- InventoryTable notice close ("Tutup")
- OrdersClient toast dismiss ("Tutup"), ReceiptModal close
  (SEBELUMNYA TANPA aria-label -> ditambah "Tutup preview struk")
- MenuTable clear-search ("Hapus pencarian")

Sudah tercakup sebelumnya: hamburger shell (shadcn Tooltip), aksi baris inventory
("Atur stok"/"Ubah bahan"), copy QR/copy ID pesanan, hapus bahan resep.

## Empty states (CTA konkret)

- Menu: "Tambah Menu" -> /dashboard/menu/new (sudah ada)
- Scheduler: DITAMBAH CTA "Tambah Menu" (DashboardEmptyState)
- Inventory: "Tambah Bahan" buka modal create (sudah ada)
- Orders: DITAMBAH CTA "Bagikan QR Menu" -> /dashboard/settings#qr-menu
- Mutasi inventory: informasional ("Penyesuaian stok akan tercatat di sini") —
  tidak ada aksi user yang relevan, dibiarkan.
- Announcements: form selalu tampil, tidak ada empty state.

## Degraded states (dokumentasi gate)

| State | Perilaku | Status |
|---|---|---|
| Realtime disconnect | Sonner warning id `"realtime-status"` (tidak stack), reconnect -> success toast | Terimplementasi (Task 6) |
| Partial data inventory | `failedLoads` -> `InventoryLoadError` panel dengan daftar sumber gagal | Dipertahankan |
| Session expired | Redirect middleware ke /login (`getDashboardCafeContext` -> redirect) | Diverifikasi di kode; tidak disimulasikan di browser |
| Export/save gagal | QR: "Gagal mengunduh QR. Coba lagi." (aria-live); form: error banner role=alert; scheduler/announcement: error inline | Terimplementasi |
| Push notification ditolak | Chime + toast tetap jalan (Notification opsional) | Tidak disimulasikan |

Tidak dapat disimulasikan tanpa environment khusus: session expiry mid-action,
Supabase channel drop paksa. Keduanya punya jalur kode eksplisit di atas.

## Review follow-up (commit `19e077c`)

Temuan review pasca hardening pass, semua sudah ditutup:

1. **Orders belum sesuai plan Task 6** — ReceiptModal masih overlay manual, order
   card masih markup manual. FIXED: ReceiptModal -> `Dialog` (container
   `getDashPortal()`), card -> `DashboardPanel` + `StatusBadge` kind `order-*`
   (STATUS_META lokal dihapus, label identik), filter row -> `DashboardToolbar`,
   empty state -> `DashboardEmptyState`.
2. **Tooltip/Popover portal ke body** — melanggar aturan portal-token spec.
   FIXED: `ui/tooltip.tsx` + `ui/popover.tsx` dapat passthrough `container`
   (pola sama dengan dialog/alert-dialog/sheet); tooltip hamburger shell kini
   `container={getDashPortal() ?? undefined}`.
3. **1 lint warning BARU** di SchedulerClient:81 (ternary untuk side effect).
   FIXED jadi if/else. Gate diperketat: bandingkan pasangan file::rule untuk
   severity error DAN warning — sekarang 0 baru di keduanya
   (errors 44 -> 37, warnings 12 -> 10).
4. **Blank line at EOF** InventoryWorkspace.tsx terdeteksi `git diff --check
   main...HEAD`. FIXED; PR diff check bersih.
5. **lint-current-2026-07-20.json untracked** -> di-commit bersama baseline
   pembandingnya.

## Browser QA (390/768/1024/1280/1440) — DIJALANKAN 2026-07-20

Owner login di Browser pane, QA dijalankan pada dev server `3diner-app`.

**Overflow horizontal (JS: `scrollWidth - clientWidth`, offender di-filter agar
node di dalam scroller tidak dihitung):**

| Lebar | Route diuji | Hasil |
|---|---|---|
| 390 | 8 route (analytics, orders, menu, inventory, scheduler, settings, announcements, revenue) | 0px, 0 offender |
| 768 | revenue, orders | 0px |
| 1024 | orders (hamburger `display:none` = sidebar aktif) | 0px |
| 1280 | inventory | 0px |
| 1440 | inventory | 0px |

**Dialog (portal-token + keyboard):**

- Struk pesanan: `role=dialog` di dalam `#dash-portal-root` (class
  `dash-portal-root`), judul benar, iframe ter-render, lebar 358px di 390.
  Escape menutup, scroll lock lepas.
- Atur Stok inventory: portal benar, fokus mendarat di `input[name=quantity]`,
  Escape menutup, fokus balik ke tombol pemicu.

**BUG DITEMUKAN + DIPERBAIKI:** setelah dialog struk ditutup, fokus mendarat di
`<body>`, bukan kembali ke tombol printer. Penyebab: Dialog di-unmount begitu
`previewOrder` null sehingga restore-focus bawaan Radix tidak sempat jalan, dan
tombol printer bukan `DialogTrigger`. Fix: `returnFocusRef` + rAF (pola sama
InventoryTable), commit `412aa13`, ditutup regression test. Diverifikasi ulang
di browser: fokus kembali persis ke tombol pemicu.

**Collapsible QR:** trigger `aria-expanded` false -> true, konten mount saat
buka, keempat chip tinggi terukur 44px (bukan sekadar deklarasi).

**Nama aksesibel:** orders 63 kontrol fokusable / 0 tanpa nama; inventory 16 / 0;
settings 24 kontrol, satu-satunya elemen tanpa nama = 2 `input[type=file]`
`class="hidden"` milik FileUpload (tidak fokusable, dipicu tombol berlabel).

**Console + server log:** bersih. Catatan: server yang sudah lama idle
mengakumulasi `TimeoutError` tanpa stack aplikasi; pada server fresh dengan
page load yang sama, nol timeout — bukan berasal dari render halaman.

**Reduced motion:** aturan `@media (prefers-reduced-motion: reduce)` diverifikasi
ada di globals.css:514 (mematikan animation + transition + `.dash-reveal`).
Media state ini TIDAK bisa diemulasi lewat tooling Browser pane yang tersedia,
jadi verifikasi bersifat statis, bukan runtime.
