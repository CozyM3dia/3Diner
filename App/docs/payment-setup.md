# Payment Setup and Multi-Method Processing

This guide covers 3Diner's dual-method payment flow: online payments via **Midtrans Snap** and **Pay at Cashier** check-in.

## Payment Methods

### Online: Midtrans Snap
- **QRIS** — Direct QR code payment (interoperable with all major e-wallets)
- **GoPay, ShopeePay** — E-wallet checkout in Snap UI
- **Bank Virtual Account** — Dedicated account per order
- **DANA, OVO** — Reachable via QRIS option in Snap interface

### In-Store: Pay at Cashier
- Customer receives a **check-in QR code** containing order ID + 8-character code
- QR scanned or code manually entered at register to unlock the order queue entry
- Cashier confirms payment in the dashboard; stock deducts and order enters queue
- No payment gateway involved; settlement is cashier action

## Stock Deduction Timing

**Inventory is deducted at confirmation, not at order creation.** This prevents stock deadlock if orders are abandoned or payment fails.

| Method | Deduction Trigger |
| --- | --- |
| Online (Snap) | Midtrans webhook confirms payment (`settlement`) |
| Cash | Cashier check-in via QR or manual code entry |

The `confirm_order` RPC is atomic: payment confirmation, stock claim, and queue entry all succeed or roll back together.

## Required Environment Variables

Set all four in `.env.local` (dev) and Vercel Environment Variables (production):

```
MIDTRANS_SERVER_KEY=<your-server-key-here>
MIDTRANS_IS_PRODUCTION=false  # Set to "true" for production
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=<your-client-key-here>
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false  # Set to "true" for production
```

- **`MIDTRANS_SERVER_KEY`** — Private key for server-side charge verification. Never expose to browser. Retrieve from [Midtrans Dashboard](https://dashboard.midtrans.com/) → **Settings** → **Access Keys**.
- **`NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`** — Public key for Snap.js initialization in the browser. Safe to expose.
- **`MIDTRANS_IS_PRODUCTION` / `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION`** — Toggle between sandbox and production. Keep both in sync (both `false` for dev/sandbox, both `true` for production).

## Midtrans Webhook Setup

After deploying, register the Payment Notification URL in the Midtrans Dashboard:

1. Go to [Midtrans Dashboard](https://dashboard.midtrans.com/) → **Settings** → **Configuration**.
2. Under **Payment Notification URL**, set:
   ```
   https://<your-domain>/api/payment/webhook
   ```
3. The endpoint verifies HMAC-SHA512 signatures using `MIDTRANS_SERVER_KEY`.

The webhook is idempotent and handles network retries. It updates the order to `paid` status and triggers stock deduction.

## Two Critical Prerequisites

Both of these must complete before the payment flow works end-to-end:

### 1. Apply Database Migrations

The payment lifecycle schema has been split into separate stages. Push the migration files via Supabase CLI:

```bash
cd App
supabase db push
```

This applies:
- `App/supabase/migrations/20260809120000_payment_lifecycle_split.sql` — Creates `awaiting_payment`, `awaiting_checkin`, and `pending` states
- `App/supabase/migrations/20260809120001_drop_create_order_with_inventory.sql` — Removes auto-deduction at order creation

**Do not skip this step.** Tables must be migrated before code can write to them.

### 2. Set Environment Variables

Populate all four Midtrans keys in:
- `.env.local` for local development
- Vercel Environment Variables for production

Deployment without these will cause payment endpoints to fail silently.

## Testing Checklist

- [ ] DB migrations applied (`supabase db push` succeeded)
- [ ] Env vars set and verified (check Vercel dashboard or `.env.local`)
- [ ] Webhook URL registered in Midtrans Dashboard
- [ ] Sandbox orders created and paid via Snap simulator
- [ ] Webhook callback received and order marked `paid`
- [ ] Stock deducted upon confirmation
- [ ] Cash orders checked in from register and enter queue
- [ ] Kasir dashboard shows `needsCash=true` for pending cash orders

## Disabling Payment (Fallback)

If Midtrans is unavailable:
- Unset all four `MIDTRANS_*` env vars
- Frontend will disable the online payment option
- Only Pay at Cashier flow will work

## Notes

- The QR check-in code is 8 characters, generated per order, and is unique per session
- Webhook idempotency is guaranteed via the order's existing payment status
- Rate limiting is applied to the check-in and charge endpoints to prevent brute-force attacks
