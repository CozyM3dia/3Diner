import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../migrations/2026-07-14_security_and_performance.sql",
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
