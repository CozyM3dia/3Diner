# 3Diner Performance, Quality, and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Reduce 3D route cost, static asset waste, and deployment risk without changing the visual interface.

**Architecture:** Keep current components and dynamic Three.js imports. Reduce GPU work by delaying initialization, capping DPR, and disposing resources. Remove only verified unused assets, retain manifest installability, and add reproducible quality gates.

**Tech Stack:** Next.js 16, React 19, Three.js, Turbopack, Vercel, Vitest, GitHub Actions.

## Global Constraints

- Do not change UI, copy, navigation, branding, or layout.
- Preserve Meshopt and Draco support.
- Delete public files only after source, build, and production reference checks.
- Do not claim offline PWA support without generated and registered service worker.
- Every dependency update must pass test, type, lint, build, and audit checks.

---

### Task 1: Audit static assets and replace PWA icon payload

**Files:**
- Create: App/scripts/audit-static-assets.mjs
- Modify: App/public/manifest.json
- Create: App/public/brand/icon-192.png and App/public/brand/icon-512.png
- Delete: only confirmed unused models/duplicate assets
- Test: App/tests/static-assets.test.ts

**Interfaces:** audit script accepts --check path, prints byte size/reference count, and fails for a referenced path.

- [ ] **Step 1: Write failing test**

~~~ts
it("uses dedicated PWA icons", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual(["/brand/icon-192.png", "/brand/icon-512.png"]);
});
~~~

- [ ] **Step 2: Run baseline**

Run: node scripts/audit-static-assets.mjs --check public/models/pixel-robot-original.glb; npm run test -- --run tests/static-assets.test.ts

Expected: script reports bytes/reference count; icon test fails.

- [ ] **Step 3: Implement asset checks and manifest**

~~~json
"icons": [
  { "src": "/brand/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
  { "src": "/brand/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
]
~~~

Generate icons from the existing mark with unchanged visual identity. Remove a candidate only when audit output says references=0. Inspect production network once after deployment.

- [ ] **Step 4: Verify and commit**

Run: npm run test -- --run tests/static-assets.test.ts; npm run build

Expected: commands exit 0.

~~~bash
git add -A App/public App/scripts/audit-static-assets.mjs App/tests/static-assets.test.ts
git commit -m "perf: remove unused static assets"
~~~

### Task 2: Bound Three.js work and dispose all resources

**Files:**
- Create: App/src/lib/viewer/dispose.ts
- Modify: App/src/components/viewer/GlbViewer.tsx
- Test: App/tests/viewer-dispose.test.ts

**Interfaces:** clampPixelRatio(value) returns a finite value from 1 to 1.5. disposeScene(root, renderer) disposes geometry, material textures, renderer, and WebGL context after RAF/listener shutdown.

- [ ] **Step 1: Write failing tests**

~~~ts
it.each([[0, 1], [1, 1], [3, 1.5]])("clamps DPR %s to %s", (input, expected) => expect(clampPixelRatio(input)).toBe(expected));
it("disposes geometry, material maps, and renderer", () => {
  disposeScene(scene, renderer);
  expect(geometry.dispose).toHaveBeenCalledOnce();
  expect(texture.dispose).toHaveBeenCalledOnce();
  expect(renderer.dispose).toHaveBeenCalledOnce();
});
~~~

- [ ] **Step 2: Run test to verify failure**

Run: npm run test -- --run tests/viewer-dispose.test.ts

Expected: helper module is absent.

- [ ] **Step 3: Implement lifecycle**

~~~ts
export const clampPixelRatio = (value: number) => Math.min(1.5, Math.max(1, Number.isFinite(value) ? value : 1));
renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio));
~~~

Keep init cleanup closure in a ref. On unmount cancel RAF, remove DOM/window listeners, disconnect ResizeObserver/IntersectionObserver, dispose all scene resources, then renderer.dispose and forceContextLoss. Begin dynamic imports only when container intersects; preserve current loading and retry markup.

- [ ] **Step 4: Verify and commit**

Run: npm run test -- --run tests/viewer-dispose.test.ts; npx eslint src/components/viewer/GlbViewer.tsx src/lib/viewer/dispose.ts; npm run build

Expected: all commands exit 0.

~~~bash
git add App/src/components/viewer/GlbViewer.tsx App/src/lib/viewer/dispose.ts App/tests/viewer-dispose.test.ts
git commit -m "perf: bound and clean up 3d renderer"
~~~

### Task 3: Align Next 16 proxy, headers, and PWA behavior

**Files:**
- Create: App/src/proxy.ts
- Delete: App/src/middleware.ts
- Modify: App/next.config.ts, App/package.json, App/package-lock.json
- Test: App/tests/next-config.test.ts

**Interfaces:** proxy preserves login/dashboard redirects. Pages return CSP, nosniff, frame, referrer, permissions, and COOP headers with no X-Powered-By.

- [ ] **Step 1: Write failing config test**

~~~ts
it("disables powered-by and provides baseline headers", async () => {
  expect(nextConfig.poweredByHeader).toBe(false);
  const keys = (await nextConfig.headers?.())?.flatMap((rule) => rule.headers).map((h) => h.key);
  expect(keys).toEqual(expect.arrayContaining(["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options"]));
});
~~~

- [ ] **Step 2: Run test to verify failure**

Run: npm run test -- --run tests/next-config.test.ts

Expected: the required headers and proxy file do not exist.

- [ ] **Step 3: Implement production configuration**

Move existing Supabase cookie/redirect behavior to proxy.ts, export proxy, and delete middleware. Set poweredByHeader false. Retain model cache/CORP and COOP. Add CSP default-src self, object-src none, base-uri self, frame-ancestors none, and only necessary Supabase/Midtrans/Google decoder hosts. Add nosniff, DENY frame, strict referrer, and disabled camera/microphone/geolocation permissions policy.

Remove the next-pwa wrapper if a production build does not generate public/sw.js; retain manifest installability but do not document offline support. Retain service worker only if production build emits it and browser verification confirms registration.

- [ ] **Step 4: Verify and commit**

Run: npm run test -- --run tests/next-config.test.ts; npm run build; npm run start

Expected: build exits 0. A second terminal command curl -I http://localhost:3000/senja-kopi reports required headers and no X-Powered-By.

~~~bash
git add App/src/proxy.ts App/src/middleware.ts App/next.config.ts App/package.json App/package-lock.json App/tests/next-config.test.ts
git commit -m "fix: align Next routing and response security"
~~~

### Task 4: Stabilize dependencies, lint, CI, and operations

**Files:**
- Modify: App/package.json, App/package-lock.json, App/.npmrc, App/README.md
- Create: App/.nvmrc, App/docs/operations.md, .github/workflows/quality.yml
- Modify: touched lint offenders including ARSession.tsx, GlbViewer.tsx, and OrderView.tsx

**Interfaces:** clean install, test, type-check, lint, and build succeed using declared Node LTS; CI runs exactly those commands from App.

- [ ] **Step 1: Capture baseline**

Run: node --version; npm audit --omit=dev; npm outdated; npm run lint

Expected: keep results in implementation report; do not force upgrades.

- [ ] **Step 2: Write regression test before behavior-affecting lint fix**

~~~ts
it("cancels scheduled viewer work after unmount", () => {
  const { unmount } = render(<Viewer3DPage {...props} />);
  unmount();
  expect(cancelAnimationFrame).toHaveBeenCalled();
});
~~~

- [ ] **Step 3: Implement reproducibility and CI**

Pin Vercel-supported Node LTS in .nvmrc. Remove legacy-peer-deps only after clean install passes. Upgrade direct packages one compatible release at a time. Replace boundary any with typed unknown parsing; do not globally suppress rules. Add workflow:

~~~yaml
name: quality
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: App } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: App/.nvmrc, cache: npm, cache-dependency-path: App/package-lock.json }
      - run: npm ci
      - run: npm run test -- --run
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run build
~~~

Document variable names only, secure deployment, Midtrans webhook verification, database plus separate Storage backups, and asset audit procedure.

- [ ] **Step 4: Verify and commit**

Run: npm ci; npm run test -- --run; npx tsc --noEmit; npm run lint; npm run build; npm audit --omit=dev; git diff --check

Expected: quality commands exit 0; every remaining advisory identifies upstream package/version in commit body.

~~~bash
git add App/package.json App/package-lock.json App/.npmrc App/.nvmrc App/src App/tests App/README.md App/docs/operations.md .github/workflows/quality.yml
git commit -m "ci: enforce reproducible application quality"
~~~
