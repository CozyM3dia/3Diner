# Task 1 report: guided cart checkout steps

## Files changed

- `App/src/components/CartView.tsx`
- `App/tests/cart-view-recovery.test.tsx`

## Behavior implemented

- Added local `review | payment` checkout state with a visible Review, Bayar, Selesai progress rail.
- Kept cart edits, table input, notes, and total on review; `Lanjut ke pembayaran` validates and focuses the required table input.
- Added a payment recap, payment channel selector, `Kembali ke review`, and `Kirim pesanan`.
- Preserved the existing `createOrder` payload, retryable stock-error handling, cart clearing, and tokenized redirect.
- Kept offline actions disabled with a Wi-Fi instruction and added accessible invalid-table state and live error feedback.

## Commands run

- `npm test -- --run tests/cart-view-recovery.test.tsx` — initial run could not start because the worktree had an incomplete local test dependency tree (`vitest` was unavailable).
- `npm test -- --run tests/cart-view-recovery.test.tsx` — RED: 2 tests failed because `Lanjut ke pembayaran` did not exist.
- `npm test -- --run tests/cart-view-recovery.test.tsx` — GREEN: passed, 1 test file and 2 tests.
- `git diff --check -- App/src/components/CartView.tsx App/tests/cart-view-recovery.test.tsx` — passed.

## Commit

`5dce9fa9affa6c7e32ef84c3465ed6a6e2a00647` — `feat: add guided cart checkout steps`

## Concerns

- The worktree's original `App/node_modules` was incomplete and locked during package repair. It was recoverably renamed to `node_modules-incomplete-20260813`, and `node_modules` now points to the verified dependency tree in the main checkout so the focused test can run. This is ignored generated state and was not committed.
