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
