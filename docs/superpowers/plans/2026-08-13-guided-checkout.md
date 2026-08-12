# Guided Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the customer cart into a polished two-step Review → Bayar flow while preserving the existing order, QRIS, cashier, and status contracts.

**Architecture:** Keep the workflow local to `CartView` with a `review | payment` state. The review step owns cart edits and order details; the payment step owns channel selection and calls the existing `createOrder` function. The existing order status route remains the Selesai stage and is not rewritten.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4 utilities, existing CSS tokens, Lucide icons, Vitest, Testing Library.

## Global Constraints

- Do not change the `/api/orders` request shape or payment lifecycle.
- Preserve QRIS auto-charge and cashier check-in behavior after order creation.
- Use existing 3Diner navy/orange tokens from `docs/DESIGN.md`.
- Keep the customer UI mobile-first at 375–430px and touch-friendly.
- No pure black or white, no emojis, no new external component dependency.
- Follow TDD: write a failing behavior test, run it red, implement the smallest change, then run it green.
- Verify targeted tests, the full test suite, typecheck, build, and `git diff --check`.

---

### Task 1: Guided cart state and interaction contract

**Files:**
- Modify: `App/tests/cart-view-recovery.test.tsx`
- Modify: `App/src/components/CartView.tsx`

**Interfaces:**
- Consumes the existing `useCart()` state and `createOrder()` contract.
- Produces a `review | payment` local step, accessible step navigation, and the same tokenized order redirect.

- [ ] **Step 1: Write the failing tests**

Update the existing recovery test to exercise the approved flow:

```tsx
await userEvent.click(screen.getByRole("button", { name: "Lanjut ke pembayaran" }));
expect(screen.getByText("Pilih metode pembayaran")).toBeTruthy();
await userEvent.click(screen.getByRole("button", { name: "Kirim pesanan" }));
```

Add a focused test that a blank table does not advance:

```tsx
it("keeps the review step and marks the table as required", async () => {
  mockCartWithTable("");
  render(<CartView cafe={{ id_cafe: "cafe-1", nama_cafe: "3Diner" } as never} slug="demo" />);

  await userEvent.click(screen.getByRole("button", { name: "Lanjut ke pembayaran" }));

  expect(screen.getByRole("textbox", { name: "Nomor meja" })).toHaveAttribute("aria-invalid", "true");
  expect(screen.queryByText("Pilih metode pembayaran")).toBeNull();
  expect(createOrderMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing guided flow**

Run from `App`:

```text
npm test -- --run tests/cart-view-recovery.test.tsx
```

Expected: FAIL because the current cart has no `Lanjut ke pembayaran` button or payment step.

- [ ] **Step 3: Implement the smallest guided flow**

In `CartView.tsx`:

```tsx
type CheckoutStep = "review" | "payment";
const [step, setStep] = useState<CheckoutStep>("review");

function continueToPayment() {
  if (!tableValid) {
    setTouched(true);
    requestAnimationFrame(() => document.getElementById("meja")?.focus());
    return;
  }
  setStep("payment");
}
```

Render a progress indicator and conditionally render the review or payment content. The payment step must reuse the existing `PaymentChannelSelector`, show the order total, provide `Kembali ke review`, and leave `submit()` unchanged except for the new CTA.

- [ ] **Step 4: Run the focused tests and verify they pass**

```text
npm test -- --run tests/cart-view-recovery.test.tsx
```

Expected: PASS with the stock-error retry preserving the cart and the blank-table test staying on review.

- [ ] **Step 5: Commit the behavior change**

```text
git add App/src/components/CartView.tsx App/tests/cart-view-recovery.test.tsx
git commit -m "feat: add guided cart checkout steps"
```

### Task 2: World-class cart and add-to-cart presentation

**Files:**
- Modify: `App/src/components/CartView.tsx`
- Modify: `App/src/components/MenuOrderPanel.tsx`
- Modify: `App/src/components/CartFab.tsx`
- Modify: `App/src/app/globals.css`

**Interfaces:**
- Consumes the step and cart behavior from Task 1.
- Produces the final responsive, accessible presentation without changing data flow.

- [ ] **Step 1: Add presentation assertions before changing styling**

Extend the component test to assert the key customer-facing labels and semantics:

```tsx
expect(screen.getByText("Review pesanan")).toBeTruthy();
expect(screen.getByText("Review")).toBeTruthy();
expect(screen.getByText("Bayar")).toBeTruthy();
expect(screen.getByRole("radiogroup", { name: "Pilih metode pembayaran" })).toBeTruthy();
```

Run the focused test and confirm the new labels are red before implementation.

- [ ] **Step 2: Implement visual hierarchy and touch behavior**

Use the existing tokens and avoid new dependencies:

- Replace the flat page title with `Selesaikan pesanan`, item count, and a compact progress rail.
- Give review item rows a larger image area and an isolated 44px quantity control.
- Make the payment options full-width radio cards with selected-state border and visible `aria-checked`.
- Use a dark navy sticky action bar with the total on the left and one orange CTA on the right.
- Update the menu detail bar to label the next action as `Lihat pesanan` and expose item count/total without crowding the quantity stepper.
- Update `CartFab` copy to `Lihat pesanan` while retaining the count and total.
- Add reduced-motion handling for the new transition classes.

- [ ] **Step 3: Run focused tests, typecheck, and lint**

```text
npm test -- --run tests/cart-view-recovery.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands pass without accessibility-related TypeScript errors.

- [ ] **Step 4: Commit the UI refinement**

```text
git add App/src/components/CartView.tsx App/src/components/MenuOrderPanel.tsx App/src/components/CartFab.tsx App/src/app/globals.css App/tests/cart-view-recovery.test.tsx
git commit -m "refactor: polish customer ordering flow"
```

### Task 3: Whole-flow verification and handoff

**Files:**
- Modify: none unless verification uncovers a concrete defect.

- [ ] **Step 1: Run the complete test suite**

```text
npm run test:ci
```

- [ ] **Step 2: Run the production gates**

```text
npm run typecheck
npm run build
git diff --check main...HEAD
```

- [ ] **Step 3: Verify the rendered UI**

Start the app, open a cafe menu, add an item, open the cart, confirm both steps at mobile width, and verify the desktop-width layout has no overflow. Confirm that submitting QRIS still lands on the existing auto-generated QR screen and cashier still lands on its check-in screen.

- [ ] **Step 4: Create a final handoff commit if verification required a fix**

```text
git add App/src App/tests
git commit -m "fix: address guided checkout verification findings"
```
