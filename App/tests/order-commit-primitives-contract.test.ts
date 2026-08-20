import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../supabase/migrations/20260706000000_order_commit_primitives.sql", import.meta.url), "utf8");

describe("atomic order commit primitives", () => {
  it("defines quote identity, hash, expiry, and single-use status", () => {
    expect(sql).toContain('create table if not exists public."Order_Quotes"');
    expect(sql).toContain("request_hash text not null");
    expect(sql).toContain("canonical_payload jsonb not null");
    expect(sql).toContain("pricing_snapshot jsonb not null");
    expect(sql).toContain("status text not null default 'issued'");
    expect(sql).toContain("expires_at timestamptz not null");
    expect(sql).toContain("consumed_at timestamptz");
  });

  it("scopes idempotency to a cafe and preserves the canonical response", () => {
    expect(sql).toContain('create table if not exists public."Order_Idempotency_Keys"');
    expect(sql).toContain("primary key (cafe_id, idempotency_key)");
    expect(sql).toContain("request_hash text not null");
    expect(sql).toContain("response_payload jsonb");
    expect(sql).toContain("unique index if not exists \"Order_Idempotency_Keys_order_id_idx\"");
  });

  it("reserves each inventory item once per order with terminal timestamps", () => {
    expect(sql).toContain('create table if not exists public."Order_Reservations"');
    expect(sql).toContain("unique (order_id, inventory_item_id)");
    expect(sql).toContain("status text not null default 'reserved'");
    expect(sql).toContain("reserved_qty numeric(12,3)");
    expect(sql).toContain("constraint order_reservations_terminal_timestamp");
    expect(sql).toContain('alter table public."Order_Reservations" enable row level security');
  });
});
