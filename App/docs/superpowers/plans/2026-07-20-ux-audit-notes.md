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

## Browser QA (390/768/1024/1280/1440)

Dashboard butuh login owner — QA browser interaktif menunggu user login di
Browser pane (`preview_start` name `3diner-app`, port 3000). Checklist yang
akan dijalankan setelah login: overflow horizontal (JS check), keyboard pass
per route, console bersih, reduced-motion.
