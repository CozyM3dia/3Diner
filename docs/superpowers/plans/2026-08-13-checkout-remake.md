# Customer Checkout Remake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a calm two-stage checkout that shows the canonical payable total before commitment and recovers correctly through payment and terminal order states.

**Architecture:** A service-only read-only Postgres quote RPC feeds a server API route and typed client quote function. `CartView` orchestrates focused review and confirmation components, while `OrderView` gains explicit fetch and terminal-state handling without altering create-order, QRIS, or cashier contracts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest/Testing Library, Supabase Postgres RPC, Tailwind utilities plus project CSS.

## Global Constraints

- Preserve unrelated changes and `.superpowers/brainstorm/`.
- No new dependency.
- Preserve `createOrder`, payment charge, webhook, cashier check-in, and customer-token interfaces.
- Minimum 44px targets, WCAG AA, reduced motion, and no horizontal overflow at 375px.
- Every behavior change follows red-green-refactor and records the failing test evidence.

---

### Task 1: Canonical read-only order quote

**Files:**
- Create: `App/supabase/migrations/20260812220224_order_quote.sql`
- Create: `App/src/app/api/orders/quote/route.ts`
- Modify: `App/src/lib/orders.ts`
- Modify: `App/src/types/index.ts`
- Modify: `App/tests/database-contract.test.ts`
- Create: `App/tests/order-quote-route.test.ts`

**Interfaces:**
- Produces `OrderQuote`, `quoteOrder(input): Promise<OrderQuote>`, `POST /api/orders/quote`, and `public.quote_order(uuid,jsonb)`.
- Reuses `parseItems`, `supabaseAdmin`, and existing rate-limit helpers.

- [ ] Write route/database/client tests for canonical items, option IDs, tax/service, invalid data, RPC failure, and explicit service-role-only grants.
- [ ] Run focused tests and confirm failure because quote artifacts do not exist.
- [ ] Create the migration by first using `supabase migration new order_quote`; implement a no-write RPC with create-order-equivalent validation and totals.
- [ ] Implement the API route and client function with safe error mapping and rate limits.
- [ ] Run focused tests to green, then `npm run typecheck` and `git diff --check`.

### Task 2: Two-stage customer checkout remake

**Files:**
- Modify: `App/src/components/CartView.tsx`
- Create: `App/src/components/checkout/CheckoutReview.tsx`
- Create: `App/src/components/checkout/CheckoutConfirmation.tsx`
- Create: `App/src/components/checkout/CheckoutCommitBar.tsx`
- Create: `App/src/components/checkout/CheckoutOrderLine.tsx`
- Modify: `App/src/app/globals.css`
- Modify: `App/tests/cart-view-recovery.test.tsx`

**Interfaces:**
- Consumes `quoteOrder`, `OrderQuote`, existing cart state, and unchanged `createOrder`.
- Parent `CartView` owns stage, quote, channel, validation, submission, and navigation; children are presentational plus typed callbacks.

- [ ] Write failing interaction tests for quote gating, breakdown, native radio behavior, dynamic action labels, back/edit preservation, focus, offline, duplicate submit, unchanged payload, stock recovery, and total-change marker.
- [ ] Run the focused test and record expected failures from the old rail/card UI.
- [ ] Split the focused components and implement the new hierarchy and state machine.
- [ ] Replace checkout-only gradient/sheen/card styles with flat sections, dividers, accessible colors, and responsive 44px controls.
- [ ] Run focused tests to green, changed-file ESLint, and typecheck.

### Task 3: Order recovery and terminal states

**Files:**
- Modify: `App/src/lib/orders.ts`
- Modify: `App/src/components/OrderView.tsx`
- Create: `App/src/components/order/OrderLoadState.tsx`
- Create: `App/src/components/order/OrderTerminalState.tsx`
- Modify: `App/tests/order-view.test.tsx`
- Modify: `App/tests/orders-client.test.ts`

**Interfaces:**
- `fetchOrder` throws `OrderFetchError(kind)` instead of collapsing every failure to null.
- `OrderView` renders loaded/not-found/transient states and recognizes `completed` and `cancelled` as terminal.

- [ ] Write failing tests for 404 vs transient, retry, token preservation, completed/cancelled copy, cancellation reason, total-change acknowledgement, and polling cleanup.
- [ ] Run focused tests and confirm failures against current behavior.
- [ ] Implement typed fetch outcomes, focused load/terminal components, acknowledgement gate, and terminal polling stop.
- [ ] Run focused tests to green, changed-file ESLint, and typecheck.

### Task 4: Full verification and visual QA

**Files:**
- Modify only files required by defects discovered in verification.

- [ ] Run `npm run test:ci -- --maxWorkers=1 --minWorkers=1`; require zero failures.
- [ ] Run `npm run typecheck`; require exit 0.
- [ ] Run ESLint on every changed TS/TSX file; require zero errors.
- [ ] Run `npm run build`; require exit 0.
- [ ] Run `git diff --check`; require no output.
- [ ] Browser-test menu detail → add → review → quote → QRIS/cashier confirmation at 375×812 and 430px; inspect keyboard focus, 44px targets, overflow, console, and reduced motion.
- [ ] Inspect the complete diff and confirm no unrelated file or backend lifecycle change.
- [ ] Obtain a new fresh Sol review; if `fix-first` or `rethink`, delegate corrections and repeat all invalidated checks.
