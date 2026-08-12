# Guided Checkout Design

## Feature summary

3Diner's customer order page will become a calm, two-step guided checkout for guests who are seated at a table. The customer first reviews the cart, then chooses QRIS or payment at the cashier before submitting the order. The existing order API, QRIS charge flow, cash check-in flow, and status polling remain unchanged.

## Primary user action

Review the order, confirm the table and optional note, choose a payment route, and submit with confidence.

## Design direction

- Product register, mobile-first customer workflow.
- Restrained paper surface with deep navy structure and a single orange action accent, following `docs/DESIGN.md`.
- Physical scene: a guest is seated at a cafe table, using a phone in relaxed ambient light, with time to check a shared order before sending it to the kitchen.
- The guided flow takes its structural cue from a compact travel checkout rather than a delivery app: one clear step at a time, visible progress, and a persistent total.
- No external UI component is needed. Existing Lucide icons, tokens, and card primitives are sufficient and keep the experience visually consistent.

## Scope

- Production-ready customer-facing UI.
- One route, `/{slug}/keranjang`, with two local steps: `review` and `payment`.
- Preserve current order creation contract and post-submit routing.
- Improve the menu detail add-to-cart bar so quantity changes and the route to the cart are easier to understand.
- No database migration and no payment-provider behavior change.

## Layout strategy

1. Sticky compact header with back navigation, page title, and item count.
2. Three-part progress indicator: `Review`, `Bayar`, `Selesai`. The first step is active on cart review, the second on payment selection, and the third is represented by the existing order-status screen after submission.
3. Review step: item list with image, option summary, unit price, and a generous quantity stepper; add-more link; table and notes grouped as order details; transparent subtotal/total summary.
4. Payment step: small order recap, payment options presented as accessible radio cards, and a dark sticky action bar containing the total and the submit action.
5. Empty and offline states remain inline and keep the route back to the menu obvious.

## Key states

- Empty cart: friendly explanation and `Jelajahi Menu`.
- Review with valid table: `Lanjut ke pembayaran` enabled.
- Review with blank table: inline validation, focus moves to table field, no order request.
- Payment with QRIS selected: `Kirim pesanan`, then the existing order page automatically creates/displays the QRIS QR.
- Payment with cashier selected: `Kirim pesanan`, then the existing check-in code screen.
- Submitting: loading icon and disabled CTA, preserving all form values.
- Order error: inline alert, cart preserved, retry can be attempted.
- Offline: disabled action with a clear Wi-Fi instruction.
- Reduced motion: existing CSS animations remain non-essential and should be disabled via `prefers-reduced-motion`.

## Interaction model

- Quantity controls update the cart immediately and remain available on the review step.
- `Tambah item lain` returns to the menu without losing cart state.
- `Lanjut ke pembayaran` validates only the required table field and moves to the payment step.
- `Kembali ke review` returns without clearing anything.
- Payment cards use `role="radiogroup"` and `role="radio"`; selecting one updates the active visual state and CTA helper text.
- `Kirim pesanan` calls the existing `createOrder` contract exactly once per submit attempt and routes to the existing tokenized order status URL on success.

## Content requirements

- Page title: `Selesaikan pesanan`.
- Progress labels: `Review`, `Bayar`, `Selesai`.
- Review CTA: `Lanjut ke pembayaran`.
- Submit CTA: `Kirim pesanan`.
- QRIS description: `Satu QR untuk semua aplikasi pembayaran`.
- Cashier description: `Tunjukkan kode pesanan ke kasir`.
- Helper text must explain the next action, not repeat the heading.

## Accessibility and quality

- All quantity buttons have item-specific accessible labels.
- Required table input uses `aria-invalid` and an adjacent live error when invalid.
- Error messages use `role="alert"` and preserve focus behavior.
- Touch targets remain at least 44px.
- Layout must remain usable at 375px wide without horizontal overflow.
- Verify targeted component tests, full test suite, typecheck, build, and rendered browser screenshots at mobile and desktop widths.
