# 3Diner Security and Database Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make payment/order processing server-authoritative and restrict unsafe public database/API access.

**Architecture:** Preserve all current UI markup. Customer components call narrow route handlers; only server code calculates menu totals and writes Orders. A migration locks RLS, adds constraints/indexes, and makes the verified Midtrans webhook the only QRIS settlement authority.

**Tech Stack:** Next.js 16, TypeScript, Supabase Postgres/RLS, Midtrans, Vitest.

## Global Constraints

- No UI, copy, navigation, branding, or layout changes.
- No secret in browser code, commits, test snapshots, or chat.
- Preserve Midtrans QRIS and owner dashboard behavior.
- Privileged modules import `server-only`.

---

## File structure

- `App/src/lib/order-validation.ts`: pure request, total, and signature validation.
- `App/src/app/api/orders/route.ts`: server-created order and token-scoped customer read.
- `App/src/app/api/payment/{charge,webhook,qr-proxy}/route.ts`: charge, settlement, QR proxy.
- `App/src/lib/{request-guard,tripo-tasks}.ts`: owner/rate/task guards.
- `App/migrations/2026-07-14_security_and_performance.sql`: database hardening.
- `App/tests/*.test.ts`: boundary tests.

### Task 1: Add test runner and canonical order helpers

**Files:**
- Modify: `App/package.json`
- Create: `App/vitest.config.ts`
- Create: `App/src/lib/order-validation.ts`
- Test: `App/tests/order-validation.test.ts`

**Interfaces:** Expose `calculateOrderTotal(menus, items)` and `verifyMidtransSignature(notification, serverKey)`; neither reads runtime secrets.

- [ ] **Step 1: Write the failing test**

```ts
it("uses database price and discount", () => {
  expect(calculateOrderTotal([{ id_menu: "m1", cafe_id: "c1", nama_menu: "Nasi", harga_menu: 25000, discount_pct: 20, is_active: true }], [{ id_menu: "m1", qty: 2 }])).toEqual([{ id_menu: "m1", nama_menu: "Nasi", harga_menu: 20000, qty: 2 }]);
});
it("rejects forged Midtrans signatures", () => {
  expect(verifyMidtransSignature({ order_id: "o1", status_code: "200", gross_amount: "25000.00", signature_key: "bad" }, "secret")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/order-validation.test.ts`

Expected: failure because the script/module does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export function calculateOrderTotal(menus: MenuRow[], items: RequestedItem[]): CanonicalItem[] {
  return items.map(({ id_menu, qty }) => {
    const menu = menus.find((m) => m.id_menu === id_menu && m.is_active);
    if (!menu || !Number.isInteger(qty) || qty < 1 || qty > 50) throw new Error("Menu tidak tersedia");
    const price = Math.round(menu.harga_menu * (1 - Math.min(Math.max(menu.discount_pct ?? 0, 0), 100) / 100));
    return { id_menu: menu.id_menu, nama_menu: menu.nama_menu, harga_menu: price, qty };
  });
}
```

Add `"test": "vitest"` plus `vitest` dev dependency and a config resolving `@/` to `src/`.

- [ ] **Step 4: Verify and commit**

Run: `npm run test -- --run tests/order-validation.test.ts; npx tsc --noEmit`

Expected: both commands exit 0.

```bash
git add App/package.json App/package-lock.json App/vitest.config.ts App/src/lib/order-validation.ts App/tests/order-validation.test.ts
git commit -m "test: add payment validation coverage"
```

### Task 2: Create server-authoritative Orders and charges

**Files:**
- Create: `App/src/app/api/orders/route.ts`
- Modify: `App/src/app/api/payment/charge/route.ts`
- Modify: `App/src/lib/orders.ts`, `App/src/components/CartView.tsx`, `App/src/components/OrderView.tsx`
- Test: `App/tests/payment-routes.test.ts`

**Interfaces:** `POST /api/orders` takes `{ cafeId, table, items: [{ id_menu, qty }], notes? }` and returns `{ order, orderToken }`. `POST /api/payment/charge` accepts only `{ orderId, orderToken }` and returns `{ qrUrl }`.

- [ ] **Step 1: Write the failing test**

```ts
it("uses stored total instead of browser input", async () => {
  const response = await charge(jsonRequest({ orderId: "o1", orderToken: "token" }));
  expect(response.status).toBe(200);
  expect(midtransBody.transaction_details.gross_amount).toBe(40000);
});
it("rejects a mismatched order token", async () => {
  expect((await charge(jsonRequest({ orderId: "o1", orderToken: "wrong" }))).status).toBe(403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/payment-routes.test.ts`

Expected: failure; the current route accepts amount/items directly from the browser.

- [ ] **Step 3: Implement the server boundary**

```ts
const { data: order } = await supabaseAdmin.from("Orders")
  .select("id_order,cafe_id,items,total,payment_status,customer_token")
  .eq("id_order", orderId).eq("customer_token", orderToken).single();
if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 403 });
if (order.payment_status !== "unpaid") return NextResponse.json({ error: "QRIS sudah dibuat" }, { status: 409 });
```

Generate UUID `id_order` and `customer_token` in the order route. Load active menu rows, calculate canonical total, then persist pending order. Keep localStorage only for order ID/token; make `createOrder` asynchronous and await it in CartView. OrderView polls the token-scoped read; its existing manual-paid button refreshes status and never writes `paid`.

- [ ] **Step 4: Verify and commit**

Run: `npm run test -- --run tests/order-validation.test.ts tests/payment-routes.test.ts; npx eslint src/lib/orders.ts src/components/CartView.tsx src/components/OrderView.tsx src/app/api/orders/route.ts src/app/api/payment/charge/route.ts; npm run build`

Expected: all commands exit 0.

```bash
git add App/src/app/api/orders/route.ts App/src/app/api/payment/charge/route.ts App/src/lib/orders.ts App/src/components/CartView.tsx App/src/components/OrderView.tsx App/tests/payment-routes.test.ts
git commit -m "feat: make QRIS orders server authoritative"
```

### Task 3: Harden webhook, RLS, and database queries

**Files:**
- Modify: `App/src/app/api/payment/webhook/route.ts`, `App/src/lib/supabase-admin.ts`, `App/src/lib/{supabase,data}.ts`
- Create: `App/migrations/2026-07-14_security_and_performance.sql`
- Test: `App/tests/{midtrans-webhook,database-contract}.test.ts`

**Interfaces:** Webhook returns 401 invalid signature, 400 mismatched amount, and 200 repeat settlement. Anonymous role has no Orders select, insert, or update.

- [ ] **Step 1: Write failing tests**

```ts
it("rejects a wrong settlement amount", async () => {
  expect((await webhook(jsonRequest(signed({ order_id: "o1", gross_amount: "1.00" })))).status).toBe(400);
});
it("removes anonymous Orders access", () => {
  expect(sql).not.toMatch(/on "Orders" for (select|insert|update) to anon/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/midtrans-webhook.test.ts tests/database-contract.test.ts`

Expected: the current webhook does not compare stored amount and the migration does not exist.

- [ ] **Step 3: Implement webhook/migration/read projections**

```ts
if (!verifyMidtransSignature(notification, serverKey)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
const { data: order } = await supabaseAdmin.from("Orders").select("total,payment_status").eq("id_order", order_id).single();
if (!order || Number(gross_amount) !== Number(order.total)) return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
if ([ "settlement", "capture" ].includes(transaction_status) && order.payment_status !== "paid") {
  await supabaseAdmin.from("Orders").update({ payment_status: "paid", status: "preparing", payment_method: "qris" }).eq("id_order", order_id).eq("payment_status", "pending");
}
```

```sql
create index if not exists "Announcements_cafe_id_idx" on public."Announcements" (cafe_id);
create index if not exists "Cafes_owner_id_idx" on public."Cafes" (owner_id);
create index if not exists "Analytics_Logs_cafe_id_created_at_idx" on public."Analytics_Logs" (cafe_id, created_at desc);
alter table public."Orders" add column if not exists customer_token uuid not null default gen_random_uuid();
alter table public."Orders" add constraint "Orders_total_nonnegative" check (total >= 0) not valid;
alter table public."Orders" validate constraint "Orders_total_nonnegative";
revoke all on table public."Orders" from anon;
```

Before deploy, inspect actual policy names then explicitly drop/recreate them. Create security-invoker public cafe/menu views with only fields used by customer UI; change public client reads from base tables and `select("*")` to explicit safe view columns. Use `(select auth.uid())` in owner policies and add `import "server-only";` to the service-role module.

- [ ] **Step 4: Apply safely, verify, and commit**

Run: `supabase db push --dry-run; supabase db push; npm run test -- --run tests/midtrans-webhook.test.ts tests/database-contract.test.ts; npm run build`

Expected: migration is idempotent and all commands exit 0. Export database backup before non-dry-run if the CLI points at production.

```bash
git add App/src/app/api/payment/webhook/route.ts App/src/lib/supabase-admin.ts App/migrations/2026-07-14_security_and_performance.sql App/src/lib/supabase.ts App/src/lib/data.ts App/tests
git commit -m "feat: restrict public database access"
```

### Task 4: Guard QR proxy, AI quota, and Tripo ownership

**Files:**
- Create: `App/src/lib/{request-guard,tripo-tasks}.ts`
- Modify: `App/src/app/api/payment/qr-proxy/route.ts`, `App/src/app/api/menu/{extract,generate-details}/route.ts`, `App/src/app/api/tripo/{generate,status,convert,save}/route.ts`, `App/src/lib/tripo.ts`
- Test: `App/tests/api-guards.test.ts`

**Interfaces:** QR proxy allows only HTTPS Midtrans hosts. Tripo task reads require matching cafe. Limits: 10 details/hour, 5 extracts/hour, 10 Tripo tasks/hour/cafe.

- [ ] **Step 1: Write failing tests**

```ts
it.each(["http://169.254.169.254/latest", "https://example.com/qr.png", "file:///etc/passwd"])("rejects %s", (url) => expect(() => assertMidtransQrUrl(url)).toThrow());
it("rejects a foreign task", async () => await expect(requireTaskOwnership("cafe-a", "task-b")).rejects.toThrow("Task tidak ditemukan"));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/api-guards.test.ts`

Expected: arbitrary URLs and foreign task IDs are currently accepted.

- [ ] **Step 3: Implement guards**

```ts
const hosts = new Set(["api.midtrans.com", "api.sandbox.midtrans.com"]);
export function assertMidtransQrUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !hosts.has(url.hostname)) throw new Error("URL QR tidak diizinkan");
  return url;
}
```

Authenticate an owner before Gemini parsing or any Tripo provider call. Add a migration-created `Tripo_Tasks(cafe_id, task_id, type, created_at)` table, persist created task IDs, and require matching ownership for status/convert/save. Add fixed-window rate records via a database table and import `server-only` in `tripo.ts`.

- [ ] **Step 4: Verify and commit**

Run: `npm run test -- --run tests/api-guards.test.ts; npm run test -- --run; npx tsc --noEmit; npm run build`

Expected: all commands exit 0.

```bash
git add App/src/lib/request-guard.ts App/src/lib/tripo-tasks.ts App/src/app/api/payment/qr-proxy/route.ts App/src/app/api/menu App/src/app/api/tripo App/src/lib/tripo.ts App/tests/api-guards.test.ts App/migrations/2026-07-14_security_and_performance.sql
git commit -m "fix: guard privileged API routes"
```

### Task 5: Rotate exposed secret and document recovery

**Files:**
- Modify: `App/README.md`
- Create: `App/docs/operations.md`

- [ ] **Step 1: Rotate the exposed Supabase key**

Use Supabase key rotation; set replacement only in local and Vercel environment stores, never in source or chat.

- [ ] **Step 2: Configure and verify Midtrans webhook**

Set notification URL to `https://3diner.vercel.app/api/payment/webhook`, then use a sandbox notification and check 2xx plus one intended order update.

- [ ] **Step 3: Document and verify**

Document weekly database export, separate `menu-media` Storage export, and quarterly restore drill. Run: `npm run test -- --run; npx tsc --noEmit; npm run lint; npm run build; git status --short`. Expected: all quality commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add App/README.md App/docs/operations.md
git commit -m "docs: document secure deployment and backups"
```
