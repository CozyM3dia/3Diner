# Task 1 brief: guided cart state and interaction contract

Work only in `C:\Kerja\3Diner\.worktrees\guided-checkout`.

Read the approved design at `docs/superpowers/specs/2026-08-13-guided-checkout-design.md` and the implementation plan at `docs/superpowers/plans/2026-08-13-guided-checkout.md` first. You own only:

- `App/tests/cart-view-recovery.test.tsx`
- `App/src/components/CartView.tsx`

Goal: turn the existing customer cart into a two-step local checkout, `review` then `payment`, without changing the `/api/orders` request shape, `createOrder` contract, QRIS behavior, cashier behavior, or tokenized redirect.

Required behavior:

1. Add a local `CheckoutStep = "review" | "payment"` state, initially `review`.
2. Render a visible progress rail with labels `Review`, `Bayar`, and `Selesai`.
3. Review step keeps item quantity controls, add-more link, table input, notes, and the existing total summary.
4. The review CTA is a button named `Lanjut ke pembayaran`. It must validate the required table field, set `aria-invalid="true"` when empty, focus the field, and remain on review. With a valid table it changes to payment.
5. Payment step shows a compact recap, the existing payment channel choice, a button named `Kembali ke review`, and a submit button named `Kirim pesanan`.
6. Keep `submit()`'s payload, error handling, clear behavior, and redirect intact. Stock/order errors must keep the cart visible and allow retry.
7. Offline state remains disabled and clear.
8. Use existing project tokens and accessible labels. Do not add dependencies.

TDD requirement: first update/add tests demonstrating the guided flow and blank-table validation, run the focused test and confirm it fails for the missing behavior, then implement and rerun until green. Do not bypass a red test.

Use focused command from `App`:

`npm test -- --run tests/cart-view-recovery.test.tsx`

Then run the same test again after implementation. Commit only the two owned files with:

`git add App/src/components/CartView.tsx App/tests/cart-view-recovery.test.tsx`

`git commit -m "feat: add guided cart checkout steps"`

After committing, write a report to `.superpowers/sdd/2026-08-13-guided-checkout/task-1-report.md` containing: files changed, behavior implemented, commands run with results, commit hash, and any concerns. Do not edit unrelated files or revert other work.
