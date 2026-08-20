import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../supabase/migrations/20260708000000_atomic_order_commit.sql", import.meta.url), "utf8");

describe("atomic order commit RPC contract", () => {
  it("claims idempotency before locking and consuming the quote", () => {
    expect(sql).toContain("create or replace function public.commit_order_atomic");
    expect(sql.indexOf("insert into public.\"Order_Idempotency_Keys\""))
      .toBeLessThan(sql.indexOf("select * into v_quote"));
    expect(sql).toContain("for update;");
    expect(sql).toContain("v_idempotency.order_id is not null");
    expect(sql).toContain("return coalesce(v_idempotency.response_payload");
  });

  it("creates reservations under locked inventory rows before consuming the quote", () => {
    expect(sql).toContain("for update of ii");
    expect(sql).toContain('insert into public."Order_Reservations"');
    expect(sql.indexOf('insert into public."Order_Reservations"'))
      .toBeLessThan(sql.indexOf('update public."Order_Quotes"'));
    expect(sql).toContain("expires_at > v_now");
    expect(sql).toContain("raise exception 'insufficient_inventory'");
    expect(sql).toContain("v_quote_total := (v_quote.pricing_snapshot->>'total')::integer");
    expect(sql).toContain("raise exception 'quote_changed'");
  });

  it("persists the canonical response and exposes only service-role RPC access", () => {
    expect(sql).toContain('update public."Order_Idempotency_Keys"');
    expect(sql).toContain("response_payload = v_result");
    expect(sql).toContain("revoke all on function public.commit_order_atomic");
    expect(sql).toContain("grant execute on function public.commit_order_atomic");
  });

  it("consumes and releases reservations exactly once", () => {
    expect(sql).toContain("create or replace function public.consume_order_reservations");
    expect(sql).toContain("set status = 'consumed'");
    expect(sql).toContain("where order_id = p_order_id and status = 'reserved'");
    expect(sql).toContain("create or replace function public.release_order_reservations");
    expect(sql).toContain("status = p_status, released_at = now()");
  });
});
