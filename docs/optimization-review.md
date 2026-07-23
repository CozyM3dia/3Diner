# 3Diner — Codebase & Repo Optimization Review

Reviewed at `643ad4f` (main, 23 Jul 2026). Findings are ordered by impact, not by
effort. Each one states how it was verified so it can be re-checked later.

Two items are **fixed in the PR that carries this document**; the rest are open.

---

## P0 — Security and cost

### 1. Public AI routes burning the server's Gemini quota — FIXED

`/api/menu/extract` (`maxDuration = 60`) and `/api/menu/generate-details`
(`maxDuration = 30`) called `generativelanguage.googleapis.com` with the
server's `GEMINI_API_KEY` and had **no session check**. Both are only ever
called from owner-only dashboard components (`MenuExtractor.tsx:93`,
`MenuForm.tsx:104`), so anyone who knew the path could POST a PDF in a loop and
bill the project.

The four sibling Tripo routes already gated on `getAuthCafeId()`. These two now
do the same, before the API key is even read.

Covered by `App/tests/menu-ai-route-auth.test.ts`.

### 2. No rate limiting anywhere

Verified: `grep -rln "rateLimit\|ratelimit\|Ratelimit" src` returns nothing.

Remaining unauthenticated routes, by design:

| Route | Public because | Exposure |
|---|---|---|
| `POST /api/orders` | customers order from the QR menu | writes rows via `create_order_with_inventory` RPC — unbounded row creation |
| `POST /api/payment/charge` | customer checkout | creates Midtrans transactions |
| `GET /api/payment/qr-proxy` | renders the QRIS image | outbound fetch per call |
| `POST /api/payment/webhook` | Midtrans callback | correctly signature-verified (`verifyMidtransSignature`) — not a concern |

`/api/orders` is the one that matters: a script can fill the orders table and
the owner's dashboard. Suggested fix is a per-IP + per-`cafeId` limiter
(Upstash Ratelimit, or a Postgres counter since Supabase is already there).

### 3. Service-role client used for ordinary reads

`supabaseAdmin` (the `SUPABASE_SERVICE_ROLE_KEY` client, which **bypasses RLS**)
backs 39 query sites, including every dashboard page and all of `analytics.ts`.
Tenant isolation therefore depends entirely on every call site remembering to
scope by `cafe_id` from `getAuthCafeId()` / `getDashboardCafeContext()`.

That is one forgotten `.eq("cafe_id", …)` away from cross-tenant data exposure,
and no database-level backstop would catch it. The durable fix is RLS policies
on `Cafes` / `Menus` / `Orders` keyed to the owner, with reads moved to the
anon client and `supabaseAdmin` reserved for genuine admin writes.

---

## P1 — Deploy weight

### 4. 118 MB of unreferenced 3D models in `public/`

```
44.6 MB  App/public/models/pixel-robot-original.glb
40.2 MB  App/public/models/sushi.ply
33.3 MB  App/public/models/tomatoes.ply
 5.2 MB  App/public/models/pixel-robot-15cm.glb
```

`grep -rhoE "/models/[A-Za-z0-9._-]+" src` finds **zero** references. The models
the app actually renders are served from Supabase storage
(`/storage/v1/object/public/models/pasta-*.glb`), as every script in
`App/scripts/` confirms.

Everything in `public/` ships with the deployment, so this is ~118 MB uploaded
on every Vercel build for files nothing requests. The `/models/:file*` cache
header in `next.config.ts:69` exists only to serve them.

### 5. `Asset/` is 78 MB of build sources in git

`.usdz`, `.glb`, a 3.3 MB `3diner-build-asset.zip`, and duplicated brand PNGs
(`brand/3diner-brand-board.png` and `Asset/build-asset/brand-design.png` and
`docs/stitch-rebuild/brand-design.png` are the same 1.4 MB image three times).

These are design sources, not app inputs. They belong in the storage bucket the
project already uses, or in Git LFS.

Together with #4 this is why the repo reports 121 MB on GitHub. Note that
deleting the files from `HEAD` shrinks deploys immediately but **not** the clone
size — the blobs stay in history unless it is rewritten.

---

## P1 — Client bundle

### 6. `framer-motion` is a dependency with no consumers

`DashboardShell.tsx:162` wraps the whole dashboard in
`<LazyMotion features={domAnimation} strict>`. Repo-wide there is **not one**
`<m.*>` element — `grep -rn "<m\." src` is empty, and `framer-motion` is
imported in exactly one file.

`strict` mode makes this even clearer: it exists to forbid `motion.*` in favour
of `m.*`, and neither is used. Every animation in the app is CSS keyframes
(e.g. `ord-toast-in` in `ExportReport.tsx:197`).

The provider and the dependency can both go. That is a package removal plus a
two-line edit, and it drops the lazily-loaded `domAnimation` feature bundle from
every dashboard route.

### 7. Three overlapping animation systems

`gsap` + `@gsap/react` (used in 2 files: `Menu3DTransitionLink.tsx`,
`Viewer3DPage.tsx`), `framer-motion` (0 real uses, see above), and
`tw-animate-css`. Dropping framer-motion leaves a coherent two: GSAP for the 3D
transitions, CSS/Tailwind for UI.

### 8. 61% of components are client components

55 of 90 `.tsx` files carry `"use client"`. Some is unavoidable (3D viewer,
dashboard interactivity), but several dashboard tables render server data and
could be split into a server shell plus a small client island.

---

## P2 — Data fetching

### 9. Every dashboard page is `force-dynamic`

All 11 pages under `src/app/dashboard/` export `dynamic = "force-dynamic"`, so
every navigation re-runs every Supabase query with no caching layer at all.
`revalidatePath` is already used correctly after mutations in
`dashboard-actions.ts`, which means the invalidation half of a cache strategy is
in place — the caching half is missing. Slow-changing reads (menus, cafe
settings, inventory catalogue) are the obvious candidates.

### 10. `select("*")` in 14 query sites

Listed in `src/app/dashboard/**`, `src/lib/data.ts`, `src/lib/supabase.ts`,
`src/lib/dashboard-inventory.ts`. Over-fetches every column including ones the
UI never renders, and makes it harder to notice when a sensitive column is added
to a table later.

---

## P2 — Repo hygiene

### 11. No CI, no dependency automation, no PR template — FIXED

There was no `.github/` directory at all. PRs #2, #3 and #4 all merged into
`main` with zero automated verification. This PR adds:

- `.github/workflows/ci.yml` — typecheck, test, lint, build on every PR and push to `main`
- `.github/dependabot.yml` — monthly grouped npm + actions updates, majors excluded
- `.github/pull_request_template.md` — mirrors the verification gate

`App/package.json` gains `typecheck` and `test:ci` scripts, because the existing
`test` script runs vitest in **watch mode** and would have hung a CI runner.

### 12. 37 eslint errors and 18 warnings on `main`

```
react-hooks/set-state-in-effect   OrderView, DateRangePicker, ExportReport, MenuExtractor, ARSession
@typescript-eslint/no-explicit-any  ARSession, DateRangePicker
"Cannot access variable before it is declared"  ARSession.tsx:75
```

`ARSession.tsx` (41 KB, the largest file in the repo) holds most of them,
including the genuinely suspicious use-before-declare.

Because of this backlog the CI lint step is a **ratchet**: it blocks only on
files a PR touches. Gating the whole tree would fail every PR on day one. The
backlog should be burned down separately, after which the step can be widened
to `npx eslint .`.

### 13. Stale branches

- `feature/inventory-core` — fully merged into `main`, safe to delete
- `feature/dashboard-shadcn-rebuild` — **not** an ancestor of `main`; either it
  holds unmerged work or it was superseded by the squash-merge of #2. Worth
  confirming before deleting.

### 14. Branch protection is unavailable

`GET /repos/CozyM3dia/3Diner/branches/main/protection` returns 403: *"Upgrade to
GitHub Pro or make this repository public to enable this feature."* So
"require CI to pass before merge" cannot be enforced on this plan — the workflow
added here reports status, but nothing stops a merge past a red check.

### 15. Smaller items

- `tsconfig.json` targets **ES2017**. Next 16 / React 19 need a modern browser
  anyway; ES2022 emits less transpiled output.
- `next.config.ts` hardcodes `3diner.vercel.app` and the Supabase project ref
  `zvkmcbvckuupjsdftsyz` in the PWA `runtimeCaching` patterns. Preview
  deployments never match the page-cache rule, so PWA caching is silently off
  outside production.
- 18 `: any` annotations in `src`.

---

## Suggested order

1. Rate-limit `POST /api/orders` (#2) — the one live abuse path left
2. Delete `public/models/*` (#4) — 118 MB off every deploy, one commit
3. Drop `framer-motion` (#6) — bundle win, near-zero risk
4. Burn down the eslint backlog (#12), then widen CI lint to the full tree
5. RLS policies (#3) — highest value, largest change
