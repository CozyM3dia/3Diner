# Final Whole-Feature Fix Report

## Scope

- `App/src/components/Menu3DTransitionLink.tsx`
- `App/src/components/viewer/Viewer3DPage.tsx`
- `App/tests/menu-3d-transition.test.tsx`
- `App/tests/viewer-3d-entrance.test.tsx`

## Root Causes And Fixes

1. The fallback portal always assigned `backgroundImage`, even when no image existed. The style key is now omitted for null images.
2. Marker persistence and routing shared one throwing path. Marker storage is now best-effort and `router.push` executes from `finally`.
3. Viewer entrance returned early when the marker was absent or unreadable. Every visit now animates; the marker selects the stronger timing and motion profile while direct visits use a subtle profile.
4. The portal retained rounded corners after reaching the viewport bounds. The timeline now applies `borderRadius: 0` with a discrete `set` at the transform completion point; no non-transform/opacity property is tweened.
5. The StrictMode test reused one timeline mock. It now creates separate timeline instances and verifies the first is killed while the second remains active.
6. The PLY loader's immediate state reset made the mount effect a synchronous state path. Initial state supplies the first loading view, retry owns explicit reset state, and mount loading begins in a cancellable microtask.
7. GLTF cache data was read from a ref during render. Loaded GLTF data now lives in React state and is passed to AR from render state.

## TDD Evidence

Initial focused red run:

- Command: `npx vitest run tests/menu-3d-transition.test.tsx tests/viewer-3d-entrance.test.tsx`
- Result: exit 1; 4 failed, 7 passed; failures covered discrete border-radius handoff, null-image style omission, routing after storage failure, and no-marker entrance.

Additional storage-read red run:

- Command: `npx vitest run tests/viewer-3d-entrance.test.tsx`
- Result: exit 1; 1 failed, 4 passed; unavailable transition storage skipped the entrance timeline.

## Final Verification

- Focused tests: `npx vitest run tests/menu-3d-transition.test.tsx tests/viewer-3d-entrance.test.tsx`
  - Exit 0; 2 test files passed; 12 tests passed.
- TypeScript: `npx tsc --noEmit`
  - Exit 0; no diagnostics.
- Scoped ESLint: `npx eslint src/components/Menu3DTransitionLink.tsx 'src/app/[slug]/[menu_id]/page.tsx' src/components/viewer/Viewer3DPage.tsx tests/menu-3d-transition.test.tsx tests/viewer-3d-entrance.test.tsx`
  - Exit 0; no errors or warnings.

## 3D Viewer Lifecycle Regression Follow-up

### Root Causes

1. `Viewer3DPage` passed inline `onReady` and `onError` handlers to `GlbViewer`. Parent updates, including storing the loaded GLTF for AR, recreated those functions. Because `GlbViewer` includes lifecycle callbacks in its initialization dependencies, each parent render restarted GLB initialization.
2. PLY initialization had no load ownership after async boundaries. A superseded fetch or `addSplatScene` completion could continue constructing or starting a viewer after cleanup, allowing stale canvases and render loops to accumulate across rerenders, Strict Mode, or remounts.
3. The desktop AR CTA used `inline-flex`; its `mx-auto` centering needs a block-level flex box.

### Red Evidence

- Command: current `tests/viewer-3d-entrance.test.tsx` against detached `HEAD` (`c3441b4`) with the existing dependencies linked into the isolated worktree:
  - `npx vitest run tests/viewer-3d-entrance.test.tsx`
  - Exit 1; 4 failed, 5 passed.
  - GLB callback identity assertion failed after parent state updates.
  - Stale PLY fetch completion constructed a second Gaussian `Viewer` (expected 1, received 2).
  - A constructed stale PLY viewer called `start()` after deferred `addSplatScene` completion.
  - AR CTA assertion found `inline-flex` instead of `flex`.

### Green Evidence

- Focused test: `npx vitest run tests/viewer-3d-entrance.test.tsx`
  - Exit 0; 1 file passed; 9 tests passed.
- TypeScript: `npx tsc --noEmit`
  - Exit 0; no diagnostics.
- Scoped ESLint: `npx eslint src/components/viewer/Viewer3DPage.tsx tests/viewer-3d-entrance.test.tsx`
  - Exit 0; no errors or warnings.
- Final post-cleanup revalidation used the same installed package entrypoints directly (`node node_modules/vitest/vitest.mjs`, `node node_modules/typescript/bin/tsc`, and `node node_modules/eslint/bin/eslint.js`) after npm command shims became unavailable.
  - Focused Vitest: exit 0; 9 tests passed. TypeScript: exit 0. Scoped ESLint: exit 0.

## Retry-owned PLY Unmount Follow-up

### Root Cause And Fix

The mount effect cleanup aborted only its captured initial `AbortController` and invalidated the generation only when that initial generation was still active. A retry replaced both refs, so unmount left retry-owned async work live. Cleanup now aborts and clears the current controller ref and increments the active generation unconditionally before disposing viewer resources. Existing async generation checks therefore reject retry completion after unmount.

### Red/Green Evidence

- Red: `node node_modules/vitest/vitest.mjs run tests/viewer-3d-entrance.test.tsx`
  - Exit 1; 1 failed, 9 passed.
  - The retry fetch signal remained un-aborted after unmount (`expected false to be true`).
- Green: `node node_modules/vitest/vitest.mjs run tests/viewer-3d-entrance.test.tsx`
  - Exit 0; 1 file passed; 10 tests passed.
  - Regression coverage holds retry `addSplatScene` through unmount and verifies the current signal is aborted, the viewer is disposed, `start` and camera fitting are not called, and no canvas remains after late completion.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`
  - Exit 0; no diagnostics.
- Scoped ESLint: `node node_modules/eslint/bin/eslint.js src/components/viewer/Viewer3DPage.tsx tests/viewer-3d-entrance.test.tsx`
  - Exit 0; no errors or warnings.
