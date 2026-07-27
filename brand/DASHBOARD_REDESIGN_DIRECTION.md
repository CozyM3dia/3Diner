> # ⛔ DEPRECATED per 2026-07-27 — JANGAN DIPAKAI SEBAGAI ARAHAN
>
> Dokumen ini adalah **penyebab langsung** dashboard yang terasa generik.
>
> **Kesalahannya:** menyerahkan **STRUKTUR** ("Use Efferd dashboard 8 as the dashboard
> foundation" — beserta page structure, metric hierarchy, chart and list composition,
> right-side attention panel) sambil hanya melindungi **PERMUKAAN** (palette, logo,
> language, data model, routes).
>
> Struktur adalah satu-satunya lapisan yang bisa dimodelkan mesin, jadi lapisan itu
> otomatis terisi — oleh satu screenshot yang kebetulan ada. Perlindungan di lapisan
> permukaan tidak pernah diuji, karena memang tidak ada yang mengancamnya.
>
> Bagian **"Required Homepage Sections"** di bawah berisi 10 butir wajib. **Itulah asal
> 10 kartu KPI seragam** yang jadi keluhan utama.
>
> **Pengganti:** `brand/LAYOUT_CONTRACT.md` (belum ditulis — lihat metodologi B7 di
> `docs/audit/2026-07-27-pos-rebuild-keputusan.md` §6).
>
> **Arahan yang berlaku sekarang:** `docs/audit/2026-07-27-usulan-ia-dashboard.md`.
>
> Isi di bawah dipertahankan sebagai catatan sejarah, bukan sebagai instruksi.
> Dokumen sekerabat yang punya risiko sama dan perlu diaudit:
> `brand/MASTER_DASHBOARD_REBUILD_PROMPT.md`, `App/docs/STITCH-DASHBOARD-REDESIGN-PROMPT.md`,
> `docs/stitch-rebuild/STITCH-PROMPT.md` — cari kalimat berpola
> "gunakan X sebagai fondasi/base/reference".

---

# 3Diner Dashboard Redesign Direction

## Base Reference

Use Efferd dashboard 8 as the dashboard foundation.

Efferd dashboard 8 should influence:

- Dashboard page structure.
- Metric hierarchy.
- Date-range toolbar.
- Operational summary cards.
- Chart and list composition.
- Right-side attention panel.
- Compact product-dashboard rhythm.

Efferd dashboard 8 must not replace:

- 3Diner color palette.
- 3Diner logo.
- 3Diner language.
- 3Diner data model.
- 3Diner routes.
- Existing dashboard features.
- Inventory integration.

## 3Diner Adaptation

The final dashboard should feel like:

- Cafe operations cockpit.
- Dark navy, high-signal, warm orange action.
- Premium F&B technology product.
- Calm and practical for daily use.

It should not feel like:

- Generic Efferd demo.
- Generic fintech analytics dashboard.
- Ecommerce template.
- Purple-blue AI SaaS.

## Required Dashboard Funnel

User flow:

1. User logs in.
2. User lands on `/dashboard`.
3. User immediately sees cafe health.
4. User sees sales, orders, engagement, and stock status.
5. User can act on inventory or orders in one click.
6. User can enter focused management pages from the sidebar or section CTAs.

## Required Homepage Sections

`/dashboard` must include:

- Today or selected-period overview.
- Main engagement metrics.
- Revenue or sales signal.
- 3D model performance.
- Order activity.
- Inventory health.
- Critical stock alerts.
- Recent inventory movements.
- Menu performance.
- Operational recommendations or attention list.

## Inventory Placement

Inventory must not be hidden as a separate page only.

Minimum on `/dashboard`:

- Stock health summary.
- Critical stock list.
- Inventory value.
- Recent movement list.
- CTA to manage inventory.

Ideal:

- Full embedded inventory workspace adapted to dashboard 8.

Keep `/dashboard/inventory` as a focused inventory page when available.

## Desktop Layout Direction

- Sidebar fixed on the left.
- Main content uses a max-width working canvas.
- Header has cafe context, date range, and primary action.
- First row: operational overview cards.
- Main grid: activity chart plus funnel/attention panel.
- Lower grid: inventory workspace, orders, menu performance, schedule/announcement status.

## Mobile Layout Direction

- Sidebar collapses.
- Header remains compact.
- Overview metrics stack into readable cards.
- Inventory appears after top performance summary.
- No clipped metric values.
- No horizontal overflow.
- CTAs remain visible and finger-friendly.

## Color Direction

Use tokens from:

`C:\Kerja\3Diner\brand\UI_TOKENS.md`

Dark dashboard baseline:

- Canvas `#060E1B`
- Sidebar `#0B1728`
- Panel `#0D1829`
- Raised `#132136`
- Orange `#FD5002`
- Teal `#00C2A8`

Orange is a signal. Use it for primary CTA, active navigation, key highlights, and chart emphasis.

## Final UI Audit

Before shipping, verify:

- Dashboard still uses 3Diner logo and palette.
- Inventory is visible on `/dashboard`.
- All existing features still work.
- Routes are preserved.
- Server actions still work.
- Supabase integration is untouched unless explicitly needed.
- Desktop and mobile layouts are visually polished.
- No AI slop patterns are present.
