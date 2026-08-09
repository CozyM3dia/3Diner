# Task 8 Report: Snap.js loader + CSP/COOP headers

## Changes

### Part A — Snap.js loader + COOP (App/src/app/layout.tsx, App/next.config.ts)
- `App/src/app/layout.tsx`: imported `Script` from `next/script` and added the Midtrans
  Snap.js loader inside `<body>`, after `{children}`, with `strategy="afterInteractive"`.
  URL switches between `https://app.midtrans.com/snap/snap.js` (prod) and
  `https://app.sandbox.midtrans.com/snap/snap.js` (sandbox) based on
  `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION`, with `data-client-key` from
  `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`.
- `App/next.config.ts` `headers()`: changed `Cross-Origin-Opener-Policy` from
  `same-origin` to `same-origin-allow-popups`.

### Part B — CSP (App/next.config.ts)
Added a `Content-Security-Policy` header to the same `/(.*)` header block, built from the
brief's policy with one addition (see below):

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com;
frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com;
connect-src 'self' blob: https://*.supabase.co https://*.datadoghq.com https://api.midtrans.com https://api.sandbox.midtrans.com https://app.midtrans.com https://app.sandbox.midtrans.com;
img-src 'self' data: blob: https:;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
worker-src 'self' blob:;
manifest-src 'self';
```

**One minimal adjustment made:** added `blob:` to `connect-src`. Round 1 verification on the
`/3d` viewer page showed `THREE.GLTFLoader` fetching a texture from a `blob:` URL (created
client-side from a Supabase-fetched GLB/texture blob), and `fetch()` on `blob:` URLs is
gated by `connect-src`, not `img-src`. Without it, the 3D model's texture failed to load.
This is a same-origin-generated blob (created via `URL.createObjectURL` in the app's own
code), not a new external origin, so it's a narrow, justified addition. Rebuilt and
re-verified — zero violations after the fix.

## Build result
`npm run build` succeeded both before and after the `blob:` addition (Next.js 16.3.0,
Turbopack). No new TypeScript or build errors introduced.

## Verification (production mode, `npm start` on localhost:3000)

Pages loaded and checked via the browser preview tool (fresh tab, `read_console_messages`,
plus a direct `fetch()` of the CSP response header to confirm the exact value sent):

1. `http://localhost:3000/` — redirects/serves `Senja Kopi` cafe menu (`/senja-kopi`).
   Zero console errors. Confirmed `window.snap` is `"object"` (Snap.js loaded under CSP).
2. `http://localhost:3000/senja-kopi` — full customer menu page (categories, promo section,
   8 menu items with images). Zero console errors.
3. `http://localhost:3000/senja-kopi/6eaa4a22-9d5d-498c-b69f-05fe3a215944/3d` — the 3D model
   viewer page (three.js / GLTFLoader / gaussian-splats path). Canvas renders. Zero console
   errors after adding `blob:` to `connect-src` (round 1 fix; round 0 without the fix showed
   the violation below).

### Violation found (round 0, before fix) and resolved
```
[error] Connecting to 'blob:http://localhost:3000/d72bb977-2fc7-4613-86d2-c25500e557f8'
violates the following Content Security Policy directive: "connect-src 'self'
https://*.supabase.co https://*.datadoghq.com https://api.midtrans.com
https://api.sandbox.midtrans.com https://app.midtrans.com
https://app.sandbox.midtrans.com". The action has been blocked.
[error] Fetch API cannot load blob:http://localhost:3000/d72bb977-2fc7-4613-86d2-c25500e557f8.
Refused to connect because it violates the document's Content Security Policy.
[error] THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3000/...
```
Fixed by adding `blob:` to `connect-src` (1 round of adjustment, within the 2-round budget).
Rebuilt, restarted `npm start`, re-tested in a fresh tab — no further violations on any of
the three pages.

## Outcome
**CSP shipped** (not deferred). Verified clean on home/redirect page, customer menu page,
and the 3D model viewer page (the highest-risk page for CSP given three.js/WASM/blob usage).

## Commit
`dde4977` — `feat(payment): load Snap.js, add CSP allowing Midtrans, relax COOP for popup`
Files: `App/src/app/layout.tsx`, `App/next.config.ts`

## Fix pass — critical CSP regression (wss:// missing for Supabase Realtime)

### Defect
`connect-src` listed `https://*.supabase.co` but not `wss://*.supabase.co`. CSP source
expressions are scheme-specific, so the `https:` entry did not authorize the `wss:`
WebSocket handshake used by Supabase Realtime (`supabase.channel(...).on("postgres_changes",
...)` in `App/src/components/kasir/KasirQueue.tsx` and
`App/src/components/dashboard/OrdersClient.tsx`). Live order updates on the cashier queue and
orders dashboard were silently broken.

### Change (`App/next.config.ts`)
Added `wss://*.supabase.co` to `connect-src`, alongside the existing `https://*.supabase.co`
and `blob:` entries:
```
connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.datadoghq.com
https://api.midtrans.com https://api.sandbox.midtrans.com https://app.midtrans.com
https://app.sandbox.midtrans.com;
```

### DatadogAppRouter check
`App/src/app/layout.tsx` has exactly one import (`import { DatadogAppRouter } from
"@datadog/browser-rum-nextjs";`, line 4) and exactly one usage (`<DatadogAppRouter />`, line
44). No duplicate — no change made to this file.

### Build result
`npm run build` (Next.js 16.3.0, Turbopack) succeeded with no errors after the change.

### Verification
Started the production server (`npm start -p 3010`) as a background process and ran
`curl -sI http://localhost:3010/`. The response's `Content-Security-Policy` header confirmed:
```
connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.datadoghq.com
https://api.midtrans.com https://api.sandbox.midtrans.com https://app.midtrans.com
https://app.sandbox.midtrans.com
```
`wss://*.supabase.co` is present, which is exactly what the Realtime client needs for its
WebSocket handshake. Server process was then stopped. `/kasir` was not loaded directly (staff
login required), consistent with the task's expected verification path.

### Commit
`fix(payment): allow wss Supabase Realtime in CSP connect-src` — staged
`App/next.config.ts` only (layout.tsx unchanged, no duplicate found).
