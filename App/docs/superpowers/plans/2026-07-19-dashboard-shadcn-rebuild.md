# 3Diner Dashboard shadcn Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the authenticated 3Diner dashboard on shadcn/ui primitives + Framer Motion with 100% functional parity, per the approved spec `docs/superpowers/specs/2026-07-19-dashboard-shadcn-rebuild-design.md`.

**Architecture:** Targeted adoption. shadcn init with a `.dash-root`-scoped token adapter and an in-tree portal root; a reusable `system/` component layer formalizes the existing brand language; pages are re-based onto that layer one phase at a time with test gates between phases.

**Tech Stack:** Next.js 16 App Router, React 19, TS, Tailwind v4, shadcn/ui, framer-motion 12 (LazyMotion + m), Sonner, Supabase, vitest + testing-library.

## Global Constraints (from spec — apply to every task)

- Never touch: DB schema, server actions signatures, API routes, customer routes, auth, 3D viewer, DateRangePicker internals.
- All dashboard portals render into `#dash-portal-root` (a div with class `dash-portal-root`, NOT `dash-root`, to avoid nested-root layout side effects; the token adapter selector covers both classes). Customer pages never receive dashboard tokens. shadcn ui primitives may receive ONLY a `container` prop passthrough on their Portal; their animation/focus/lifecycle code is never modified.
- Motion ownership (single owner per primitive): Radix/shadcn primitives (Sheet, Dialog, AlertDialog, Popover, Tooltip) KEEP their built-in shadcn CSS animations; Framer Motion is used only for project-authored motion (list/filter state, reveals, feedback, skeleton-to-content). Never both on one primitive. Sonner keeps its own transition, never wrapped in AnimatePresence. Framer usage: `import { LazyMotion, domAnimation, m } from "framer-motion"`; `motion.*` forbidden in dashboard code — enforced by a grep check in the hardening task plus code review (`LazyMotion strict` additionally throws at runtime if a `motion.*` component renders inside it; it is NOT a lint substitute). 150-220ms, ease-out-quart, transform+opacity only. `useReducedMotion` respected.
- Colors/typography: existing dash tokens only, Poppins only, orange scarce, no gradients/glass/pure black/white.
- Test gate per task: `npm test -- --run` fully green (baseline + new). Lint gate: zero errors in changed files/dashboard scope; global lint no new errors vs baseline; never suppress rules.
- ResponsiveDataView contract: only the active representation visible/focusable/exposed to AT; no duplicate IDs/labels/controls between table and cards.
- Sonner order toasts: `id` derived from order ID (dedupe).
- Touch targets >= 44px. WCAG AA. aria-live for copy/save/export/errors.
- Commits small per task on branch `feature/dashboard-shadcn-rebuild`.
- Deploy (final only): `npx vercel deploy --prod --cwd C:\Kerja\3Diner\App`, verify READY; fallback: run from repo root `C:\Kerja\3Diner` (previously verified) and record which form worked.

---

### Task 0: Record lint baseline (reproducible)

**Files:** Create: `docs/superpowers/plans/lint-baseline-2026-07-19.txt` (human-readable), `docs/superpowers/plans/lint-baseline-2026-07-19.json` (machine-comparable)

- [ ] From `C:\Kerja\3Diner\App` run both: `npx eslint src > lint-baseline txt` AND `npx eslint src --format json > lint-baseline json`; append to the txt a summary line with exit code + total errors + total warnings. The JSON (file/line/ruleId) is the objective base for the "no new global lint errors" comparison in Task 9 (`compare: same or fewer errors per rule per file; any new file:rule pair = failure`). Commit both.

### Task 1: shadcn init + token adapter + portal root

**Files:**
- Create: `components.json` (via CLI), `src/components/ui/*` (only: button, dialog, alert-dialog, sheet, tooltip, popover, collapsible, sonner), `src/lib/utils.ts` (cn helper, via CLI)
- Modify: `src/app/globals.css` (append adapter; NOTHING existing removed), `src/components/dashboard/DashboardShell.tsx`
- Test: `tests/dash-token-adapter.test.ts`

**Interfaces:**
- Produces: shadcn variable mapping on selector `.dash-root, .dash-portal-root`; `<div id="dash-portal-root" className="dash-portal-root">` inside DashboardShell (dedicated class — never `dash-root`, to prevent nested dashboard roots); exported const `DASH_PORTAL_ID = "dash-portal-root"` from `src/components/dashboard/system/portal.ts` plus `getDashPortal(): HTMLElement | null` returning `document.getElementById(DASH_PORTAL_ID)`. Poppins font rule also covers `.dash-portal-root`.

- [ ] **Step 1:** Backup CSS: `Copy-Item src/app/globals.css src/app/globals.css.bak`
- [ ] **Step 2:** `npx shadcn@latest init` (style: default asks — pick base color neutral, CSS variables yes). Inspect diff of globals.css; restore any removed existing content from `.bak`; keep shadcn's `@theme`/vars additions BELOW existing tokens. Delete `.bak` after verified.
- [ ] **Step 3:** Add only needed components: `npx shadcn@latest add button dialog alert-dialog sheet tooltip popover collapsible sonner`
- [ ] **Step 4:** Append adapter to `globals.css`:

```css
/* == shadcn token adapter: dashboard scope only == */
.dash-root {
  --background: var(--dash-canvas);
  --foreground: var(--dash-text);
  --card: var(--dash-panel);
  --card-foreground: var(--dash-text);
  --popover: var(--dash-panel);
  --popover-foreground: var(--dash-text);
  --primary: var(--orange);
  --primary-foreground: #FDFDFD;
  --secondary: var(--dash-raised);
  --secondary-foreground: var(--dash-text);
  --muted: var(--dash-raised);
  --muted-foreground: var(--dash-muted);
  --accent: var(--dash-raised);
  --accent-foreground: var(--dash-text);
  --destructive: var(--semantic-danger);
  --border: var(--dash-border);
  --input: rgba(255,255,255,0.1);
  --ring: var(--orange);
  --radius: 10px;
}
```

- [ ] **Step 5:** Create `src/components/dashboard/system/portal.ts`:

```ts
export const DASH_PORTAL_ID = "dash-portal-root";
export function getDashPortal(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(DASH_PORTAL_ID);
}
```

- [ ] **Step 6:** In DashboardShell root div, append `<div id={DASH_PORTAL_ID} className="dash-root" />` as last child (inside the `.dash-root` wrapper).
- [ ] **Step 7:** Write failing test `tests/dash-token-adapter.test.ts` (jsdom): render DashboardShell with a null cafe and children, assert `document.getElementById("dash-portal-root")` exists and has class `dash-root`; assert globals.css source (read file via fs) contains `.dash-root {` adapter block with `--ring: var(--orange)`.
- [ ] **Step 8:** Run `npx vitest run tests/dash-token-adapter.test.ts` — PASS after wiring. Full gate: `npx tsc --noEmit`, `npm test -- --run`, scoped eslint, `npm run build`.
- [ ] **Step 9:** Commit `feat(dashboard): shadcn foundation with dash-scoped token adapter and portal root`.

### Task 2: LazyMotion + Sheet sidebar + Tooltip + Sonner in shell

**Files:**
- Modify: `src/components/dashboard/DashboardShell.tsx`, `src/components/ui/sheet.tsx` (portal container + strip CSS animation classes), `src/components/ui/tooltip.tsx`, `src/components/ui/sonner.tsx`
- Test: `tests/dashboard-shell-shadcn.test.tsx`

**Interfaces:**
- Consumes: `DASH_PORTAL_ID`, `getDashPortal` from Task 1.
- Produces: shell wraps children in `<LazyMotion features={domAnimation} strict>`; `<Toaster/>` mounted once; mobile sidebar rendered via `Sheet` whose `SheetPortal` uses `container={getDashPortal()}`; Sheet slide handled by `m.div` (Framer), shadcn CSS animation classes removed from the sheet content wrapper.

- [ ] **Step 1:** Wrap shell: `import { LazyMotion, domAnimation } from "framer-motion"` — `<LazyMotion features={domAnimation} strict>` around the whole shell tree (`strict` throws if any `motion.*` renders inside — a runtime tripwire, not the enforcement mechanism; enforcement = Task 8 grep + review).
- [ ] **Step 2:** Replace the hand-rolled mobile overlay+aside with a dashboard wrapper `DashSheet` (`src/components/dashboard/system/DashSheet.tsx`) built ON TOP of the untouched shadcn Sheet primitive: it renders `Sheet`/`SheetContent side="left"` with the same nav markup. `src/components/ui/sheet.tsx` receives ONLY a `container?: HTMLElement | null` prop passthrough to `SheetPortal` (Radix supports it) — no animation, focus, or lifecycle changes; shadcn CSS animation stays the single motion owner for the Sheet. Container resolves via `getDashPortal()` at open time (null-safe: fall back to default body portal if the node is not yet mounted).
- [ ] **Step 3:** Desktop sidebar unchanged (sticky aside). Nav pending/prefetch logic unchanged.
- [ ] **Step 4:** Mount `<Toaster position="top-right" />` from `src/components/ui/sonner.tsx`, styled: toast background `var(--dash-panel)`, border `var(--dash-border)`, text `var(--dash-text)`, font Poppins. Do NOT wrap in AnimatePresence.
- [ ] **Step 5:** Icon-only buttons in shell (hamburger, close) get `Tooltip` (portal container = dash portal) + keep aria-labels.
- [ ] **Step 6:** Test `tests/dashboard-shell-shadcn.test.tsx`: renders shell, asserts single Toaster region exists, asserts hamburger button has accessible name, asserts nav links all present (8 hrefs) — protects parity.
- [ ] **Step 7:** Full gate + browser QA (mobile 390: sheet opens/closes, focus trapped, Escape closes). Commit `feat(dashboard): shell on LazyMotion + Sheet sidebar + Sonner + tooltips`.

### Task 3: System components

**Files:**
- Create: `src/components/dashboard/system/DashboardPageHeader.tsx`, `DashboardPanel.tsx`, `DashboardMetric.tsx`, `DashboardToolbar.tsx`, `DashboardStates.tsx` (Empty/Loading/Error), `StatusBadge.tsx`, `ResponsiveDataView.tsx`, `ConfirmAction.tsx`, `fields.tsx`, `index.ts` (barrel)
- Test: `tests/dashboard-system.test.tsx`

**Interfaces (Produces — later tasks import from `@/components/dashboard/system`):**

```ts
DashboardPageHeader({ title, subtitle?, eyebrow?, actions?, className? })
DashboardPanel({ title?, icon?, actions?, children, className?, bodyClassName?, id? })  // title -> head band
DashboardMetric(props identical to current StatCard: { value, label, icon, accent, accentBg, delta?, sub?, suffix?, prefix? })
DashboardToolbar({ children, className? })  // flex row, panel-top border treatment
DashboardEmptyState({ icon?, title, hint?, action? })
DashboardErrorState({ title, hint? })
StatusBadge({ kind: "order-received"|"order-preparing"|"order-ready"|"pay-cash"|"pay-qris"|"pay-unpaid"|"inv-ready"|"inv-low"|"inv-none"|"active"|"inactive"|"threeD", label?: string })
ResponsiveDataView({ table: () => ReactNode, cards: () => ReactNode, breakpoint?: "lg" })
  // Render FUNCTIONS, not nodes. Before hydration/mode detection (SSR + first
  // paint): both branches render inside CSS-breakpoint containers where the
  // inactive branch is display:none (`hidden lg:block` / `lg:hidden`) —
  // display:none already removes it from focus order and the accessibility
  // tree. After matchMedia resolves, ONLY the active branch stays mounted
  // (inactive branch unmounted entirely) — no inert dependency, no duplicate
  // controls in the DOM. Render functions must namespace any ids they
  // generate (accept an `idPrefix` argument) so the brief dual-render phase
  // never produces duplicate ids.
ConfirmAction({ trigger, title, description, confirmLabel, onConfirm, destructive? })  // AlertDialog, portal container = dash portal
Field({ label, hint?, htmlFor?, children })  // matches existing SettingsForm Field
```

- [ ] **Step 1:** Write failing tests first in `tests/dashboard-system.test.tsx`: StatusBadge maps every `kind` to expected label text + never renders color-only (asserts a text node + dot span exists); ResponsiveDataView renders both containers with correct classes and applies `inert`/`aria-hidden` to the inactive one under mocked `matchMedia` (desktop and mobile cases); ConfirmAction calls `onConfirm` after confirm click and not after cancel.
- [ ] **Step 2:** Implement components. StatusBadge palette: received=orange, preparing=amber, ready/success=`#22D3A6`, qris/threeD=`#00C2A8`, unpaid/none/inactive=muted, low=amber. Dot + label always.
- [ ] **Step 3:** ResponsiveDataView mode hook (unmount strategy, no inert):

```tsx
"use client";
function useIsDesktop(bp = "(min-width: 1024px)") {
  const [is, setIs] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(bp);
    const on = () => setIs(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return is; // null = mode unknown (SSR/first paint)
}
// mode null  -> render both branches, inactive hidden via CSS breakpoint
//               classes (display:none = out of focus order + a11y tree)
// mode known -> render ONLY the active branch (other unmounted)
```

- [ ] **Step 4:** Run tests PASS. Full gate. Commit `feat(dashboard): reusable system component layer`.

### Task 4: Re-base Analytics + Revenue (Phase 3)

**Files:** Modify: `src/app/dashboard/page.tsx`, `src/app/dashboard/revenue/page.tsx`, `src/app/dashboard/loading.tsx`, `src/app/dashboard/revenue/loading.tsx`

- [ ] Replace hand-rolled header blocks with `DashboardPageHeader`, `.dash-panel` sections with `DashboardPanel` (head band = existing titles), StatCard call sites with `DashboardMetric` (same props; StatCard stays until Task 8 removal), status dots in "Pesanan Terbaru"/recent lists with `StatusBadge`. No data-flow edits. Skeletons via `DashboardLoadingState` blocks matching layout.
- [ ] Gate + browser QA desktop/mobile. Commit `refactor(dashboard): analytics + revenue on system components`.

### Task 5: Re-base Menu + Inventory (Phase 4)

**Files:** Modify: `src/components/dashboard/MenuTable.tsx`, `src/app/dashboard/menu/page.tsx`, `src/components/dashboard/InventoryWorkspace.tsx`, `src/components/dashboard/InventoryTable.tsx`, `src/app/dashboard/inventory/page.tsx`; Tests: extend `tests/menu-table-inventory.test.ts` expectations only if markup contract changes (labels stay identical).

- [ ] MenuTable: wrap existing table/cards in `ResponsiveDataView` (its current `hidden lg:block` / `lg:hidden` classes move into the component); InventoryBadge/Badge3D replaced by `StatusBadge` kinds `inv-*`/`threeD` keeping EXACT label strings ("Resep aktif", "Stok kurang", "Tanpa resep") so baseline tests pass; drag/sort/search logic untouched.
- [ ] Inventory: Summary cards -> `DashboardMetric` style; headers -> `DashboardPageHeader`; StockAdjustmentModal + RecipeEditor dialogs -> shadcn `Dialog` shells (portal = dash portal, Framer-controlled transitions, CSS animations stripped), internal logic untouched.
- [ ] Gate (menu-table tests green unchanged) + browser QA incl. drag reorder + stock adjust roundtrip. Commit `refactor(dashboard): menu + inventory on system components`.

### Task 6: Re-base Orders + Announcements + Scheduler (Phase 5)

**Files:** Modify: `src/components/dashboard/OrdersClient.tsx`, `src/components/dashboard/AnnouncementForm.tsx`, `src/components/dashboard/SchedulerClient.tsx`; Test: `tests/orders-sonner.test.tsx`

- [ ] **Orders toast -> Sonner:** replace custom toast portal with `toast.custom(..., { id: order.id_order })` — same card content, chime logic unchanged and fired only when a NEW id appears (dedupe guard: keep a `Set<string>` of seen order ids; skip toast+chime if seen). Write failing test first: mock sonner `toast.custom`, emit same order event twice, assert called once with `id: "order-1"` and chime fn called once.
- [ ] Order cards -> `DashboardPanel` variant + `StatusBadge` (order-* and pay-* kinds); filter row -> `DashboardToolbar`; ReceiptModal -> `Dialog` shell (iframe print body unchanged).
- [ ] AnnouncementForm / SchedulerClient: `Field` patterns, `StatusBadge` for live "Tampil/Tersembunyi", section panels -> `DashboardPanel`. Server action calls + state logic untouched.
- [ ] Realtime resilience: surface Supabase channel disconnect/reconnect via a single Sonner warning toast (id "realtime-status", so it never stacks) — subscribe status callback already available on the existing channel object; no data-flow change.
- [ ] Gate + browser QA: realtime insert produces one toast + one chime, receipt print works, scheduler save works. Commit `refactor(dashboard): orders on Sonner + announcements + scheduler on system components`.

### Task 7: Re-base Settings + QR (Phase 6)

**Files:** Modify: `src/components/dashboard/SettingsForm.tsx`, `src/components/dashboard/QrSmartMenu.tsx`

- [ ] SettingsForm: `Field` + `DashboardPanel` + `ConfirmAction` where destructive (none currently — skip if N/A). Upload + preview logic untouched.
- [ ] QrSmartMenu: disclosure -> `Collapsible` (its own animation owner, or none), chips -> shadcn `Button` variant secondary with existing 44px minHeight, everything else (matrix, exports, EC-H, aria-live) untouched. All existing QR tests must stay green unchanged (dynamic gate — no hardcoded counts).
- [ ] Gate + browser QA (copy/downloads still fire). Commit `refactor(dashboard): settings + QR on system components`.

### Task 8: Hardening + cleanup + UX audit (Phase 7)

- [ ] Remove now-unused code: old StatCard (if fully replaced), old custom toast markup, dead CSS classes — only after `grep` proves zero references.
- [ ] Motion audit: grep dashboard for `from "framer-motion"` — only `LazyMotion|domAnimation|m|AnimatePresence|useReducedMotion` imports allowed; no `motion.` in dashboard files.
- [ ] Cross-phase UX audit gate (explicit, per owner review):
  - Numeric/monetary alignment: all currency, counts, and metric columns right-aligned with `tabular-nums`; verify on analytics, revenue, orders, menu, inventory.
  - Progressive disclosure: advanced/rare controls collapsed by default (QR customization, scheduler per-menu detail); nothing important hidden behind hover-only.
  - Tooltip coverage: EVERY icon-only control across all routes (not just sidebar) has Tooltip + accessible name.
  - Onboarding/first-run: every empty state (no menus, no orders, no inventory, no announcements) teaches the next action via `DashboardEmptyState` with a concrete CTA.
  - Degraded states: realtime disconnected (Task 6 toast), partial data (inventory `failedLoads` pattern preserved), session expired (middleware redirect verified), export/save failure copy present. Document any state that cannot be simulated.
- [ ] Responsive QA at 390/768/1024/1280/1440: no horizontal overflow (JS check), no clipped text. Keyboard pass on every route. Reduced-motion pass (matchMedia mock in tests + manual). Console clean.
- [ ] Full gate. Commit `polish(dashboard): hardening pass`.

### Task 9: Delivery (Phase 8)

- [ ] Full suite + lint compare vs `lint-baseline-2026-07-19.json` (objective diff: no new file:rule error pairs) + `npm run build`.
- [ ] Push branch, open PR to main via `gh pr create` (title: "Dashboard rebuild: shadcn foundation + Framer Motion"; body: parity checklist + gates). Merge when green.
- [ ] After merge: checkout main, pull, deploy `npx vercel deploy --prod --cwd C:\Kerja\3Diner\App`; verify READY (fallback: repo root form; record which). Verify /dashboard routes live.
- [ ] Final report per spec section.

## Self-Review Notes

- Spec coverage: foundation (T1), motion ownership (T2/T5/T7 strip CSS anims), portal rule (T1/T2/T5/T6 ConfirmAction/Dialog containers), system layer (T3), all 10 routes covered (T4-T7; menu/new + menu/[id]/edit inherit MenuForm untouched — form re-base limited to Field pattern reuse, logic untouched), Sonner dedupe (T6 test), a11y contract (T3 test), dynamic test gate (every task), lint baseline (T0), delivery+deploy verify (T9).
- Labels preserved exactly where baseline tests assert text ("Resep aktif", "Stok kurang", "Tanpa resep", "Daftar menu").
- Type consistency: StatusBadge kinds enumerated once (T3) and referenced by kind names in T5/T6.
