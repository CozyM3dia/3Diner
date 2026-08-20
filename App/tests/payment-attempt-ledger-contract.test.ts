import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../supabase/migrations/20260707000000_payment_attempt_ledger.sql", import.meta.url), "utf8");

describe("payment attempt ledger contract", () => {
  it("requires a unique provider order identity for every attempt", () => {
    expect(sql).toContain('create table if not exists public."Payment_Attempts"');
    expect(sql).toContain("provider_order_id text not null");
    expect(sql).toContain("unique (provider, provider_order_id)");
    expect(sql).toContain("unique (provider, idempotency_key)");
  });

  it("retains provider transaction identity through settlement and refund", () => {
    expect(sql).toContain("provider_transaction_id text");
    expect(sql).toContain("status not in ('settled', 'refund_pending', 'refunded') or provider_transaction_id is not null");
  });

  it("deduplicates and audits webhook events", () => {
    expect(sql).toContain('create table if not exists public."Payment_Webhook_Events"');
    expect(sql).toContain("signature_valid boolean not null");
    expect(sql).toContain("payload_hash text not null");
    expect(sql).toContain("unique (provider, event_key)");
    expect(sql).toContain("unique (provider, payload_hash)");
  });
});
