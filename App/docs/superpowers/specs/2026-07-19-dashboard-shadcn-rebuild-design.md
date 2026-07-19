# 3Diner Dashboard x shadcn/ui x Framer Motion - Design Spec

Date: 2026-07-19
Status: Approved by owner (targeted adoption + Sonner global), revised with
owner review corrections (portal tokens, dynamic test gate, LazyMotion contract,
lint scope, motion ownership, responsive a11y contract, toast dedupe,
Transitions.dev policy, explicit deploy verification).

## Goal

Rebuild the authenticated 3Diner dashboard on a shadcn/ui component foundation
with Framer Motion for state-communicating interaction motion, preserving 100%
functional parity: Supabase behavior, routes, server actions, auth, realtime
orders, menu drag-reorder, AI extraction, Tripo 3D generation, inventory,
QR Smart Menu exports, and the perf characteristics of the recent navigation
work.

## Approach: Targeted Adoption

Not a wholesale rewrite. shadcn primitives are adopted where they add real
capability; the recently rebuilt brand layout (command center, dash-panel
language, Poppins, perf nav) is formalized into a reusable component system on
top of them.

## 1. Foundation (Phase 1)

- `npx shadcn@latest init` with guards: back up `src/app/globals.css` first,
  review the diff, merge manually. Existing 3Diner tokens must not be
  overwritten.
- `components.json` aliases match the existing structure (`@/components`,
  `@/lib`).
- Token adapter scoped to `.dash-root`: shadcn variables (`--background`,
  `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`,
  `--destructive`, `--border`, `--input`, `--ring`, `--radius`) map to 3Diner
  dashboard tokens (canvas/sidebar/panel/raised, orange, dash-border, radius
  10-16px, orange ring). Font stays Poppins; no Geist/Inter is introduced.
- Portal token rule: tokens scoped only to `.dash-root` do not reach portals
  rendered to `body`. Therefore: all dashboard portals (`Dialog`,
  `AlertDialog`, `Sheet`, `Popover`, `Tooltip`, Sonner `Toaster`) must render
  into a dashboard portal root that lives inside `.dash-root` (a dedicated
  `<div id="dash-portal-root">` mounted by `DashboardShell`, with the token
  adapter class applied), or must receive the dashboard token class explicitly
  on their portal container prop. Customer pages must never receive dashboard
  tokens.
- Sonner `Toaster` mounted once in `DashboardShell`, styled to brand (panel
  surface, hairline border, Poppins, semantic accent per toast kind).
- LazyMotion contract:
  `import { LazyMotion, domAnimation, m } from "framer-motion"` - one
  `LazyMotion` wrapper in `DashboardShell`; all dashboard motion uses `m.*`
  elements inside it. `motion.*` imports are not used in dashboard code
  (bundle-size optimization); lint/code-review gate enforces this.
- Motion ownership rule: project-authored motion uses Framer Motion. Never
  combine Framer animation with the default CSS animation on the same
  primitive. Disable shadcn CSS animation when Framer controls Sheet/Dialog.
  Sonner keeps its own transition and must not be wrapped in AnimatePresence.

## 2. Component System (Phase 2)

New `src/components/dashboard/system/`:

| Component | Job |
|---|---|
| `DashboardPageHeader` | Title + subtitle + action slot; replaces per-page header copies |
| `DashboardPanel` | Formalizes `.dash-panel` + head band + body |
| `DashboardMetric` | KPI card (basis: current StatCard behavior incl. count-up) |
| `DashboardToolbar` | Search/filter/action rows above data views |
| `DashboardEmptyState` / `DashboardLoadingState` / `DashboardErrorState` | Consistent skeletons and states, layout-matched |
| `StatusBadge` | One vocabulary for order/payment/inventory states (color + label + dot, never color-only) |
| `ResponsiveDataView` | Generalized desktop-table <-> mobile-card pattern (from MenuTable) |
| `ConfirmAction` | AlertDialog wrapper for destructive actions |
| Form field patterns | Label + Input/Textarea/Select in dash language |

ResponsiveDataView accessibility contract: only the active responsive
representation may be visible, focusable, and exposed to assistive technology.
Never produce duplicate IDs, labels, form controls, or actions between desktop
table and mobile cards.

Shell changes: mobile sidebar -> shadcn `Sheet`; icon-only buttons get
`Tooltip`; shell hosts LazyMotion, Sonner Toaster, and the dashboard portal
root.

## 3. Page Re-base (Phases 3-6)

Order: Analytics + Revenue -> Menu + Inventory -> Orders + Announcements +
Scheduler -> Settings + QR Smart Menu.

Per page: swap ad-hoc markup to system components; business logic untouched.
Specifics:

- OrdersClient: custom new-order toast migrates to Sonner (same chime, same
  card content); realtime subscription, status advance, receipt iframe print
  unchanged; receipt modal gets a `Dialog` shell. Toast dedupe: every realtime
  toast uses a Sonner `id` derived from the order ID so repeated realtime
  events never produce duplicate toasts or duplicate chimes.
- MenuTable: drag-reorder, sort, search, dual-layout behavior unchanged;
  presented through `ResponsiveDataView` + `StatusBadge`, honoring the
  accessibility contract above.
- MenuForm/SettingsForm/AnnouncementForm: field patterns + `ConfirmAction` for
  delete; AI auto-fill, uploads, Tripo generator untouched.
- QR Smart Menu: functionality preserved exactly (canonical URL, preview, copy,
  open, PNG >= 2048px, vector SVG, customization, EC-H logo rules); disclosure
  may use `Collapsible`.
- DateRangePicker: internals kept (fixed-position + URL params); only the
  trigger is restyled. Migration to Popover+Calendar is an explicit non-goal.

## 4. Motion System

- `m.*` inside `LazyMotion(domAnimation)`; `useReducedMotion` respected.
- Catalog: Sheet in/out ~200ms; Dialog fade+scale 0.98 -> 1 ~180ms;
  `AnimatePresence` for filter/list state changes (never around Sonner);
  skeleton -> content fade; success check morph on save. 150-220ms,
  ease-out-quart, transform+opacity only.
- Transitions.dev is a reference library only. Recreate approved patterns
  through Framer Motion. Do not install another motion runtime.
- Forbidden: load choreography, bounce/elastic, pulsing loops, animated layout
  properties, decorative chart/QR animation, double animation (Framer + CSS on
  the same primitive).

## 5. Test & QA Gates (per phase)

- Dynamic test gate: all pre-existing baseline tests must keep passing, plus
  every new test added in each phase. No hardcoded totals; the gate is
  `npm test -- --run` fully green at every phase boundary.
- Lint gate: changed files and dashboard scope must have zero lint errors.
  Global lint must produce no new errors compared with the recorded baseline.
  Existing errors outside dashboard scope are reported separately, never
  hidden. Never suppress rules to pass.
- New tests: token adapter presence on portal root, StatusBadge state mapping,
  ResponsiveDataView breakpoint rendering + single-active-representation
  contract, Sonner order-toast migration + dedupe by order ID.
- Every phase: `tsc --noEmit`, full suite, lint per gate above, prod build,
  browser QA (390/768/1024/1280/1440), console free of hydration/runtime
  errors, no horizontal overflow, keyboard navigation, reduced-motion.

## 6. Delivery

- Branch `feature/dashboard-shadcn-rebuild`; small commits per phase.
- PR to `main`; merge only when all gates pass.
- Deploy: `npx vercel deploy --prod --cwd C:\Kerja\3Diner\App`, then verify the
  deployment reports `READY` status before claiming success. (If the `--cwd`
  form ever produces a wrong project path, fall back to running the deploy from
  the repo root `C:\Kerja\3Diner`, which is the previously verified working
  form; record whichever form succeeded.)
- Git push does not auto-deploy; deploy is always CLI-driven.

## Non-goals

DB schema, server actions, API routes, customer-facing routes, 3D viewer
(GSAP), DateRangePicker internals, auth flow. Customer pages never receive
dashboard tokens. Pre-existing lint errors outside dashboard scope are
reported, not fixed here.
