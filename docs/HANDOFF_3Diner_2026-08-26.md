# HANDOFF_3Diner_2026-08-26.md

## Status: Phase 0 — Foundation ✅ SELESAI & TERVERIFIKASI

**Verifikasi akhir (26 Aug):** 62 file / 564 test PASS · typecheck bersih · eslint semua file tersentuh nol temuan · **production build sukses**.
**Catatan insiden:** subagent worker-2 kena 429 upstream di tengah tugas (OwnerShell); sisa kerjanya dituntaskan langsung oleh orchestrator tanpa retry subagent (prosedur skill ox-alpha-rate-limit). Worker-1 sukses normal.

**Rencana induk:** `docs/DASHBOARD-REBUILD-PLAN.md` · **Eksekusi:** `docs/DASHBOARD-IMPLEMENTATION-PLAN.md` (hasil audit 26 Aug; Tripo ditunda, UI 1:1 Dream POS)

### Selesai di Phase 0 (26 Aug)

| Item | File | Catatan |
|---|---|---|
| Fix `role:null` conflation | `App/src/lib/staff-context.ts`, `App/src/types/index.ts`, `App/src/lib/auth-routing.ts`, `App/src/app/login/page.tsx` | `StaffContext.error?: boolean`; `resolveHomeRoute()` kini mengembalikan `{home, reason}` dengan 3 alasan terpisah (`bukan-staf`/`nonaktif`/`gagal-muat`); login tidak lagi signOut saat RPC gagal — pesan "coba lagi"; error `role="alert"` |
| Guard server-only | `App/src/lib/supabase-admin.ts` + dep `server-only` | Impor dari client component kini gagal build. Placeholder env DIPERTAHANKAN — CI sengaja set placeholder (ci.yml) & vitest tidak baca .env; membuangnya mematahkan build/test. Stub vitest: `tests/stubs/server-only-empty.js` + alias di `vitest.config.ts`. Kontrak env didokumentasikan di komentar file |
| Skala token dv2 | `App/src/app/globals.css` (blok akhir) | `--dv2-space-1..8`, `--dv2-z-scrim/sheet`, `--dv2-fs-*`; CSS pill/sheet/icon-btn/field/focus-ring |
| Primitive konsol | `App/src/components/dashboard-v2/primitives.tsx` | Tabs (counter), StatusPill (--pill var), SlideOver (Radix: Escape/scrim/focus trap), EmptyState, Field (role=alert). Tanpa hex baru — semua var(--dash-*)/semantic |
| Shell responsive | `App/src/components/dashboard-v2/OwnerShell.tsx` + blok "Phase 0c" globals.css | Hamburger ≤768px (aria-expanded/controls, Escape, klik-luar via pointerdown, tutup saat pindah rute dengan pola adjust-during-render — bukan effect-setState); desktop >768px tidak berubah |
| Pemisahan client/server lib | `dashboard-v2-{orders,stock,menu,reports}[-view].ts` + retarget impor di OrdersTable/OrderDetailSheet/StockTable/MenuTableV2/BarSeries | Guard server-only MENEMUKAN 4 kebocoran nyata: helper view murni dipisah ke `*-view.ts` (client-safe), modul lama jadi lapisan data murni (re-export menjaga kompatibilitas). Pola wajib untuk modul baru Phase 1+ |
| DESIGN.md diperluas | `DESIGN.md` | Section baru "Owner Console Design": token contract + tabel primitives + auth/error semantics |
| Test baru | `staff-context-shape` (4), `auth-routing-rejection` (5), `dv2-primitives` (9), `owner-shell-responsive` (4) = 22 test | Semua jsdom test pakai pragma environment + afterEach(cleanup) |

### Next steps (Phase 1 — Beranda & Pesanan)

1. Rebuild Beranda: KPI strip operasional, ringkasan antrean read-only + CTA `/kasir`, task list, activity feed — pakai primitives dv2.
2. Rebuild Pesanan: tabs riwayat (Semua/Selesai/Dibatalkan), filter status/payment/tipe/tanggal/search, list/grid toggle, slide-over detail (pakai SlideOver).
3. Gate Phase 1: grep bukti tidak ada mutasi status order dari dashboard-v2.

### Keputusan berjalan yang mengikat

- UI mengikuti template Dream POS 1:1; fitur tanpa padanan (generate 3D, menu 3D/AR, AI workflow) dirancang dalam bahasa visual template (modal/badge-pill/kartu/tab-counter) — §0.1b implementation plan.
- Tripo API **tidak diimpor**; upload manual GLB/USDZ fungsional; nol call `/api/tripo/*` di v2 (dicek grep saat gate Phase 2).
- Lampiran A stok basi sebagian (adjustStock sudah ada di v2); gap nyata: InventoryItemForm + movement history.
- Dual-path plumbing (revalidatePath legacy+v2, retarget link) = item eksplisit Phase 2.

### Gotchas lingkungan

- App root = `C:\Kerja\3Diner\App` (bukan repo root); terminal tool = git-bash.
- RTL tanpa setup global → WAJIB `afterEach(cleanup)` + pragma `// @vitest-environment jsdom` per file test komponen.
- CI lint ratchet: hanya file yang disentuh; main masih bawa ~39 error eslint legacy.
