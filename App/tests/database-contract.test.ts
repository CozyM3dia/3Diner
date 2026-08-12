import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../migrations/2026-07-14_security_and_performance.sql",
  import.meta.url
);
const inventoryMigrationPath = new URL(
  "../migrations/2026-07-15_inventory_core.sql",
  import.meta.url
);
const rateLimitMigrationPath = new URL(
  "../migrations/2026-07-23_rate_limits.sql",
  import.meta.url
);
const paymentLifecycleMigrationPath = new URL(
  "../supabase/migrations/20260809120000_payment_lifecycle_split.sql",
  import.meta.url
);
const paymentLifecycleRepairMigrationPath = new URL(
  "../supabase/migrations/20260809120003_payment_lifecycle_repair.sql",
  import.meta.url
);
const paymentCreditsMigrationPath = new URL(
  "../migrations/2026-07-27_payment_credits_options.sql",
  import.meta.url
);
const cashPayBeforeKitchenMigrationPath = new URL(
  "../supabase/migrations/20260809120004_cash_pay_before_kitchen.sql",
  import.meta.url
);
const qrisPaymentUrlMigrationPath = new URL(
  "../supabase/migrations/20260812121415_qris_payment_url.sql",
  import.meta.url
);
const qrisPaymentTransactionIdMigrationPath = new URL(
  "../supabase/migrations/20260812130642_qris_payment_transaction_id.sql",
  import.meta.url
);
const qrisPaymentAttemptIdentityMigrationPath = new URL(
  "../supabase/migrations/20260812141335_qris_payment_attempt_identity.sql",
  import.meta.url
);
const qrisSettlementCasMigrationPath = new URL(
  "../supabase/migrations/20260812145223_qris_settlement_cas.sql",
  import.meta.url
);

describe("security migration", () => {
  it("removes anonymous Orders policies and adds order token support", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('drop policy if exists "orders_select_anon" on public."Orders"');
    expect(sql).toContain('drop policy if exists "orders_update_anon" on public."Orders"');
    expect(sql).toContain('drop policy if exists "orders_insert_anon" on public."Orders"');
    expect(sql).toContain('add column if not exists customer_token uuid');
    expect(sql).toContain('create index if not exists "Analytics_Logs_cafe_id_created_at_idx"');
  });
});

describe("inventory core migration", () => {
  it("defines the inventory schema and atomic order RPC contract", () => {
    const sql = readFileSync(inventoryMigrationPath, "utf8");

    expect(sql).toContain('create table if not exists public."Inventory_Items"');
    expect(sql).toContain('create table if not exists public."Menu_Recipes"');
    expect(sql).toContain('create table if not exists public."Inventory_Movements"');
    expect(sql).toContain("create or replace function public.create_order_with_inventory");
    expect(sql).toContain("p_cafe_id uuid");
    expect(sql).toContain("p_items jsonb");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("locks inventory tables behind RLS while preserving RPC access", () => {
    const sql = readFileSync(inventoryMigrationPath, "utf8");

    expect(sql).toContain('alter table public."Inventory_Items" enable row level security');
    expect(sql).toContain('alter table public."Menu_Recipes" enable row level security');
    expect(sql).toContain('alter table public."Inventory_Movements" enable row level security');
    expect(sql).toMatch(
      /revoke all on table\s+public\."Inventory_Items",\s*public\."Menu_Recipes",\s*public\."Inventory_Movements"\s+from public, anon, authenticated/i
    );
    expect(sql).toContain(
      "revoke all on function public.create_order_with_inventory(uuid, text, jsonb, text) from public, anon, authenticated"
    );
    expect(sql).not.toContain(
      "grant execute on function public.create_order_with_inventory(uuid, text, jsonb, text) to anon, authenticated"
    );
    expect(sql).toContain(
      "grant execute on function public.create_order_with_inventory(uuid, text, jsonb, text) to service_role"
    );
  });

  it("keeps Orders.id_order text-compatible and stores order references as text", () => {
    const sql = readFileSync(inventoryMigrationPath, "utf8");

    expect(sql).toMatch(/v_order_id\s+text\s*:=\s*gen_random_uuid\(\)::text/i);
    expect(sql).toMatch(/id_order,\s*\r?\n\s*cafe_id,/);
    expect(sql).toContain("reference_id text");
    expect(sql).not.toMatch(/v_order_id\s+uuid/i);
  });

  it("validates JSON item shape before UUID and quantity casts", () => {
    const sql = readFileSync(inventoryMigrationPath, "utf8");

    expect(sql).toContain("jsonb_typeof(item) <> 'object'");
    expect(sql).toMatch(/not \(item \? 'id_menu'\)[\s\S]*not \(item \? 'qty'\)/i);
    expect(sql).toContain("jsonb_typeof(item->'id_menu') <> 'string'");
    expect(sql).toContain("jsonb_typeof(item->'qty') <> 'number'");
    expect(sql).toContain("(item->>'id_menu') !~* '^[0-9a-f]{8}-");
    expect(sql).toContain("(item->>'qty') !~ '^[0-9]+$'");
  });

  it("aggregates duplicate requested menus before pricing and inventory deduction", () => {
    const sql = readFileSync(inventoryMigrationPath, "utf8");

    expect(sql).toMatch(/insert into tmp_requested_items[\s\S]*sum\(\(item->>'qty'\)::integer\)::integer as qty[\s\S]*group by \(item->>'id_menu'\)::uuid/i);
    expect(sql).toMatch(/if exists \(select 1 from tmp_requested_items where qty < 1 or qty > 50\)/i);
  });

  it("locks inventory rows, uses canonical menu prices, and hides ingredient details on stock failures", () => {
    const sql = readFileSync(inventoryMigrationPath, "utf8");

    expect(sql).toContain("for update of ii");
    expect(sql).toContain("coalesce(m.is_active, true) = true");
    expect(sql).toContain("least(greatest(coalesce(m.discount_pct, 0), 0), 100)");
    expect(sql).toContain("'error', 'insufficient_inventory'");
    expect(sql).toContain("'unavailableMenus', to_jsonb(v_unavailable)");
    expect(sql).not.toContain("'ingredient'");
    expect(sql).not.toContain("'ingredients'");
  });

  it("defines atomic dashboard inventory RPCs with row locking and cafe isolation", () => {
    const sql = readFileSync(inventoryMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.adjust_inventory_stock");
    expect(sql).toMatch(
      /function public\.adjust_inventory_stock[\s\S]*from public\."Inventory_Items"[\s\S]*cafe_id = p_cafe_id[\s\S]*for update[\s\S]*update public\."Inventory_Items"[\s\S]*insert into public\."Inventory_Movements"/i
    );
    expect(sql).toMatch(/p_mode is null\s+or p_mode not in \('add', 'subtract', 'set'\)/i);
    expect(sql).toMatch(/v_delta\s*:=\s*v_after\s*-\s*v_before/i);
    expect(sql).toMatch(/if v_delta = 0 then\s+return jsonb_build_object\('error', 'invalid_adjustment'\)/i);
    expect(sql).toContain("create or replace function public.replace_menu_recipes");
    expect(sql).toMatch(
      /function public\.replace_menu_recipes[\s\S]*from public\."Menus"[\s\S]*cafe_id = p_cafe_id[\s\S]*for update/i
    );
    expect(sql).toMatch(
      /function public\.replace_menu_recipes[\s\S]*join public\."Inventory_Items" ii[\s\S]*ii\.cafe_id = p_cafe_id/i
    );
    expect(sql).toMatch(
      /function public\.replace_menu_recipes[\s\S]*delete from public\."Menu_Recipes"[\s\S]*insert into public\."Menu_Recipes"/i
    );
    expect(sql).toContain(
      "revoke all on function public.adjust_inventory_stock(uuid, uuid, text, numeric, text) from public, anon, authenticated"
    );
    expect(sql).toContain(
      "revoke all on function public.replace_menu_recipes(uuid, uuid, jsonb) from public, anon, authenticated"
    );
    expect(sql).toContain(
      "grant execute on function public.adjust_inventory_stock(uuid, uuid, text, numeric, text) to service_role"
    );
    expect(sql).toContain(
      "grant execute on function public.replace_menu_recipes(uuid, uuid, jsonb) to service_role"
    );
  });
});

describe("rate limit migration", () => {
  it("stores counters in Postgres so they are shared across function instances", () => {
    const sql = readFileSync(rateLimitMigrationPath, "utf8");

    expect(sql).toContain('create table if not exists public."Rate_Limits"');
    expect(sql).toContain("bucket_key text primary key");
    expect(sql).toContain("create or replace function public.consume_rate_limit");
    expect(sql).toContain("on conflict (bucket_key) do update");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("keeps the counter table and its RPCs off the public API surface", () => {
    const sql = readFileSync(rateLimitMigrationPath, "utf8");

    expect(sql).toContain('alter table public."Rate_Limits" enable row level security');
    expect(sql).toContain(
      'revoke all on table public."Rate_Limits" from public, anon, authenticated'
    );
    expect(sql).toContain(
      "revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated"
    );
    expect(sql).toContain(
      "grant execute on function public.consume_rate_limit(text, integer, integer) to service_role"
    );
    expect(sql).not.toContain(
      "grant execute on function public.consume_rate_limit(text, integer, integer) to anon"
    );
  });

  it("provides a pruner so the counter table does not grow without bound", () => {
    const sql = readFileSync(rateLimitMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.prune_rate_limits");
    expect(sql).toContain('create index if not exists "Rate_Limits_window_start_idx"');
  });
});

describe("payment lifecycle migration", () => {
  it("persists a validated dynamic QRIS URL and exposes it only while pending", () => {
    const sql = readFileSync(qrisPaymentUrlMigrationPath, "utf8");

    expect(sql).toContain('add column if not exists payment_qr_url text');
    expect(sql).toContain('Orders_payment_qr_url_valid');
    expect(sql).toContain("payment_qr_url ~ '^https://api(\\.sandbox)?\\.midtrans\\.com/'");
    expect(sql).toContain("'payment_qr_url', case when v_order.payment_status = 'pending'");
    expect(sql).toContain("o.checkin_code, o.payment_qr_url");
    expect(sql).toContain("security definer");
  });

  it("persists the active Midtrans transaction identity for QRIS recovery", () => {
    const sql = readFileSync(qrisPaymentTransactionIdMigrationPath, "utf8");

    expect(sql).toContain('add column if not exists payment_transaction_id text');
    expect(sql).toContain('Orders_payment_transaction_id_valid');
    expect(sql).toContain("payment_transaction_id is null");
  });

  it("pairs QRIS identity fields and validates the retry key", () => {
    const sql = readFileSync(qrisPaymentAttemptIdentityMigrationPath, "utf8");

    expect(sql).toContain('add column if not exists payment_idempotency_key text');
    expect(sql).toContain('Orders_payment_qr_identity_pair_valid');
    expect(sql).toContain('Orders_payment_idempotency_key_valid');
    expect(sql).toContain("payment_idempotency_key ~ '^[A-Za-z0-9._:-]{1,46}$'");
  });

  it("settles QRIS through an identity-aware atomic RPC", () => {
    const sql = readFileSync(qrisSettlementCasMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.settle_payment_order");
    expect(sql).toContain("p_transaction_id text");
    expect(sql).toContain("for update");
    expect(sql).toContain("payment_transaction_id is distinct from p_transaction_id");
    expect(sql).toContain("and payment_transaction_id = p_transaction_id");
    expect(sql).toContain("public.confirm_order(p_order_id)");
  });

  it("replaces legacy Orders checks and snapshots the canonical tax contract before charging", () => {
    const sql = readFileSync(paymentLifecycleMigrationPath, "utf8");

    expect(sql).toContain("effective_tax_settings(p_cafe_id)");
    expect(sql).toContain("subtotal, tax_pct, tax_amount, service_pct, service_amount, prices_include_tax");
    expect(sql).toContain("v_total := v_subtotal + v_service_amount + v_tax_amount");
    expect(sql).toContain("v_total := v_subtotal + v_service_amount");
    expect(sql).toContain("v_payment_status := 'awaiting_payment'");
    expect(sql).toContain("v_payment_status := 'awaiting_checkin'");
  });

  it("repairs already-applied payment migrations by replacing checks and cash authorization safely", () => {
    const sql = readFileSync(paymentLifecycleRepairMigrationPath, "utf8");

    // Orders_cancel_requires_reason is a composite CHECK: the repair may only
    // replace a CHECK when its conkey identifies exactly one lifecycle column.
    expect(sql).toContain("cardinality(conkey) = 1");
    expect(sql).toContain("conkey[1] = v_attnum");
    expect(sql).toContain("attname = v_column");
    expect(sql).not.toContain("pg_get_constraintdef(oid) ~");
    expect(sql).toContain("payment_method = 'cash'");
    expect(sql).toContain("payment_status in ('awaiting_checkin', 'unpaid')");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("to service_role");
  });

  it("repairs revenue aggregation so each accepted online method has a chart count", () => {
    const sql = readFileSync(paymentLifecycleRepairMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.revenue_analytics");
    expect(sql).toContain("'gopay'");
    expect(sql).toContain("'shopeepay'");
    expect(sql).toContain("'bank_transfer'");
  });

  it("keeps the cash-paid RPC cash-only in both its source migration and repair", () => {
    const source = readFileSync(paymentCreditsMigrationPath, "utf8");
    const repair = readFileSync(paymentLifecycleRepairMigrationPath, "utf8");

    for (const sql of [source, repair]) {
      expect(sql).toContain("v_method is distinct from 'cash'");
      expect(sql).toContain("payment_status in ('awaiting_checkin', 'unpaid')");
      expect(sql).toContain("payment_method = 'cash'");
    }
  });

  it("collects cash at check-in and blocks completing an unpaid cash order", () => {
    const sql = readFileSync(cashPayBeforeKitchenMigrationPath, "utf8");

    // check-in confirms first, then marks the cash order paid in the same
    // transaction — so a received cash order is always already paid.
    expect(sql).toContain("v_result := public.confirm_order(v_order_id)");
    expect(sql).toContain("if v_result ? 'error' then");
    expect(sql).toContain("set payment_status = 'paid'");
    expect(sql).toContain("and payment_status = 'awaiting_checkin'");

    // Defense in depth: advance_order_status refuses to complete an unpaid cash
    // order even if a stale client tries.
    expect(sql).toContain("p_next = 'completed'");
    expect(sql).toContain("v_payment_method = 'cash'");
    expect(sql).toContain("v_payment_status <> 'paid'");
    expect(sql).toContain("raise exception 'cash_payment_required'");

    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("to service_role");
  });
});

describe("option group min_select fix", () => {
  const path = new URL(
    "../migrations/2026-07-27b_option_group_min_select_fix.sql",
    import.meta.url
  );

  // Regresi: server menuntut min_select penuh sementara
  // getMenuOptionsForCustomer menyembunyikan grup yang seluruh pilihannya
  // nonaktif. Tamu tidak punya cara memenuhinya, jadi tiap pesanan untuk menu
  // itu ditolak menu_unavailable dan menunya mati tanpa penjelasan.
  it("clamps the required minimum to the number of active choices", () => {
    const sql = readFileSync(path, "utf8");

    expect(sql).toContain("having count(lo.id_option_value) < least(");
    expect(sql).toContain("and ov2.is_active = true");
  });

  it("keeps the upper bound and the service_role-only grant intact", () => {
    const sql = readFileSync(path, "utf8");

    expect(sql).toContain("or count(lo.id_option_value) > og.max_select");
    expect(sql).toContain(
      "grant execute on function public.create_order_with_inventory(uuid, text, jsonb, text) to service_role"
    );
    expect(sql).toContain(
      "revoke all on function public.create_order_with_inventory(uuid, text, jsonb, text) from public, anon, authenticated"
    );
  });
});
