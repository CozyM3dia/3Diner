import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga statis untuk dua kelas bug yang lolos CI dan mematikan checkout
 * pelanggan selama berhari-hari (lihat 20260825000000_fix_issue_order_quote.sql).
 *
 * Keduanya lolos karena PL/pgSQL hanya memvalidasi *sintaks* body saat CREATE
 * FUNCTION, bukan resolusi identifier atau ketersediaan fungsi. Jadi
 * `supabase db reset` tetap hijau dan kegagalan baru muncul saat RPC dipanggil
 * di runtime — di produksi.
 *
 * Test lama (commit-request-hash-parity) membandingkan blok hash sebagai TEKS,
 * sehingga `p_quote_id` di kedua sisi dianggap cocok padahal di satu fungsi
 * identifier itu tidak ada. Test di sini memeriksa maknanya, bukan teksnya.
 */

const migrationsDir = join(process.cwd(), "supabase", "migrations");

/** Fungsi pgcrypto yang di Supabase tinggal di skema `extensions`, bukan `public`.
 *  `gen_random_uuid` sengaja TIDAK di sini: sejak PG13 ia builtin pg_catalog. */
const PGCRYPTO_FUNCTIONS = [
  "digest", "hmac", "crypt", "gen_salt", "gen_random_bytes",
  "encrypt", "decrypt", "pgp_sym_encrypt", "pgp_sym_decrypt",
  "pgp_pub_encrypt", "pgp_pub_decrypt",
];

interface FunctionDefinition {
  name: string;
  arity: number;
  params: string[];
  header: string;
  body: string;
  source: string;
}

/** Buang komentar dan literal string supaya pemindaian identifier tidak
 *  tertipu oleh nama yang cuma disebut dalam prosa atau string. */
function stripCommentsAndLiterals(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''");
}

function splitTopLevel(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of args) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

const DEFINITION_RE =
  /create\s+or\s+replace\s+function\s+public\.(\w+)\s*\(([\s\S]*?)\)\s*returns([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$\s*;/gi;

const ALTER_SEARCH_PATH_RE =
  /alter\s+function\s+public\.(\w+)\s*\(([\s\S]*?)\)\s*set\s+search_path\s*=\s*([^;]+);/gi;

/**
 * Definisi efektif setiap fungsi setelah semua migrasi diterapkan berurutan:
 * `create or replace` terakhir menang, dan `alter function ... set search_path`
 * berikutnya menimpa search_path-nya. Ini yang benar-benar hidup di database,
 * bukan sekadar isi satu file.
 */
function resolveEffectiveFunctions(): Map<string, FunctionDefinition> {
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
  const resolved = new Map<string, FunctionDefinition>();

  for (const file of files) {
    // Migrasi di repo ini bercampur CRLF dan LF; normalkan supaya perbandingan
    // rumus hash tidak gagal hanya karena akhiran baris.
    const sql = readFileSync(join(migrationsDir, file), "utf8").replace(/\r\n/g, "\n");

    for (const match of sql.matchAll(DEFINITION_RE)) {
      const [, name, rawArgs, header, body] = match;
      const params = splitTopLevel(rawArgs).map((arg) => arg.split(/\s+/)[0].toLowerCase());
      resolved.set(`${name}/${params.length}`, {
        name,
        arity: params.length,
        params,
        header,
        body,
        source: file,
      });
    }

    for (const match of sql.matchAll(ALTER_SEARCH_PATH_RE)) {
      const [, name, rawTypes, searchPath] = match;
      const arity = splitTopLevel(rawTypes).length;
      const existing = resolved.get(`${name}/${arity}`);
      if (!existing) continue;
      resolved.set(`${name}/${arity}`, {
        ...existing,
        header: `set search_path = ${searchPath.trim()}`,
        source: `${existing.source} (search_path: ${file})`,
      });
    }
  }

  return resolved;
}

const functions = resolveEffectiveFunctions();

function hashExpression(body: string): string | null {
  const start = body.indexOf("v_hash := encode(digest(convert_to(");
  if (start === -1) return null;
  const end = body.indexOf("::text, 'utf8'), 'sha256'), 'hex');", start);
  if (end === -1) return null;
  return body.slice(start, end);
}

describe("PL/pgSQL identifier resolution", () => {
  it("parses the migration set", () => {
    expect(functions.size).toBeGreaterThan(30);
    expect(functions.has("issue_order_quote/5")).toBe(true);
    expect(functions.has("commit_order_atomic/7")).toBe(true);
  });

  /**
   * Bug asli: `issue_order_quote` mem-hash `p_quote_id`, padahal parameternya
   * tidak ada — id quote yang baru dibuat ada di `v_quote_id`. Setiap panggilan
   * gagal `42703 column "p_quote_id" does not exist`.
   */
  it("never references a p_-prefixed identifier that is not a declared parameter", () => {
    const offenders: string[] = [];

    for (const fn of functions.values()) {
      const code = stripCommentsAndLiterals(fn.body);
      const declared = new Set(fn.params);
      // Variabel lokal boleh diawali p_ selama dideklarasikan di blok declare.
      const declareBlock = /declare([\s\S]*?)\bbegin\b/i.exec(code);
      if (declareBlock) {
        for (const line of declareBlock[1].split(/[;\n]/)) {
          const local = /^\s*([a-z_][a-z0-9_]*)/i.exec(line);
          if (local) declared.add(local[1].toLowerCase());
        }
      }

      for (const match of code.matchAll(/\bp_[a-z0-9_]+\b/gi)) {
        const identifier = match[0].toLowerCase();
        if (!declared.has(identifier)) {
          offenders.push(`${fn.name}/${fn.arity} (${fn.source}): ${identifier}`);
        }
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });

  /**
   * Bug kedua: `digest()` dipanggil sementara search_path dipin ke `public`.
   * Di Supabase pgcrypto ada di `extensions`, jadi gagal
   * `42883 function digest(bytea, unknown) does not exist`. Presedennya
   * 20260809120005 (gen_random_bytes untuk kode check-in kasir).
   */
  it("includes the extensions schema wherever pgcrypto is called", () => {
    const offenders: string[] = [];

    for (const fn of functions.values()) {
      const code = stripCommentsAndLiterals(fn.body);
      const used = PGCRYPTO_FUNCTIONS.filter((name) =>
        new RegExp(`\\b${name}\\s*\\(`, "i").test(code)
      );
      if (used.length === 0) continue;

      const searchPath = /set\s+search_path\s*=\s*([^\n]+)/i.exec(fn.header);
      const schemas = (searchPath?.[1] ?? "").toLowerCase();
      if (!schemas.includes("extensions")) {
        offenders.push(`${fn.name}/${fn.arity} (${fn.source}) calls ${used.join(", ")} with search_path="${schemas.trim()}"`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("checkout request_hash parity", () => {
  const issue = functions.get("issue_order_quote/5");
  const commit = functions.get("commit_order_atomic/7");

  it("hashes the same fields in the same order on both sides", () => {
    const issueHash = hashExpression(issue!.body);
    const commitHash = hashExpression(commit!.body);
    expect(issueHash).not.toBeNull();
    expect(commitHash).not.toBeNull();

    for (const field of ["'cafe_id'", "'table_number'", "'items'", "'notes'", "'channel'", "'quote_id'"]) {
      expect(issueHash).toContain(field);
      expect(commitHash).toContain(field);
    }

    // Satu-satunya perbedaan sah adalah dari mana id quote dibaca: penerbit
    // baru saja membuatnya (v_quote_id), sedangkan commit menerimanya sebagai
    // parameter (p_quote_id). Setelah dinormalkan, rumusnya harus identik --
    // kalau tidak, request_hash tidak akan pernah cocok dan setiap checkout
    // ditolak sebagai quote_mismatch.
    const normalise = (hash: string) => hash.replace(/[vp]_quote_id/g, "<quote_id>");
    expect(normalise(issueHash!)).toBe(normalise(commitHash!));
  });

  it("issues the hash over the quote id it actually persists and returns", () => {
    // Body mentah, bukan hasil strip: pemeriksaan di bawah justru bergantung
    // pada literal seperti 'quote_id' yang akan hilang kalau di-strip.
    const body = issue!.body;
    const hash = hashExpression(body)!;

    // Nilai yang di-hash harus nilai yang sama dengan yang ditulis ke
    // "Order_Quotes" dan dikirim balik ke klien; kalau berbeda, commit tidak
    // mungkin merekonstruksi hash yang sama.
    expect(hash).toContain("'quote_id', v_quote_id");
    expect(body).toContain("v_quote_id, p_cafe_id, v_hash");
    expect(body).toContain("'quote_id', v_quote_id");
    expect(hash).not.toContain("p_quote_id");
  });

  it("keeps the idempotency claim before the quote lock (regression guard)", () => {
    const body = commit!.body;
    expect(body.indexOf('insert into public."Order_Idempotency_Keys"'))
      .toBeLessThan(body.indexOf("select * into v_quote"));
    expect(body).toContain("v_idempotency.request_hash <> v_hash");
    expect(body).toContain("v_quote.request_hash <> v_hash");
  });
});
