# Multi-Method Payment + Pay-at-Cashier Check-in — Design

**Date:** 2026-08-09
**Status:** Approved (design), pending spec review
**Author:** brainstorm session (henzostar)

## 1. Problem & Goal

Current 3Diner payment supports only **QRIS** (Midtrans Core API) and **cash**. Cash
orders enter the kasir queue immediately and stock is deducted at order creation.

Goals, mirroring ESB's ordering system:

1. **QRIS online payment** — one dynamic QR that can be scanned by QRIS-supporting
   e-wallets and mobile-banking apps.
2. **Pay-at-Cashier flow with a QR check-in gate** — cash orders produce a QR +
   8-digit code the customer shows to the cashier; the order does **not** enter the
   kasir queue (and stock is **not** deducted) until the cashier checks it in.
3. **Security parity with ESB** — keep every existing guard and add the ones the new
   flows require.
4. **World-class UI** — customer payment screen and kasir check-in built with the
   `impeccable` design skill; reuse `needmcp` design-system components where useful.

## 2. Approved Decisions

| # | Decision |
|---|----------|
| Architecture | Midtrans Core API QRIS `/v2/charge` (one dynamic multi-app QR) |
| Online methods | QRIS; customers choose their QRIS-supporting app when scanning. |
| Online initiator | Customer, on their own phone (existing dinein self-order flow) |
| Cash | Retained, redesigned as **Pay at Cashier** with QR check-in gate |
| Cash QR meaning | **Order identifier** (not a QRIS charge) — cashier scans/keys to pull order |
| Kasir queue entry | Cash: only **after** cashier check-in. Online: on **payment settlement**. |
| Stock deduction | Deferred to confirmation for **both** flows (online: on paid; cash: on check-in) |
| Check-in code | 8-digit human code + QR; cashier may **scan camera** or **type code** |
| qr-proxy | **Keep** (download-QR feature retained) |

## 3. Architecture & Flow

Two payment-method tabs on the customer order screen (mirror ESB):

```
Payment Method:   [ Online Payment ]      [ Pay at Cashier ]
```

### 3.1 Online Payment → Midtrans QRIS

```
customer confirms order (Online)
  → POST /api/payment/charge      (server builds QRIS transaction)
      → order created: payment_status 'awaiting_payment', NOT in kasir queue, stock NOT deducted
      → returns the dynamic QR image URL
  → customer scans the QR with any supported QRIS app
  → Midtrans processes and sends the notification
  → POST /api/payment/webhook     (signature-verified notification)
      → on settlement/capture: confirm_order() → re-validate + deduct stock atomically
        → status 'received' → ENTERS kasir queue; payment_status 'paid';
          payment_method = actual Midtrans payment_type (qris/gopay/shopeepay/bank_transfer/…)
```

### 3.2 Pay at Cashier (cash) → QR check-in gate

```
customer confirms order (Pay at Cashier)
  → order created: payment_status 'awaiting_checkin', payment_method 'cash',
    NOT in kasir queue, stock NOT deducted, checkin_code generated
  → screen shows: QR (encodes {order_id, checkin_code}) + 8-DIGIT CODE + "show to cashier"
  → cashier SCANS QR or TYPES the 8-digit code
      → POST /api/kasir/checkin   (cashier-authenticated, cafe-scoped)
          → confirm_order() → re-validate + deduct stock atomically
            → status 'received' → ENTERS kasir queue
  → cashier receives cash → mark_order_cash_paid() → payment_status 'paid'   (existing)
```

## 4. Order Lifecycle Change (core)

Today `create_order_with_inventory` validates **and** deducts stock in one step.
Split into two RPCs:

- **`create_order`** — validate prices, variants, min/max option rules (reuse the exact
  server-side logic already in `create_order_with_inventory`), generate `customer_token`
  and (for cash) `checkin_code`. **Does NOT deduct stock.** Writes the order with a
  `pending`-family status. Returns order + tokens.
- **`confirm_order(p_order_id, ...)`** — called by the webhook (online) or the check-in
  endpoint (cash). **Re-validates stock and deducts atomically** (the deduction + movement
  logic currently in `create_order_with_inventory`), moves status to `received`.
  On shortage returns `insufficient_inventory` and the order does **not** proceed.

Rationale: abandoned/unpaid orders never consume stock. Re-validation at confirmation
closes the oversell window (last item, two simultaneous carts — whoever confirms first
wins, the other gets a clear "stok habis").

### 4.1 Status model

`payment_status`: `awaiting_payment` | `awaiting_checkin` | `pending` | `paid` | `unpaid`
- `awaiting_payment` — online order created, QRIS charge not yet started
- `awaiting_checkin` — cash order created, not yet shown/checked-in at cashier
- `pending` — QRIS transaction in flight; `payment_qr_url` identifies the active QR
- `paid` — settled (webhook) or cash received (kasir)
- `unpaid` — expired/cancelled/denied; customer may retry or switch method

`status` (fulfilment): unchanged set; order only reaches `received` (queue-visible) after
`confirm_order`. Orders in `awaiting_*` are **filtered out** of the kasir queue.

## 5. Database

- **New column** `Orders.checkin_code text` — 8-char Crockford base32, unique per cafe
  among un-checked-in orders. Generated server-side in `create_order`.
- **New column / reuse** — widen `payment_method` valid set:
  `cash | qris | gopay | shopeepay | dana | ovo | bank_transfer`. Store the raw Midtrans
  `payment_type` for online; `cash` for pay-at-cashier. Add a **CHECK constraint**.
- **New RPCs**: `create_order`, `confirm_order`, `checkin_order` (validates `checkin_code`
  constant-time, cafe-scoped, then calls `confirm_order`). All `security definer`,
  revoked from `anon`/`authenticated`, granted `service_role` only — matching the
  existing RPC hardening.
- `create_order_with_inventory` — kept temporarily for backward compat during migration,
  then removed once callers switch. (Plan will sequence this.)
- `set_order_payment_method` / `mark_order_cash_paid` — unchanged.

## 6. Backend Endpoints

- **`POST /api/payment/charge`** (rewrite) — build a QRIS transaction via
  `POST {baseUrl}/v2/charge` with Basic auth (server key), `payment_type: "qris"`,
  `transaction_details` (order_id, gross_amount computed server-side), and
  `item_details`. Atomic claim (`awaiting_payment` → `pending`) and per-IP rate limit
  **retained**. Returns `{ qris_url }` and persists it for order-link recovery.
- **`POST /api/payment/webhook`** (patch) — keep HMAC-SHA512 signature verify, gross_amount
  and status_code checks. On settlement call `confirm_order`; set `payment_method` from the
  notification's real `payment_type`. Idempotent (Midtrans re-sends). Expire/cancel/deny →
  `unpaid`.
- **`POST /api/kasir/checkin`** (new) — cashier-authenticated, cafe-scoped. Body:
  `{ order_id, checkin_code }` (from scan or manual entry). Calls `checkin_order`. Rate
  limited. Returns the confirmed order for the queue.
- **`GET /api/payment/qr-proxy`** (keep) — SSRF host allowlist retained; only used for the
  download-QR feature.

## 7. Frontend

Built with the **`impeccable`** design skill (world-class visual quality). Where a
solid primitive exists, pull from **`needmcp`** design-system components rather than
hand-rolling.

- **Customer — Payment Method screen**: two-tab selector (`Online Payment` /
  `Pay at Cashier`), mirroring the ESB layout the user referenced.
  - Online → render the dynamic QRIS image, show supported payer-app guidance, and
    poll the server until the signed Midtrans webhook confirms settlement.
  - Pay at Cashier → success screen with **QR + 8-digit code**, ordered-items summary,
    total, and a clear "show this to the cashier" callout (ESB-style).
- **Kasir — check-in**: camera **QR scanner** + a manual 8-digit code input fallback.
  On check-in the order animates into the queue. `awaiting_*` orders are hidden until
  checked in.
- **Theming**: respect existing `globals.css` tokens; light/dark parity.

## 8. Security ("as secure as ESB")

Retained from current system:
- Server key server-side only; QR image URL is allowlisted to Midtrans hosts.
- Webhook HMAC-SHA512 signature verification; gross_amount == order total; status_code check.
- Settlement only via webhook; `pending → paid` atomic; cash `paid` only via kasir.
- Atomic claim prevents double-charge; per-IP rate limits.
- All prices/options computed server-side (client never trusted).
- RLS + `security definer` RPCs, revoked from anon/authenticated, `service_role` only.

Added for the new flows:
- `checkin_code` generated server-side, compared **constant-time**; check-in restricted to
  the **owning cafe's** cashier (RLS/cafe scope).
- `confirm_order` re-validates and deducts stock **atomically** (anti-oversell).
- Webhook idempotency (safe on repeated delivery).
- **QRIS URL persistence** is constrained to `api.midtrans.com` and its sandbox host.

## 9. Testing

- Rewrite `payment-charge.test.ts` — QRIS URL creation, atomic claim, URL reuse, and rate limit.
- Update `order-payment-sync.test.ts` — webhook sets dynamic `payment_method`, calls
  `confirm_order`, idempotent re-delivery, amount-mismatch reject.
- New `kasir-checkin.test.ts` — valid check-in confirms + deducts; wrong/expired code
  rejected; cross-cafe check-in denied; stock-shortage at check-in handled.
- New `order-lifecycle.test.ts` — `create_order` deducts nothing; `confirm_order`
  deducts once; abandoned order leaves stock intact; oversell race resolves to one winner.
- Keep `qr-proxy-ssrf.test.ts`.

## 10. Out of Scope (YAGNI)

- Credit/debit cards (3DS).
- Kasir-initiated online payments (customer self-serves).
- Refunds / partial payments / split bills.
- Loyalty/voucher integration (ESB's Ayomakan-style layer).

## 11. Config / Env

- `MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION`.
- API base for charge: `https://api.sandbox.midtrans.com` / `https://api.midtrans.com`.
