import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const supabaseDir = join(process.cwd(), "supabase");
const migrationsDir = join(supabaseDir, "migrations");

function migration(name: string): string {
  return readFileSync(join(migrationsDir, name), "utf8");
}

describe("canonical Supabase database layout", () => {
  it("has an explicit seed path required by db reset", () => {
    const config = readFileSync(join(supabaseDir, "config.toml"), "utf8");
    expect(config).toContain('sql_paths = ["./seed.sql"]');
    expect(existsSync(join(supabaseDir, "seed.sql"))).toBe(true);
  });

  it("starts with the base schema before dependent migrations", () => {
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
    expect(files[0]).toBe("20260701000000_base_schema.sql");

    const base = migration(files[0]);
    expect(base).toContain('create table if not exists public."Cafes"');
    expect(base).toContain('create table if not exists public."Menus"');
    expect(base).toContain('create table if not exists public."Orders"');
  });

  it("keeps inventory, options, and rate limits after their table dependencies", () => {
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
    const indexOf = (prefix: string) => files.findIndex((file) => file.startsWith(prefix));

    expect(indexOf("20260701000000")).toBeGreaterThanOrEqual(0);
    expect(indexOf("20260702000000")).toBeGreaterThan(indexOf("20260701000000"));
    expect(indexOf("20260703000000")).toBeGreaterThan(indexOf("20260702000000"));
    expect(indexOf("20260704000000")).toBeGreaterThan(indexOf("20260703000000"));
    expect(indexOf("20260705000000")).toBeGreaterThan(indexOf("20260701000000"));

    expect(migration("20260702000000_inventory_core.sql")).toContain('create table if not exists public."Inventory_Items"');
    expect(migration("20260704000000_payment_credits_options.sql")).toContain('create table if not exists public."Menu_Option_Groups"');
    expect(migration("20260705000000_rate_limits.sql")).toContain('create table if not exists public."Rate_Limits"');
  });

  it("does not reintroduce anonymous Orders access in the canonical path", () => {
    const canonical = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
      .join("\n");

    expect(canonical).not.toMatch(/create policy\s+"orders_(?:select|update|insert)_anon"/i);
    expect(canonical).toContain('revoke all on table public."Orders" from anon');
  });
});
