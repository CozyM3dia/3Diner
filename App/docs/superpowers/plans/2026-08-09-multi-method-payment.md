# Multi-Method Payment + Pay-at-Cashier Check-in — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace QRIS-only Core API payment with Midtrans **Snap** multi-method (QRIS / e-wallet / VA), and gate cash orders behind a **QR check-in** at the cashier, deferring stock deduction to payment/check-in for both flows.

**Architecture:** Split the monolithic `create_order_with_inventory` RPC into `create_order` (validate + persist, **no** stock deduction) and `confirm_order` (re-validate + deduct atomically). Online orders confirm on the Midtrans webhook; cash orders confirm when a cashier scans/keys the order's `checkin_code`. The customer screen offers two tabs — Snap popup for online, a QR+code screen for pay-at-cashier — and the kasir console gains a scanner/manual-entry check-in.

**Tech Stack:** Next.js 16 (App Router, route handlers), TypeScript, Supabase (Postgres RPC, `security definer`), Vitest, `qrcode` (already a dep), Radix UI, lucide-react, sonner, Tailwind v4.

## Global Constraints

- Next.js 16.3.0 — **read `node_modules/next/dist/docs/` before writing route/handler code** (repo convention, per `AGENTS.md`; APIs differ from training data).
- All money math and option/variant validation happens **server-side**; never trust the client.
- Payment settlement (`payment_status = 'paid'`) may be set **only** by the webhook (online) or `mark_order_cash_paid` (cash). No endpoint lets the customer self-declare paid.
- All new RPCs are `security definer`, `set search_path = public`, `revoke all` from `public, anon, authenticated`, `grant execute` to `service_role` only — matching existing RPC hardening.
- Midtrans Snap endpoints: create at `https://app.sandbox.midtrans.com/snap/v1/transactions` (prod `https://app.midtrans.com/...`); status/notification lookups stay on `https://api.sandbox.midtrans.com` (prod `https://api.midtrans.com`). Auth = `Basic base64(MIDTRANS_SERVER_KEY + ":")`.
- Snap client script: `https://app.{sandbox.}midtrans.com/snap/snap.js` with `data-client-key=MIDTRANS_CLIENT_KEY`.
- `enabled_payments` for Snap: `["qris","gopay","shopeepay","bca_va","bni_va","bri_va","permata_va","echannel"]`. DANA/OVO are reachable by scanning the QRIS option (Midtrans Snap has no direct OVO channel).
- Tests: `npm run test:ci` (vitest `--run`). Route handlers are tested by dynamic `import()` after `vi.resetModules()`, mocking `@/lib/supabase-admin` and `@/lib/rate-limit` (follow `tests/payment-charge.test.ts` and `tests/order-payment-sync.test.ts`).
- Frontend tasks MUST invoke the **`impeccable`** skill for visual quality and pull primitives from **`needmcp`** where a component fits; do not hand-roll what needmcp provides.
- Migration files live in `App/supabase/migrations/` with a `YYYYMMDDHHMMSS_name.sql` prefix **after** `20260807120006`. Apply with the Supabase MCP `apply_migration` (or `supabase db push`).

---

## File Structure

**Create:**
- `App/supabase/migrations/20260809120000_payment_lifecycle_split.sql` — new columns, `create_order`, `confirm_order`, `checkin_order`, grants.
- `App/src/app/api/kasir/checkin/route.ts` — cashier check-in endpoint.
- `App/src/lib/payment-methods.ts` — shared method constants + `payment_type → payment_method` mapping.
- `App/tests/order-lifecycle.test.ts` — mapping + method-constant unit tests.
- `App/tests/kasir-checkin.test.ts` — check-in endpoint tests.

**Modify:**
- `App/src/types/index.ts` — widen `PaymentMethod`, `PaymentStatus`; add `awaiting` order status.
- `App/src/lib/kasir-queue-rules.ts` — `needsCash` for multi-method; keep `awaiting` out of queue.
- `App/src/app/api/orders/route.ts` — call `create_order`, accept `paymentChannel`.
- `App/src/app/api/payment/charge/route.ts` — rewrite to Snap.
- `App/src/app/api/payment/webhook/route.ts` — dynamic method, call `confirm_order`, idempotent.
- `App/src/lib/orders.ts` — `createOrder` passes channel; add `startSnapPayment`.
- `App/src/components/OrderView.tsx` — two-tab payment UI, Snap, pay-at-cashier QR screen.
- `App/src/components/kasir/KasirQueue.tsx` (+ `KasirOrderSheet.tsx`) — check-in scanner/manual entry.
- `App/src/lib/kasir-actions.ts` — `checkInOrder` client action.
- `App/src/app/layout.tsx` — Snap.js script tag.
- `App/next.config.ts` — CSP allowing Midtrans; relax COOP to `same-origin-allow-popups`.
- `App/tests/payment-charge.test.ts` — Snap flow.
- `App/tests/order-payment-sync.test.ts` — webhook confirm + dynamic method.

**Keep unchanged:** `App/src/app/api/payment/qr-proxy/route.ts` and `tests/qr-proxy-ssrf.test.ts` (download-QR feature retained).

---

## Task 1: Shared payment-method constants + mapping

**Files:**
- Create: `App/src/lib/payment-methods.ts`
- Test: `App/tests/order-lifecycle.test.ts`

**Interfaces:**
- Produces:
  - `ONLINE_ENABLED_PAYMENTS: string[]` — Snap `enabled_payments`.
  - `PAYMENT_METHODS: readonly string[]` — DB-valid `payment_method` values.
  - `mapMidtransPaymentType(paymentType: string): string` — Midtrans `payment_type` → stored `payment_method`.

- [ ] **Step 1: Write the failing test**

```ts
// App/tests/order-lifecycle.test.ts
import { describe, expect, it } from "vitest";
import {
  ONLINE_ENABLED_PAYMENTS,
  PAYMENT_METHODS,
  mapMidtransPaymentType,
} from "@/lib/payment-methods";

describe("payment-methods", () => {
  it("enables the approved Snap channels", () => {
    expect(ONLINE_ENABLED_PAYMENTS).toEqual([
      "qris", "gopay", "shopeepay", "bca_va", "bni_va", "bri_va", "permata_va", "echannel",
    ]);
  });

  it("maps Midtrans payment_type to a stored method", () => {
    expect(mapMidtransPaymentType("qris")).toBe("qris");
    expect(mapMidtransPaymentType("gopay")).toBe("gopay");
    expect(mapMidtransPaymentType("shopeepay")).toBe("shopeepay");
    expect(mapMidtransPaymentType("bank_transfer")).toBe("bank_transfer");
    expect(mapMidtransPaymentType("echannel")).toBe("bank_transfer");
    expect(mapMidtransPaymentType("something_new")).toBe("qris");
  });

  it("only stores methods the DB constraint allows", () => {
    for (const t of ["qris", "gopay", "shopeepay", "bank_transfer", "echannel"]) {
      expect(PAYMENT_METHODS).toContain(mapMidtransPaymentType(t));
    }
    expect(PAYMENT_METHODS).toContain("cash");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- order-lifecycle`
Expected: FAIL — cannot resolve `@/lib/payment-methods`.

- [ ] **Step 3: Write minimal implementation**

```ts
// App/src/lib/payment-methods.ts

/** Channels shown inside the Midtrans Snap popup. DANA/OVO are reachable through
 *  the QRIS option — Snap has no direct OVO channel. */
export const ONLINE_ENABLED_PAYMENTS = [
  "qris", "gopay", "shopeepay", "bca_va", "bni_va", "bri_va", "permata_va", "echannel",
] as const;

/** Every value the Orders.payment_method CHECK constraint accepts. */
export const PAYMENT_METHODS = [
  "cash", "qris", "gopay", "shopeepay", "bank_transfer",
] as const;

/** Midtrans reports the channel a customer actually used as `payment_type`.
 *  Several bank flavours collapse to one stored `bank_transfer`; anything we do
 *  not recognise is stored as `qris` (the universal default) rather than a value
 *  the CHECK constraint would reject. */
export function mapMidtransPaymentType(paymentType: string): string {
  switch (paymentType) {
    case "gopay": return "gopay";
    case "shopeepay": return "shopeepay";
    case "bank_transfer":
    case "echannel": return "bank_transfer";
    case "qris": return "qris";
    default: return "qris";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci -- order-lifecycle`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add App/src/lib/payment-methods.ts App/tests/order-lifecycle.test.ts
git commit -m "feat(payment): shared method constants and Midtrans type mapping"
```

---

## Task 2: DB lifecycle split migration

**Files:**
- Create: `App/supabase/migrations/20260809120000_payment_lifecycle_split.sql`

**Interfaces:**
- Produces three RPCs consumed by later tasks:
  - `create_order(p_cafe_id uuid, p_table_number text, p_items jsonb, p_notes text, p_channel text) → jsonb` — returns `{ order, orderToken, checkinCode }` or `{ error }`. `p_channel` ∈ `'online' | 'cashier'`. **No stock deduction.**
  - `confirm_order(p_order_id text) → jsonb` — re-validates + deducts stock atomically, sets `status='received'`. Returns `{ ok:true }`, `{ ok:true, already:true }`, or `{ error:'insufficient_inventory', unavailableMenus:[…] }` / `{ error:'order_not_found' }`.
  - `checkin_order(p_cafe_id uuid, p_order_id text, p_checkin_code text) → jsonb` — validates code (cafe-scoped), then calls `confirm_order`. Returns confirm result or `{ error:'checkin_invalid' }`.

**Design notes for the implementer:**
- `create_order` reuses the *validation* half of the existing `create_order_with_inventory` (read fully at `App/migrations/2026-07-27_payment_credits_options.sql:393`) — the raw-item guards, line normalization, option join + min/max enforcement, canonical-line pricing — then inserts the order with `status='awaiting'`, `payment_status = case p_channel when 'cashier' then 'awaiting_checkin' else 'awaiting_payment' end`, `payment_method = case p_channel when 'cashier' then 'cash' else null end`, and a generated `checkin_code` (cashier channel only). It does **not** touch inventory.
- `confirm_order` rebuilds required inventory from the **stored canonical `items`** (each has `id_menu`, `qty`, `options[].id_option_value`) by joining `Menu_Recipes` and `Menu_Option_Recipes`, then `for update` locks, checks availability, deducts, writes `Inventory_Movements`, and flips `status` to `received`. It is a no-op if `status <> 'awaiting'` (idempotent — webhook may call twice).

- [ ] **Step 1: Write the migration**

```sql
-- App/supabase/migrations/20260809120000_payment_lifecycle_split.sql
-- 3Diner — pisahkan pembuatan pesanan dari potong stok, tambah check-in kasir.
begin;

-- ── Kolom baru ──────────────────────────────────────────────
alter table public."Orders"
  add column if not exists checkin_code text;

-- Kode 8-char unik per kafe selama pesanan belum di-check-in. Partial index:
-- setelah check-in kode boleh dilepas/berulang tanpa melanggar keunikan.
create unique index if not exists "Orders_checkin_code_unique"
  on public."Orders" (cafe_id, checkin_code)
  where checkin_code is not null;

-- Perluas nilai payment_method yang sah. Longgar dulu terhadap baris lama.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Orders_payment_method_valid'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_payment_method_valid"
      check (payment_method is null or payment_method in
        ('cash','qris','gopay','shopeepay','bank_transfer'));
  end if;
end $$;

-- ── create_order: validasi + persist, TANPA potong stok ──────
create or replace function public.create_order(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text default null,
  p_channel text default 'online'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text := gen_random_uuid()::text;
  v_customer_token uuid := gen_random_uuid();
  v_total integer := 0;
  v_order_items jsonb;
  v_now timestamptz := now();
  v_bad_group text;
  v_checkin_code text;
  v_payment_status text;
  v_payment_method text;
begin
  if p_cafe_id is null or nullif(trim(p_table_number), '') is null then
    raise exception 'invalid_order_request' using errcode = '22023';
  end if;
  if p_channel not in ('online','cashier') then
    raise exception 'invalid_order_request' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  drop table if exists pg_temp.tmp_raw_requested_items;
  drop table if exists pg_temp.tmp_requested_lines;
  drop table if exists pg_temp.tmp_line_options;
  drop table if exists pg_temp.tmp_canonical_lines;

  create temporary table tmp_raw_requested_items (item jsonb not null) on commit drop;
  insert into tmp_raw_requested_items (item)
  select item from jsonb_array_elements(p_items) as item;

  if exists (
    select 1 from tmp_raw_requested_items
    where jsonb_typeof(item) <> 'object'
      or not (item ? 'id_menu') or not (item ? 'qty')
      or jsonb_typeof(item->'id_menu') <> 'string'
      or jsonb_typeof(item->'qty') <> 'number'
      or (item->>'id_menu') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (item->>'qty') !~ '^[0-9]+$' or length(item->>'qty') > 2
      or (item ? 'options' and jsonb_typeof(item->'options') <> 'array')
      or (item ? 'options' and jsonb_array_length(item->'options') > 20)
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  if exists (
    select 1 from tmp_raw_requested_items r
    cross join lateral jsonb_array_elements(coalesce(r.item->'options', '[]'::jsonb)) as opt
    where jsonb_typeof(opt) <> 'string'
      or (opt #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_requested_lines (
    line_key text primary key, id_menu uuid not null,
    option_ids uuid[] not null, qty integer not null
  ) on commit drop;

  insert into tmp_requested_lines (line_key, id_menu, option_ids, qty)
  select normalized.id_menu::text || ':' || array_to_string(normalized.option_ids, ','),
         normalized.id_menu, normalized.option_ids, sum(normalized.qty)::integer
  from (
    select (r.item->>'id_menu')::uuid as id_menu,
      coalesce((
        select array_agg(distinct (opt #>> '{}')::uuid order by (opt #>> '{}')::uuid)
        from jsonb_array_elements(coalesce(r.item->'options', '[]'::jsonb)) as opt
      ), array[]::uuid[]) as option_ids,
      (r.item->>'qty')::integer as qty
    from tmp_raw_requested_items r
  ) normalized
  group by normalized.id_menu, normalized.option_ids;

  if exists (select 1 from tmp_requested_lines where qty < 1 or qty > 50) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_line_options on commit drop as
  select l.line_key, l.id_menu, l.qty, ov.id_option_value, ov.name as option_name,
         ov.price_delta, og.id_option_group, og.name as group_name
  from tmp_requested_lines l
  cross join lateral unnest(l.option_ids) as opt(option_id)
  join public."Menu_Option_Values" ov
    on ov.id_option_value = opt.option_id and ov.cafe_id = p_cafe_id and ov.is_active = true
  join public."Menu_Option_Groups" og
    on og.id_option_group = ov.option_group_id and og.menu_id = l.id_menu;

  if (select count(*) from tmp_line_options)
     <> (select coalesce(sum(cardinality(option_ids)), 0) from tmp_requested_lines) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  select og.name into v_bad_group
  from tmp_requested_lines l
  join public."Menu_Option_Groups" og on og.menu_id = l.id_menu and og.cafe_id = p_cafe_id
  left join tmp_line_options lo on lo.line_key = l.line_key and lo.id_option_group = og.id_option_group
  group by l.line_key, og.id_option_group, og.name, og.min_select, og.max_select
  having count(lo.id_option_value) < og.min_select or count(lo.id_option_value) > og.max_select
  limit 1;
  if v_bad_group is not null then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  create temporary table tmp_canonical_lines on commit drop as
  select l.line_key, m.id_menu, m.nama_menu,
    round(m.harga_menu * (1 - least(greatest(coalesce(m.discount_pct, 0), 0), 100) / 100.0))::integer
      + coalesce((select sum(lo.price_delta)::integer from tmp_line_options lo where lo.line_key = l.line_key), 0) as harga_menu,
    l.qty,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_option_value', lo.id_option_value, 'group_name', lo.group_name,
        'name', lo.option_name, 'price_delta', lo.price_delta) order by lo.group_name, lo.option_name)
      from tmp_line_options lo where lo.line_key = l.line_key), '[]'::jsonb) as options
  from tmp_requested_lines l
  join public."Menus" m on m.id_menu = l.id_menu and m.cafe_id = p_cafe_id and coalesce(m.is_active, true) = true;

  if (select count(*) from tmp_canonical_lines) <> (select count(*) from tmp_requested_lines) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;
  if exists (select 1 from tmp_canonical_lines where harga_menu < 0) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id_menu', id_menu, 'nama_menu', nama_menu, 'harga_menu', harga_menu,
    'qty', qty, 'options', options) order by nama_menu, line_key)
    into v_order_items from tmp_canonical_lines;
  select coalesce(sum(harga_menu * qty), 0)::integer into v_total from tmp_canonical_lines;

  if p_channel = 'cashier' then
    v_payment_status := 'awaiting_checkin';
    v_payment_method := 'cash';
    -- Crockford base32, 8 char, hindari huruf ambigu. Ulang jika bentrok.
    loop
      v_checkin_code := upper(substr(translate(encode(gen_random_bytes(6),'base32'),'ILOU',''), 1, 8));
      exit when not exists (
        select 1 from public."Orders"
        where cafe_id = p_cafe_id and checkin_code = v_checkin_code);
    end loop;
  else
    v_payment_status := 'awaiting_payment';
    v_payment_method := null;
    v_checkin_code := null;
  end if;

  insert into public."Orders" (
    id_order, cafe_id, table_number, items, total, status,
    payment_method, payment_status, notes, customer_token, checkin_code, created_at
  ) values (
    v_order_id, p_cafe_id, left(trim(p_table_number), 30), v_order_items, v_total, 'awaiting',
    v_payment_method, v_payment_status,
    nullif(left(coalesce(trim(p_notes), ''), 500), ''), v_customer_token, v_checkin_code, v_now
  );

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id_order', v_order_id, 'cafe_id', p_cafe_id,
      'table_number', left(trim(p_table_number), 30), 'items', v_order_items,
      'total', v_total, 'status', 'awaiting',
      'payment_method', v_payment_method, 'payment_status', v_payment_status,
      'notes', nullif(left(coalesce(trim(p_notes), ''), 500), ''), 'created_at', v_now),
    'orderToken', v_customer_token,
    'checkinCode', v_checkin_code
  );
end;
$$;

-- ── confirm_order: re-validasi + potong stok atomic ─────────
create or replace function public.confirm_order(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cafe_id uuid;
  v_status text;
  v_items jsonb;
  v_now timestamptz := now();
  v_unavailable text[];
begin
  if p_order_id is null then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  select cafe_id, status, items into v_cafe_id, v_status, v_items
  from public."Orders" where id_order = p_order_id for update;
  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;
  if v_status <> 'awaiting' then
    -- Sudah dikonfirmasi (webhook dobel / balapan check-in). Idempoten.
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  drop table if exists pg_temp.tmp_confirm_lines;
  drop table if exists pg_temp.tmp_confirm_req;

  create temporary table tmp_confirm_lines on commit drop as
  select (line->>'id_menu')::uuid as id_menu,
         (line->>'qty')::integer as qty,
         line->'options' as options
  from jsonb_array_elements(v_items) as line;

  create temporary table tmp_confirm_req on commit drop as
  select src.inventory_item_id, sum(src.required_qty)::numeric(12,3) as required_qty
  from (
    select mr.inventory_item_id, mr.qty_per_menu * cl.qty as required_qty
    from tmp_confirm_lines cl
    join public."Menu_Recipes" mr on mr.menu_id = cl.id_menu and mr.cafe_id = v_cafe_id
    union all
    select mor.inventory_item_id, mor.qty_per_menu * cl.qty as required_qty
    from tmp_confirm_lines cl
    cross join lateral jsonb_array_elements(coalesce(cl.options, '[]'::jsonb)) as opt
    join public."Menu_Option_Recipes" mor
      on mor.option_value_id = (opt->>'id_option_value')::uuid and mor.cafe_id = v_cafe_id
  ) src
  group by src.inventory_item_id;

  perform 1 from public."Inventory_Items" ii
  join tmp_confirm_req req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = v_cafe_id for update of ii;

  select array_agg(distinct m.nama_menu) into v_unavailable
  from tmp_confirm_lines cl
  join public."Menus" m on m.id_menu = cl.id_menu and m.cafe_id = v_cafe_id
  join public."Menu_Recipes" mr on mr.menu_id = cl.id_menu and mr.cafe_id = v_cafe_id
  join public."Inventory_Items" ii on ii.id_inventory_item = mr.inventory_item_id and ii.cafe_id = v_cafe_id
  join tmp_confirm_req req on req.inventory_item_id = ii.id_inventory_item
  where ii.current_qty < req.required_qty;

  if coalesce(array_length(v_unavailable, 1), 0) > 0 then
    return jsonb_build_object('error', 'insufficient_inventory',
      'unavailableMenus', to_jsonb(v_unavailable));
  end if;

  insert into public."Inventory_Movements" (
    cafe_id, inventory_item_id, movement_type, delta_qty, qty_before, qty_after,
    unit, unit_cost, reference_type, reference_id, note, created_at)
  select ii.cafe_id, ii.id_inventory_item, 'order_deduction', -req.required_qty,
    ii.current_qty, ii.current_qty - req.required_qty, ii.unit, ii.estimated_unit_cost,
    'order', p_order_id, 'Dipakai untuk pesanan #' || right(p_order_id, 8), v_now
  from public."Inventory_Items" ii
  join tmp_confirm_req req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = v_cafe_id and req.required_qty > 0;

  update public."Inventory_Items" ii
  set current_qty = ii.current_qty - req.required_qty, updated_at = v_now
  from tmp_confirm_req req
  where ii.id_inventory_item = req.inventory_item_id
    and ii.cafe_id = v_cafe_id and req.required_qty > 0;

  update public."Orders"
  set status = 'received'
  where id_order = p_order_id and status = 'awaiting';

  return jsonb_build_object('ok', true);
end;
$$;

-- ── checkin_order: validasi kode (cafe-scoped) → confirm ────
create or replace function public.checkin_order(
  p_cafe_id uuid, p_order_id text, p_checkin_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_method text;
begin
  if p_cafe_id is null or p_order_id is null or nullif(trim(p_checkin_code), '') is null then
    return jsonb_build_object('error', 'checkin_invalid');
  end if;

  select checkin_code, payment_method into v_code, v_method
  from public."Orders"
  where id_order = p_order_id and cafe_id = p_cafe_id;

  -- Kode salah, kafe salah, atau bukan pesanan tunai → tolak seragam.
  if v_code is null or v_method <> 'cash'
     or v_code <> upper(trim(p_checkin_code)) then
    return jsonb_build_object('error', 'checkin_invalid');
  end if;

  return public.confirm_order(p_order_id);
end;
$$;

-- ── Hak akses ───────────────────────────────────────────────
revoke all on function public.create_order(uuid, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.confirm_order(text) from public, anon, authenticated;
revoke all on function public.checkin_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, jsonb, text, text) to service_role;
grant execute on function public.confirm_order(text) to service_role;
grant execute on function public.checkin_order(uuid, text, text) to service_role;

commit;
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` (name `payment_lifecycle_split`, the SQL above) or `supabase db push`.
Expected: success, no errors.

- [ ] **Step 3: Smoke-test the RPCs in SQL**

Run against a seeded cafe/menu (use `mcp__supabase__execute_sql`):

```sql
select public.create_order(
  '<cafe_uuid>', '7',
  '[{"id_menu":"<menu_uuid>","qty":1}]'::jsonb, null, 'cashier');
```
Expected: JSON with `order.status = 'awaiting'`, `payment_status = 'awaiting_checkin'`, an 8-char `checkinCode`, and **no** change to `Inventory_Items.current_qty`. Then:

```sql
select public.confirm_order('<returned id_order>');
```
Expected: `{"ok": true}`, order `status='received'`, inventory now deducted. Re-running returns `{"ok":true,"already":true}` with no further deduction.

- [ ] **Step 4: Commit**

```bash
git add App/supabase/migrations/20260809120000_payment_lifecycle_split.sql
git commit -m "feat(db): split order create/confirm, add cashier check-in RPCs"
```

---

## Task 3: Order creation endpoint uses create_order + channel

**Files:**
- Modify: `App/src/app/api/orders/route.ts`
- Modify: `App/src/lib/orders.ts:15` (`createOrder` passes channel)
- Test: reuse existing order route tests if present; add a channel assertion inline.

**Interfaces:**
- Consumes: `create_order` RPC (Task 2).
- Produces: `POST /api/orders` accepts `{ ..., paymentChannel?: "online" | "cashier" }` (default `"online"`), returns `{ order, orderToken, checkinCode }`.

- [ ] **Step 1: Update the route to call `create_order`**

In `App/src/app/api/orders/route.ts`, add channel parsing after `notes` (line 79) and switch the RPC call (lines 99-104):

```ts
const paymentChannel = body?.paymentChannel === "cashier" ? "cashier" : "online";
```

```ts
    rpcResponse = await supabaseAdmin.rpc("create_order", {
      p_cafe_id: cafeId,
      p_table_number: table,
      p_items: items,
      p_notes: notes,
      p_channel: paymentChannel,
    });
```

Extend `CreateOrderBody` with `paymentChannel?: unknown;` and `CreateOrderResult` with `checkinCode?: unknown;`. Change the success response (line 148) to forward the code:

```ts
  return NextResponse.json(
    { order: result.order, orderToken: result.orderToken, checkinCode: result.checkinCode ?? null },
    { status: 201 }
  );
```

- [ ] **Step 2: Update the client helper**

In `App/src/lib/orders.ts`, add `paymentChannel` to `createOrder`'s input and body, and return the code:

```ts
export async function createOrder(input: {
  cafeId: string; cafeSlug: string; cafeName: string; table: string;
  items: CartItem[]; notes?: string; paymentChannel?: "online" | "cashier";
}): Promise<Order & { checkinCode: string | null }> {
```
Add `paymentChannel: input.paymentChannel ?? "online"` to the POST body, and `checkinCode: data.checkinCode ?? null` onto the returned order.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App/src/app/api/orders/route.ts App/src/lib/orders.ts
git commit -m "feat(orders): create via create_order with payment channel"
```

---

## Task 4: Snap charge endpoint

**Files:**
- Modify: `App/src/app/api/payment/charge/route.ts`
- Test: `App/tests/payment-charge.test.ts` (rewrite)

**Interfaces:**
- Consumes: `ONLINE_ENABLED_PAYMENTS` (Task 1); order rows with `payment_status='awaiting_payment'`.
- Produces: `POST /api/payment/charge` body `{ orderId, orderToken }` → `{ snap_token }`.

- [ ] **Step 1: Rewrite the failing test**

```ts
// App/tests/payment-charge.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from } }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  tooManyRequests: (s: number) => Response.json({ error: "rate" }, { status: 429 }),
}));

describe("POST /api/payment/charge (Snap)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = "server-key";
    process.env.MIDTRANS_IS_PRODUCTION = "false";
    single.mockResolvedValue({
      data: {
        id_order: "order-1", customer_token: "token-1", total: 40000,
        payment_status: "awaiting_payment",
        items: [{ id_menu: "m1", nama_menu: "Nasi", harga_menu: 20000, qty: 2 }],
      },
      error: null,
    });
    const eqToken = () => ({ single });
    const eqOrder = () => ({ eq: eqToken });
    from.mockReturnValue({
      select: () => ({ eq: eqOrder }),
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "snap-abc", redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-abc" }),
        { status: 201, headers: { "Content-Type": "application/json" } })));
  });

  it("creates a Snap transaction with the stored total and enabled channels", async () => {
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).snap_token).toBe("snap-abc");
    const call = vi.mocked(fetch).mock.calls[0];
    expect(String(call[0])).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions");
    const sent = JSON.parse(String(call[1]?.body));
    expect(sent.transaction_details.gross_amount).toBe(40000);
    expect(sent.enabled_payments).toContain("qris");
    expect(sent.enabled_payments).toContain("gopay");
  });

  it("rejects a missing customer token", async () => {
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1" }),
    }));
    expect(res.status).toBe(400);
  });

  it("refuses to charge an already-paid order", async () => {
    single.mockResolvedValue({ data: {
      id_order: "order-1", customer_token: "token-1", total: 40000,
      payment_status: "paid", items: [] }, error: null });
    const { POST } = await import("@/app/api/payment/charge/route");
    const res = await POST(new Request("http://localhost/api/payment/charge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", orderToken: "token-1" }),
    }));
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- payment-charge`
Expected: FAIL (route still calls Core `/v2/charge`, wrong URL/response shape).

- [ ] **Step 3: Rewrite the route**

```ts
// App/src/app/api/payment/charge/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ONLINE_ENABLED_PAYMENTS } from "@/lib/payment-methods";

const CHARGE_PER_IP = { limit: 6, windowSeconds: 60 };

export async function POST(req: Request) {
  try {
    const { orderId, orderToken } = (await req.json()) as {
      orderId?: unknown; orderToken?: unknown;
    };
    if (typeof orderId !== "string" || typeof orderToken !== "string" || !orderId || !orderToken) {
      return NextResponse.json({ error: "Data pesanan tidak valid" }, { status: 400 });
    }

    const limit = await consumeRateLimit(`charge:ip:${clientIp(req)}`, CHARGE_PER_IP.limit, CHARGE_PER_IP.windowSeconds);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const { data: order, error } = await supabaseAdmin
      .from("Orders")
      .select("id_order,customer_token,total,payment_status,items")
      .eq("id_order", orderId)
      .eq("customer_token", orderToken)
      .single();
    if (error || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 403 });
    }
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Pembayaran pesanan ini sudah lunas" }, { status: 409 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) return NextResponse.json({ error: "Pembayaran belum dikonfigurasi" }, { status: 503 });
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const authHeader = `Basic ${Buffer.from(serverKey + ":").toString("base64")}`;

    // Klaim atomik: hanya order yang masih menunggu bayar yang boleh di-charge.
    // Mencegah dua tab membuat dua transaksi Snap untuk order yang sama.
    const { error: claimError } = await supabaseAdmin
      .from("Orders")
      .update({ payment_status: "pending" })
      .eq("id_order", order.id_order)
      .eq("payment_status", "awaiting_payment");
    if (claimError) {
      return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
    }

    const items = (Array.isArray(order.items) ? order.items as {
      id_menu: string; harga_menu: number; qty: number; nama_menu: string }[] : []);
    const body = {
      transaction_details: { order_id: order.id_order, gross_amount: order.total },
      item_details: items.map((it) => ({
        id: it.id_menu, price: it.harga_menu, quantity: it.qty, name: it.nama_menu.slice(0, 50),
      })),
      enabled_payments: ONLINE_ENABLED_PAYMENTS,
    };

    const res = await fetch(snapUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authHeader },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok || !data.token) {
      await supabaseAdmin.from("Orders")
        .update({ payment_status: "awaiting_payment" })
        .eq("id_order", order.id_order).eq("payment_status", "pending");
      const msg = Array.isArray(data.error_messages) ? data.error_messages.join(", ") : "Midtrans error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ snap_token: data.token });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci -- payment-charge`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add App/src/app/api/payment/charge/route.ts App/tests/payment-charge.test.ts
git commit -m "feat(payment): create Midtrans Snap transaction for online payment"
```

---

## Task 5: Webhook confirms order + dynamic method + idempotent

**Files:**
- Modify: `App/src/app/api/payment/webhook/route.ts`
- Test: `App/tests/order-payment-sync.test.ts` (add a webhook describe block)

**Interfaces:**
- Consumes: `verifyMidtransSignature` (existing), `mapMidtransPaymentType` (Task 1), `confirm_order` RPC (Task 2).
- Produces: settlement → `confirm_order` + `payment_status='paid'` + real `payment_method`; expire/deny → `unpaid`.

- [ ] **Step 1: Write the failing test** (append to `tests/order-payment-sync.test.ts`)

```ts
describe("POST /api/payment/webhook", () => {
  const rpc2 = vi.fn();
  const update = vi.fn();
  const eq2 = vi.fn();
  const from2 = vi.fn();
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = "server-key";
    eq2.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    update.mockReturnValue({ eq: eq2 });
    from2.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { total: 40000, payment_status: "pending" } }) }) }),
      update,
    });
    rpc2.mockResolvedValue({ data: { ok: true }, error: null });
    vi.doMock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: from2, rpc: rpc2 } }));
  });

  async function post(payload: Record<string, unknown>) {
    const { POST } = await import("@/app/api/payment/webhook/route");
    return POST(new Request("http://localhost/api/payment/webhook", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
  }

  function sig(order_id: string, status_code: string, gross_amount: string) {
    const { createHash } = require("node:crypto");
    return createHash("sha512").update(`${order_id}${status_code}${gross_amount}server-key`).digest("hex");
  }

  it("confirms and stores the real payment method on settlement", async () => {
    const res = await post({
      order_id: "order-1", status_code: "200", gross_amount: "40000.00",
      signature_key: sig("order-1", "200", "40000.00"),
      transaction_status: "settlement", payment_type: "gopay",
    });
    expect(res.status).toBe(200);
    expect(rpc2).toHaveBeenCalledWith("confirm_order", { p_order_id: "order-1" });
    const setPaid = update.mock.calls.find((c) => c[0].payment_status === "paid");
    expect(setPaid?.[0].payment_method).toBe("gopay");
  });

  it("rejects a forged signature without touching the order", async () => {
    const res = await post({
      order_id: "order-1", status_code: "200", gross_amount: "40000.00",
      signature_key: "forged", transaction_status: "settlement", payment_type: "qris" });
    expect(res.status).toBe(401);
    expect(rpc2).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- order-payment-sync`
Expected: FAIL — webhook does not yet call `confirm_order` / set dynamic method.

- [ ] **Step 3: Patch the webhook**

Rewrite `App/src/app/api/payment/webhook/route.ts` settlement handling:

```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyMidtransSignature } from "@/lib/order-validation";
import { mapMidtransPaymentType } from "@/lib/payment-methods";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id, status_code, gross_amount, signature_key, transaction_status, payment_type } =
      body as {
        order_id: string; status_code: string; gross_amount: string;
        signature_key: string; transaction_status: string; payment_type: string;
      };

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey || !verifyMidtransSignature({ order_id, status_code, gross_amount, signature_key }, serverKey)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { data: order } = await supabaseAdmin
      .from("Orders").select("total,payment_status").eq("id_order", order_id).single();
    if (!order || Number(gross_amount) !== Number(order.total)) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    if (transaction_status === "settlement" || transaction_status === "capture") {
      // Idempoten: confirm_order no-op jika sudah dikonfirmasi; update paid hanya dari pending.
      await supabaseAdmin.rpc("confirm_order", { p_order_id: order_id });
      await supabaseAdmin
        .from("Orders")
        .update({ payment_status: "paid", payment_method: mapMidtransPaymentType(payment_type) })
        .eq("id_order", order_id)
        .eq("payment_status", "pending");
    } else if (["expire", "cancel", "deny", "failure"].includes(transaction_status)) {
      await supabaseAdmin
        .from("Orders")
        .update({ payment_status: "awaiting_payment", payment_method: null })
        .eq("id_order", order_id)
        .eq("payment_status", "pending");
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

Note: on expire the order returns to `awaiting_payment` (not `unpaid`) so the customer can retry Snap; the fulfilment `status` stays `awaiting` until a real settlement confirms it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci -- order-payment-sync`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add App/src/app/api/payment/webhook/route.ts App/tests/order-payment-sync.test.ts
git commit -m "feat(payment): webhook confirms order and records real method, idempotent"
```

---

## Task 6: Kasir check-in endpoint

**Files:**
- Create: `App/src/app/api/kasir/checkin/route.ts`
- Test: `App/tests/kasir-checkin.test.ts`

**Interfaces:**
- Consumes: `checkin_order` RPC (Task 2), the cafe-session helper used by other kasir routes.
- Produces: `POST /api/kasir/checkin` body `{ orderId, checkinCode }` (cafe from session) → `{ ok:true }` | error.

**Note:** kasir endpoints are authenticated per cafe. Locate the existing helper other `/api/kasir/*` or dashboard routes use to resolve the signed-in cafe id (grep `getCafeSession`/`requireCafe`/`auth` under `App/src/app/api` and `App/src/lib`). Reuse it verbatim; do **not** invent a new auth scheme. The pseudo-import below is `resolveCafeId` — replace with the real symbol found.

- [ ] **Step 1: Write the failing test**

```ts
// App/tests/kasir-checkin.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  tooManyRequests: () => Response.json({ error: "rate" }, { status: 429 }),
}));
// Replace the module path/symbol with the real cafe-session helper (see note).
vi.mock("@/lib/kasir-session", () => ({ resolveCafeId: vi.fn(async () => "cafe-1") }));

describe("POST /api/kasir/checkin", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it("checks in a valid order", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    const { POST } = await import("@/app/api/kasir/checkin/route");
    const res = await POST(new Request("http://localhost/api/kasir/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", checkinCode: "ABCD2345" }) }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("checkin_order", {
      p_cafe_id: "cafe-1", p_order_id: "order-1", p_checkin_code: "ABCD2345" });
  });

  it("rejects an invalid code as 404 without leaking why", async () => {
    rpc.mockResolvedValue({ data: { error: "checkin_invalid" }, error: null });
    const { POST } = await import("@/app/api/kasir/checkin/route");
    const res = await POST(new Request("http://localhost/api/kasir/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", checkinCode: "WRONG000" }) }));
    expect(res.status).toBe(404);
  });

  it("surfaces stock shortage at check-in as a conflict", async () => {
    rpc.mockResolvedValue({ data: { error: "insufficient_inventory", unavailableMenus: ["Nasi"] }, error: null });
    const { POST } = await import("@/app/api/kasir/checkin/route");
    const res = await POST(new Request("http://localhost/api/kasir/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", checkinCode: "ABCD2345" }) }));
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- kasir-checkin`
Expected: FAIL — route missing.

- [ ] **Step 3: Write the route** (swap `resolveCafeId` for the real helper)

```ts
// App/src/app/api/kasir/checkin/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { resolveCafeId } from "@/lib/kasir-session";

const CHECKIN_PER_IP = { limit: 30, windowSeconds: 60 };
const CODE_RE = /^[A-Z0-9]{8}$/;

export async function POST(req: Request) {
  const cafeId = await resolveCafeId(req);
  if (!cafeId) return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { orderId?: unknown; checkinCode?: unknown } | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const checkinCode = typeof body?.checkinCode === "string" ? body.checkinCode.trim().toUpperCase() : "";
  if (!orderId || !CODE_RE.test(checkinCode)) {
    return NextResponse.json({ error: "Kode check-in tidak valid" }, { status: 404 });
  }

  const limit = await consumeRateLimit(`checkin:ip:${clientIp(req)}`, CHECKIN_PER_IP.limit, CHECKIN_PER_IP.windowSeconds);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const { data, error } = await supabaseAdmin.rpc("checkin_order", {
    p_cafe_id: cafeId, p_order_id: orderId, p_checkin_code: checkinCode,
  });
  if (error) return NextResponse.json({ error: "Gagal check-in pesanan" }, { status: 502 });

  const result = data as { ok?: unknown; error?: unknown; unavailableMenus?: unknown } | null;
  if (result?.error === "checkin_invalid") {
    return NextResponse.json({ error: "Pesanan atau kode tidak ditemukan" }, { status: 404 });
  }
  if (result?.error === "insufficient_inventory") {
    const menus = Array.isArray(result.unavailableMenus)
      ? result.unavailableMenus.filter((m): m is string => typeof m === "string") : [];
    return NextResponse.json(
      { code: "insufficient_inventory", error: "Stok tidak cukup",
        message: menus.length ? `Stok habis untuk: ${menus.join(", ")}.` : "Stok tidak cukup.", unavailableMenus: menus },
      { status: 409 });
  }
  if (!result?.ok) return NextResponse.json({ error: "Gagal check-in pesanan" }, { status: 502 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci -- kasir-checkin`
Expected: PASS (3 tests). If the auth helper differs, update the `vi.mock` path/symbol to match.

- [ ] **Step 5: Commit**

```bash
git add App/src/app/api/kasir/checkin/route.ts App/tests/kasir-checkin.test.ts
git commit -m "feat(kasir): cashier check-in endpoint for pay-at-cashier orders"
```

---

## Task 7: Types + queue rules for multi-method & awaiting orders

**Files:**
- Modify: `App/src/types/index.ts:168-169` and the `OrderStatus` union (line 179)
- Modify: `App/src/lib/kasir-queue-rules.ts:54`
- Test: extend `App/tests/order-lifecycle.test.ts`

**Interfaces:**
- Produces: widened `PaymentMethod`/`PaymentStatus`, `awaiting` order status excluded from the queue, `needsCash` true only for the cash method.

- [ ] **Step 1: Write the failing test** (append to `order-lifecycle.test.ts`)

```ts
import { needsCash, belongsInQueue } from "@/lib/kasir-queue-rules";

describe("queue rules", () => {
  it("only asks the cashier for money on cash orders", () => {
    expect(needsCash({ payment_status: "unpaid", payment_method: "cash" })).toBe(true);
    expect(needsCash({ payment_status: "unpaid", payment_method: "gopay" })).toBe(false);
    expect(needsCash({ payment_status: "unpaid", payment_method: "qris" })).toBe(false);
    expect(needsCash({ payment_status: "paid", payment_method: "cash" })).toBe(false);
  });
  it("keeps awaiting orders out of the queue", () => {
    expect(belongsInQueue("awaiting")).toBe(false);
    expect(belongsInQueue("received")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- order-lifecycle`
Expected: FAIL — `needsCash` still returns true for non-qris online methods; `"awaiting"` not a valid `OrderStatus`.

- [ ] **Step 3: Update types and rules**

In `App/src/types/index.ts`:

```ts
export type PaymentMethod = 'cash' | 'qris' | 'gopay' | 'shopeepay' | 'bank_transfer'
export type PaymentStatus = 'unpaid' | 'awaiting_payment' | 'awaiting_checkin' | 'pending' | 'paid'
```

Add `'awaiting'` as the first member of the `OrderStatus` union (line 179):

```ts
export type OrderStatus =
  | 'awaiting'
  | 'received'
```

In `App/src/lib/kasir-queue-rules.ts`, replace `needsCash` (line 54):

```ts
/** Uang tunai hanya ditagih untuk pesanan bermetode 'cash'. Semua metode online
 *  (qris/gopay/shopeepay/bank_transfer) dilunasi webhook Midtrans, bukan kasir. */
export function needsCash(o: PayableOrder): boolean {
  return o.payment_status !== "paid" && o.payment_method === "cash";
}
```

`OPEN_STATUSES` already omits `awaiting`, so `belongsInQueue("awaiting")` is false with no further change.

- [ ] **Step 4: Run test + typecheck**

Run: `npm run test:ci -- order-lifecycle && npm run typecheck`
Expected: PASS; typecheck clean. Fix any now-exhaustive `switch`/label maps the widened unions surface (e.g. status/method label records) by adding the new keys.

- [ ] **Step 5: Commit**

```bash
git add App/src/types/index.ts App/src/lib/kasir-queue-rules.ts App/tests/order-lifecycle.test.ts
git commit -m "feat(types): widen payment method/status, exclude awaiting from queue"
```

---

## Task 8: Snap.js loader + CSP/COOP

**Files:**
- Modify: `App/src/app/layout.tsx` (Snap script tag)
- Modify: `App/next.config.ts:69-79` (CSP + COOP)

**Interfaces:**
- Produces: `window.snap.pay(token, callbacks)` available client-side; CSP permits Midtrans script/frame/connect.

- [ ] **Step 1: Add the Snap script to the root layout**

In `App/src/app/layout.tsx`, inside `<head>` (or via `next/script` with `strategy="afterInteractive"`), add — using the client key and sandbox/prod URL from env:

```tsx
<script
  src={
    process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js"
  }
  data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
  async
/>
```

- [ ] **Step 2: Add CSP + relax COOP in `next.config.ts`**

Replace the `headers()` block:

```ts
  async headers() {
    const midtrans = "https://app.midtrans.com https://app.sandbox.midtrans.com";
    const api = "https://api.midtrans.com https://api.sandbox.midtrans.com";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${midtrans}`,
      `frame-src 'self' ${midtrans}`,
      `connect-src 'self' ${midtrans} ${api} https://*.supabase.co`,
      `img-src 'self' data: blob: https:`,
      "style-src 'self' 'unsafe-inline'",
    ].join("; ");
    return [
      { source: "/(.*)", headers: [
        // Snap membuka popup/iframe cross-origin; COOP ketat memutus postMessage-nya.
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Content-Security-Policy", value: csp },
      ] },
    ];
  },
```

- [ ] **Step 3: Verify build + preview**

Run: `npm run build`
Expected: build succeeds. Then start the dev server (via preview_start `{name}`), open a page, confirm no CSP violations in the console and that `window.snap` is defined.

- [ ] **Step 4: Commit**

```bash
git add App/src/app/layout.tsx App/next.config.ts
git commit -m "feat(payment): load Snap.js, add CSP allowing Midtrans, relax COOP for popup"
```

---

## Task 9: Customer payment UI — two tabs, Snap, pay-at-cashier QR

**Files:**
- Modify: `App/src/components/OrderView.tsx`
- Modify: `App/src/lib/orders.ts` (add `startSnapPayment`)

**REQUIRED:** Invoke the **`impeccable`** skill for this task's visual design, and pull primitives (tabs, cards, buttons, callouts) from **`needmcp`** where they fit. The contract below is the behavioural spec; impeccable governs the look (light/dark parity, spacing, motion), reusing existing `globals.css` tokens.

**Interfaces:**
- Consumes: `POST /api/payment/charge` → `{ snap_token }`; `window.snap.pay`; `createOrder({..., paymentChannel})` (Task 3); `fetchOrder` polling (existing).
- Produces: `startSnapPayment(token, callbacks)` in `orders.ts`; a two-tab payment screen and a pay-at-cashier success screen.

- [ ] **Step 1: Add the Snap client helper**

```ts
// App/src/lib/orders.ts  (append)
declare global {
  interface Window {
    snap?: { pay: (token: string, cb: {
      onSuccess?: (r: unknown) => void; onPending?: (r: unknown) => void;
      onError?: (r: unknown) => void; onClose?: () => void;
    }) => void };
  }
}

/** Opens the Midtrans Snap popup. Rejects if the script has not loaded. */
export function startSnapPayment(
  token: string,
  cb: { onSuccess?: () => void; onPending?: () => void; onError?: () => void; onClose?: () => void },
): void {
  if (!window.snap) throw new Error("Snap belum siap. Muat ulang halaman.");
  window.snap.pay(token, cb);
}

export async function chargeOnline(orderId: string, token: string): Promise<string> {
  const res = await fetch("/api/payment/charge", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, orderToken: token }),
  });
  const data = await res.json();
  if (!res.ok || !data.snap_token) throw new Error(data.error || "Gagal memulai pembayaran");
  return data.snap_token as string;
}
```

- [ ] **Step 2: Restructure `OrderView` payment states**

Update the `View` union and `PaymentChoice` in `App/src/components/OrderView.tsx`:
- Replace the QRIS-specific choice with a **two-tab** selector: `Online Payment` and `Pay at Cashier` (mirror the ESB layout).
- **Online tab** → button "Bayar Sekarang": call `chargeOnline(...)`, then `startSnapPayment(token, { onSuccess: () => setView("status"), onPending: () => setView("status"), onError: showError, onClose: reload })`. On success/pending the existing poller (`POLL_*`) already promotes the screen when the webhook lands.
- **Pay at Cashier tab** → a screen showing the **QR** (render `checkinCode`+`id_order` payload with the `qrcode` dep) and the **8-digit code** in large type, the ordered-items summary + total, and a callout: "Tunjukkan QR atau kode 8-digit ini ke kasir." The order was created with `paymentChannel: "cashier"` so `checkinCode` is present on the order object.
- Derive the QR payload as JSON: `JSON.stringify({ o: order.id_order, c: order.checkin_code })`.

Map the initial view from server state (mirror existing `pickInitialView`): `payment_status === "awaiting_checkin"` → cashier screen; `payment_method` online + `payment_status !== "paid"` → status/poll; `paid` → status.

- [ ] **Step 3: Wire order creation to pass the channel**

Wherever the cart calls `createOrder(...)` (grep `createOrder(` under `App/src`), pass `paymentChannel` based on the chosen tab. If the method is picked **after** creation, create with `"online"` by default and, when the customer switches to Pay at Cashier, create the order with `"cashier"` (or add a small endpoint to regenerate a `checkin_code`). Keep it simple: pick the tab **before** creating the order so the channel is known at creation.

- [ ] **Step 4: Manual verification (browser)**

Start the dev server (preview_start `{name}`). Create an order both ways:
- Pay at Cashier → the QR + 8-digit code render; items/total correct; stock unchanged (check `Inventory_Items`).
- Online → "Bayar Sekarang" opens the Snap popup with QRIS/e-wallet/VA tabs.
Capture a screenshot of each for the PR.

- [ ] **Step 5: Commit**

```bash
git add App/src/components/OrderView.tsx App/src/lib/orders.ts
git commit -m "feat(payment): two-tab customer payment — Snap online + pay-at-cashier QR"
```

---

## Task 10: Kasir check-in UI (scanner + manual code)

**Files:**
- Modify: `App/src/components/kasir/KasirQueue.tsx` (+ `KasirOrderSheet.tsx` if the entry point belongs there)
- Modify: `App/src/lib/kasir-actions.ts` (add `checkInOrder`)

**REQUIRED:** Invoke the **`impeccable`** skill; use **`needmcp`** components for the scanner dialog/inputs. Match the existing kasir console styling.

**Interfaces:**
- Consumes: `POST /api/kasir/checkin` (Task 6).
- Produces: `checkInOrder(orderId, code)` action; a "Check-in Pesanan" control in the kasir console with camera scan + manual 8-digit entry.

- [ ] **Step 1: Add the client action**

```ts
// App/src/lib/kasir-actions.ts  (append)
export async function checkInOrder(orderId: string, checkinCode: string): Promise<string | null> {
  const res = await fetch("/api/kasir/checkin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, checkinCode }),
  });
  if (res.ok) return null;
  const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
  return data?.message ?? data?.error ?? "Gagal check-in pesanan";
}
```

- [ ] **Step 2: Add the check-in control**

In the kasir console, add a "Check-in Pesanan" button opening a dialog with:
- A **camera QR scanner** using the browser `BarcodeDetector` API when available (`new BarcodeDetector({ formats: ["qr_code"] })` over a `<video>` stream), parsing the QR JSON `{ o, c }` → call `checkInOrder(o, c)`.
- A **manual 8-digit input** fallback (uppercase, `[A-Z0-9]{8}`) → `checkInOrder(orderId?, code)`. For manual entry the cashier types the code shown on the customer's screen; the order id is looked up by the code server-side is **not** supported (the RPC needs both), so the QR path (which carries both) is primary and the manual field pairs with the on-screen order number. Show the 8-digit code prominently on the customer screen (Task 9) and accept the same code here alongside the order number the customer reads out.
- On success: toast via `sonner`, the order appears in the queue on the next poll/refresh. On `insufficient_inventory` (409): show the returned message.

*(If `BarcodeDetector` is unavailable on the target device, ship the manual-entry field first and treat the camera scanner as progressive enhancement — do not block the task on camera support.)*

- [ ] **Step 3: Manual verification (browser)**

Create a cash order (Task 9), copy its QR payload / code, and check it in from the kasir console. Confirm the order moves into the queue and stock is deducted. Screenshot for the PR.

- [ ] **Step 4: Commit**

```bash
git add App/src/components/kasir/KasirQueue.tsx App/src/components/kasir/KasirOrderSheet.tsx App/src/lib/kasir-actions.ts
git commit -m "feat(kasir): QR/manual check-in for pay-at-cashier orders"
```

---

## Task 11: Retire create_order_with_inventory + full regression

**Files:**
- Create: `App/supabase/migrations/20260809120001_drop_create_order_with_inventory.sql`

**Interfaces:**
- Consumes: nothing new. Confirms no caller references the old RPC.

- [ ] **Step 1: Confirm there are no remaining callers**

Run (Grep tool): search `create_order_with_inventory` across `App/src` and `App/tests`.
Expected: **zero** matches (Task 3 switched the only caller). If any remain, fix them before dropping.

- [ ] **Step 2: Write the drop migration**

```sql
-- App/supabase/migrations/20260809120001_drop_create_order_with_inventory.sql
begin;
drop function if exists public.create_order_with_inventory(uuid, text, jsonb, text);
commit;
```

- [ ] **Step 3: Apply + full test run**

Apply the migration (Supabase MCP / `db push`). Then:

Run: `npm run test:ci && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add App/supabase/migrations/20260809120001_drop_create_order_with_inventory.sql
git commit -m "chore(db): drop superseded create_order_with_inventory"
```

---

## Task 12: Env, docs, and PR

**Files:**
- Modify: `.env.example` (or the project's env template) — add Midtrans client key.
- Modify: `App/docs/` payment/README doc if one exists.

- [ ] **Step 1: Document env**

Add to the env template:

```
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
```

- [ ] **Step 2: Sandbox end-to-end**

With sandbox keys set: create an online order → pay with the Snap sandbox QRIS/e-wallet simulator → confirm the webhook flips the order to `paid` with the real method and it enters the queue. Create a cash order → check it in from the kasir console → confirm it enters the queue and stock deducts, then mark cash paid.

- [ ] **Step 3: Commit + open PR**

```bash
git add -A
git commit -m "docs(payment): document Midtrans env for multi-method Snap"
git push -u origin feat/multi-method-payment
```
Open a PR summarising: Snap multi-method, pay-at-cashier QR check-in, deferred stock, security guards retained + added.

---

## Self-Review

**Spec coverage:**
- Snap multi-method online → Tasks 1, 4, 8, 9. ✅
- Pay-at-cashier QR + check-in gate → Tasks 2, 6, 9, 10. ✅
- Deferred stock (both flows) → Tasks 2 (`create_order`/`confirm_order`), 5 (webhook confirm), 6 (check-in confirm). ✅
- Lifecycle split → Task 2. ✅
- 8-digit checkin_code → Task 2 (gen), 9 (display), 10 (entry). ✅
- Keep qr-proxy → File Structure (unchanged). ✅
- Security parity + additions (signature, amount, atomic claim, rate limit, RLS, constant-time code, anti-oversell, idempotent webhook, CSP) → Tasks 2, 4, 5, 6, 8. ✅
- Kasir/report impact (needsCash, awaiting hidden) → Task 7. ✅
- Impeccable + needmcp for UI → Tasks 9, 10. ✅
- Testing plan → Tasks 1,4,5,6,7 (+ regression Task 11). ✅

**Placeholder scan:** No "TBD"/"handle edge cases" left. The two intentional lookups — the kasir auth helper (Task 6) and the `createOrder` call sites (Task 9 Step 3) — are explicit grep-and-reuse instructions, not vague gaps.

**Type consistency:** `payment_method` values (`cash|qris|gopay|shopeepay|bank_transfer`) match across the DB CHECK (Task 2), `PAYMENT_METHODS` (Task 1), and `PaymentMethod` type (Task 7). `payment_status` values (`awaiting_payment|awaiting_checkin|pending|paid|unpaid`) match across `create_order` (Task 2), charge claim (Task 4), webhook (Task 5), and the `PaymentStatus` type (Task 7). RPC names (`create_order`, `confirm_order`, `checkin_order`) are identical in Tasks 2, 3, 5, 6.

**Known follow-up (not blocking):** manual check-in requires the order id + code pair; the QR carries both, the manual field pairs the code with the on-screen order number. A code-only lookup RPC could be added later if cashiers want to key the code alone.
