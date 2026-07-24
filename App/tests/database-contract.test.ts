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
