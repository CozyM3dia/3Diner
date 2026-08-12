# Payment Setup and QRIS Processing

This guide covers 3Diner's two payment paths: one dynamic QRIS payment for
online orders and pay-at-cashier check-in for in-store settlement.

## Payment Methods

### Online: Midtrans Core API QRIS

- The customer sees one dynamic QRIS image.
- The same QR can be scanned with GoPay, OVO, DANA, ShopeePay, or a compatible
  mobile-banking app.
- The server creates the transaction through Midtrans Core API
  (`/v2/charge`) and stores the QR image URL for the pending order.
- Reopening or refreshing the same pending order reuses that QR URL instead of
  creating another transaction.

### In-Store: Pay at Cashier

- The customer receives a check-in QR code containing the order ID and
  8-character code.
- The cashier scans the QR or enters the code to unlock the order queue entry.
- The cashier confirms payment in the dashboard; stock is deducted and the
  order enters the queue.
- No payment gateway is involved in this path.

## Stock Deduction Timing

**Inventory is deducted at confirmation, not at order creation.** This prevents
stock deadlock if an order is abandoned or payment fails.

| Method | Deduction Trigger |
| --- | --- |
| Online QRIS | Midtrans webhook confirms payment (`settlement` or `capture`) |
| Cash | Cashier check-in and payment confirmation |

The `confirm_order` RPC is atomic: payment confirmation, stock claim, and queue
entry all succeed or roll back together.

## Required Environment Variables

Set these in `App/.env.local` for development and in the Vercel Environment
Variables for the deployed environment:

```text
MIDTRANS_SERVER_KEY=<server-key-for-the-same-environment>
MIDTRANS_IS_PRODUCTION=false
```

- `MIDTRANS_SERVER_KEY` is private and must never be exposed to the browser.
- Use the Sandbox Server Key with `MIDTRANS_IS_PRODUCTION=false`.
- Use the Production Server Key with `MIDTRANS_IS_PRODUCTION=true`.
- Sandbox and Production Server Keys are different. Do not test the sandbox
  endpoint with a production key.
- A Midtrans client key or Snap.js script is not required for this QRIS-only
  customer flow.

## Midtrans Webhook Setup

Register the Payment Notification URL in the Midtrans Dashboard:

```text
https://<your-domain>/api/payment/webhook
```

The endpoint verifies the HMAC-SHA512 signature with `MIDTRANS_SERVER_KEY`,
checks the stored amount, confirms the order idempotently, and triggers stock
deduction.

## Database Migration

Apply the migrations from the `App` directory:

```bash
cd App
supabase db push
```

The QRIS migrations add `Orders.payment_qr_url`,
`Orders.payment_transaction_id`, and `Orders.payment_idempotency_key`. They
validate the persisted QR URL, pair the QR URL with its Midtrans transaction
identity, and expose the QR URL through the customer order RPC only while the
order is still pending. The idempotency key is retained for safe retries when
a charge response is lost.

Before pushing, check that the local migration filenames match the linked
project's remote migration history. This repository includes the deployed
remote versions for the QRIS migrations; if `supabase migration list` reports
history drift, reconcile the history first instead of replaying DDL against a
production database.

## Sandbox Testing Checklist

- [ ] Database migrations are applied.
- [ ] Sandbox Server Key is configured and `MIDTRANS_IS_PRODUCTION=false`.
- [ ] Webhook URL is reachable and registered in Midtrans.
- [ ] Create a sandbox order and request the QRIS screen.
- [ ] Confirm the response contains one Midtrans QR image URL.
- [ ] Refresh/reopen the pending order and confirm no second transaction is created.
- [ ] Open the [Midtrans QRIS sandbox simulator](https://simulator.sandbox.midtrans.com/openapi/qris/index), paste the QR image URL, and complete payment with a QRIS-compatible app.
- [ ] Confirm the webhook changes the order to `paid` and stock is deducted once.
- [ ] Confirm a failed or expired QRIS payment clears the QR URL and allows a new attempt.
- [ ] Confirm cash orders can still be checked in from the cashier.

## Disabling Online Payment

If Midtrans is unavailable, unset `MIDTRANS_SERVER_KEY` or disable the online
payment configuration for the deployed environment. Pay at Cashier remains
available.

## Notes

- The customer payment QR is a dynamic QRIS image from Midtrans, not the
  cashier check-in QR.
- Payment status remains the server-side source of truth; local storage only
  helps restore the customer screen.
- The charge and check-in endpoints are rate-limited.
