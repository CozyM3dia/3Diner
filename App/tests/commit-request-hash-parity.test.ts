import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixSql = readFileSync(new URL("../supabase/migrations/20260824000000_fix_commit_request_hash.sql", import.meta.url), "utf8");
const originalSql = readFileSync(new URL("../supabase/migrations/20260708000000_atomic_order_commit.sql", import.meta.url), "utf8");

function hashBlock(sql: string): string {
  const start = sql.indexOf("v_hash := encode(digest(convert_to(");
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("::text, 'utf8'), 'sha256'), 'hex');", start));
}

describe("commit request hash parity", () => {
  it("commit_order_atomic recomputes the same request_hash formula as issue_order_quote", () => {
    const commitHash = hashBlock(fixSql);
    for (const field of ["'cafe_id'", "'table_number'", "'items'", "'notes'", "'channel'", "'quote_id'"]) {
      expect(commitHash).toContain(field);
    }
    // Rumus harus identik dengan yang dipakai saat issue quote.
    const issueHash = hashBlock(originalSql);
    expect(commitHash).toBe(issueHash);
  });

  it("keeps idempotency claim before quote lock (regression guard)", () => {
    expect(fixSql).toContain("create or replace function public.commit_order_atomic");
    expect(fixSql.indexOf('insert into public."Order_Idempotency_Keys"'))
      .toBeLessThan(fixSql.indexOf("select * into v_quote"));
    expect(fixSql).toContain("v_idempotency.request_hash <> v_hash");
    expect(fixSql).toContain("v_quote.request_hash <> v_hash");
  });
});
