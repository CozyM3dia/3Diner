# Task 2 brief — world-class cart and add-to-cart presentation

## Scope

You own the presentation refinement for the guided checkout flow. Work directly in the existing feature worktree and accommodate the prior Task 1 changes; do not revert them. You are not alone in the codebase, so preserve unrelated edits and only touch the owned files below.

Owned files:

- `App/src/components/CartView.tsx`
- `App/src/components/MenuOrderPanel.tsx`
- `App/src/components/CartFab.tsx`
- `App/src/app/globals.css`
- `App/tests/cart-view-recovery.test.tsx`

## Product intent

The customer is seated at a cafe table ordering from a phone. Make the experience feel calm, tactile, and premium: show the next decision clearly, keep quantity controls easy to hit, and make the order total visible without crowding the screen. Use the existing navy/orange tokens and Lucide icons. Do not add dependencies, change order APIs, or rewrite payment behavior.

## Required behavior and visual assertions

1. In the review step, the page has a clear `Review pesanan` heading and a compact progress rail containing `Review`, `Bayar`, and `Selesai`.
2. The payment step keeps the existing `Pilih metode pembayaran` heading and accessible radiogroup, and the existing `createOrder` contract remains unchanged.
3. The sticky review action has one clear next-step CTA. The payment action keeps `Kembali ke review` and `Kirim pesanan`.
4. Menu detail quantity controls remain at least 44px and the adjacent order CTA reads `Lihat pesanan` (or an equally clear Indonesian label) while retaining count and total context without the cramped screenshot treatment.
5. `CartFab` communicates `Lihat pesanan`, count, and total without duplicating a second ambiguous `Pesanan` label.
6. New motion has a reduced-motion fallback. Avoid pure black/white, emojis, gradients in text, new dependency installs, and layout overflow at 375–430px.

## TDD / verification

Before implementation, add the presentation assertions to `App/tests/cart-view-recovery.test.tsx`, run the focused test and confirm it fails for the missing `Review pesanan`/progress/radiogroup assertions, then implement the smallest coherent change and rerun it green. Also run `npm run typecheck` and `npm run lint` from `App`; run `git diff --check` before reporting.

## Commit

When the focused tests, typecheck, lint, and diff check pass, commit only the owned implementation/test files with:

`refactor: polish customer ordering flow`

Return a concise report with changed files, checks, and commit hash. Do not commit generated dependencies or unrelated files.
