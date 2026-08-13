# Customer Checkout Remake Design

## Goal

Remake the recently merged add-to-cart and ordering workflow into a polished, calm, two-stage table-order experience while correcting total consent, recovery, accessibility, terminal status, and payment-state integrity defects.

## Decisions

- Use the compact two-stage approach recommended by the fresh Sol audit: **Pesananmu** then **Konfirmasi & bayar**.
- Preserve `createOrder` payload fields, online/cashier channel semantics, Midtrans QRIS lifecycle, cart persistence, stock retry, and token-bearing order URLs.
- Add a server-only, read-only quote route backed by a service-role-only Postgres RPC. The browser does not calculate authoritative prices, options, tax, or service.
- Quote returns canonical line items, subtotal, service percentage/amount, tax percentage/amount, prices-include-tax flag, and total. It makes no order row, inventory claim, or payment transaction.
- Quote is requested when entering confirmation and must be refreshed after returning to edit. Submission is disabled until the current cart has a successful quote.
- If the order returned by `createOrder` differs from the approved quote, do not start payment automatically. Navigate to the order route with a `reviewTotal` marker so the order screen explicitly asks the customer to acknowledge the new total before QRIS is charged. The cart is cleared only after order creation succeeds and the recovery stub is saved.
- Distinguish order fetch outcomes: loaded, not-found, and transient failure. Retry preserves the URL token.
- Render completed and cancelled as terminal states and stop polling them.

## Interfaces

### Quote API

`POST /api/orders/quote`

Request:

```ts
{
  cafeId: string;
  items: Array<{ id_menu: string; qty: number; options: string[] }>;
}
```

Response `200`:

```ts
interface OrderQuote {
  items: OrderItem[];
  subtotal: number;
  tax_pct: number;
  tax_amount: number;
  service_pct: number;
  service_amount: number;
  prices_include_tax: boolean;
  total: number;
}
```

Invalid/unavailable input uses the same safe public messages as order creation. The route is rate-limited per IP and cafe and calls only `supabaseAdmin.rpc("quote_order", ...)`.

### Database

`public.quote_order(p_cafe_id uuid, p_items jsonb) returns jsonb`

- `security definer set search_path = public`
- validates menus, required option groups, option ownership, quantities, activity, and canonical prices with the same rules as the active `create_order`; neither RPC applies menu scheduling predicates
- uses `effective_tax_settings(p_cafe_id)` and identical integer rounding
- has no writes and does not inspect or mutate inventory
- revokes execute from `public`, `anon`, and `authenticated`; grants only `service_role`

### Order fetch

`fetchOrder` throws a typed `OrderFetchError` with `kind: "not-found" | "transient"`. `OrderView` owns a discriminated loading state and exposes retry for transient failures.

## UX and Accessibility

- Flat editable order rows, one table field, one optional notes field, and one sticky “Lanjut” action.
- Confirmation uses one elevated surface, native radio inputs, visible total breakdown, and “Edit pesanan”.
- Commit bar repeats table and total and uses channel-specific copy.
- All targets are at least 44px. Focus moves to the confirmation heading or first invalid field. Errors announce through live regions. Reduced motion is honored.
- 375px and 430px have no horizontal overflow.

## Testing

- TDD every new quote, state, and interaction behavior.
- Route tests prove normalized option IDs and service-role RPC use.
- Database contract tests prove no writes, explicit grants, canonical tax/service calculation, and matching validation fragments.
- Cart tests prove quote gating, breakdown, native radios, dynamic labels, back/edit preservation, blank-table focus, offline state, duplicate-submit lock, unchanged create payload, and stock retry.
- Order tests prove 404 vs transient recovery, total-change acknowledgement, completed/cancelled rendering, and terminal polling cleanup.
- Run focused tests, full serial test suite, typecheck, changed-file ESLint, build, diff check, and browser QA at 375×812 and 430px.

## Excluded Scope

- No menu browsing redesign beyond the existing add/quantity/cart-entry affordances.
- Midtrans charge and settlement receive fail-closed active-order guards; cashier check-in authorization and dashboard scope remain unchanged.
- No new dependency.
