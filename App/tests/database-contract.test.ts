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
});
