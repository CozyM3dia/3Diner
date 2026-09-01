import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { friendlyClerkError } from "../src/lib/clerk-errors";

const migration = readFileSync(
  new URL("../supabase/migrations/20260901174227_clerk_identity_bridge.sql", import.meta.url),
  "utf8",
);
const identity = readFileSync(new URL("../src/lib/clerk-identity.ts", import.meta.url), "utf8");
const login = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
const clerkErrors = readFileSync(new URL("../src/lib/clerk-errors.ts", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

describe("Clerk authentication contract", () => {
  it("keeps the identity bridge private and tied to Supabase Auth", () => {
    expect(migration).toContain('create table if not exists public."Clerk_Identities"');
    expect(migration).toContain("references auth.users(id) on delete cascade");
    expect(migration).toContain('on public."Clerk_Identities" (lower(email))');
    expect(migration).toContain('alter table public."Clerk_Identities" enable row level security');
    expect(migration).toContain(
      'revoke all on table public."Clerk_Identities" from anon, authenticated',
    );
    expect(migration).toContain(
      'grant select, insert, update, delete on table public."Clerk_Identities" to service_role',
    );
  });

  it("provisions the legacy UUID server-side without exposing generated credentials", () => {
    expect(identity).toContain('import "server-only"');
    expect(identity).toContain("supabaseAdmin.auth.admin.listUsers");
    expect(identity).toContain("supabaseAdmin.auth.admin.createUser");
    expect(identity).toContain('randomBytes(32).toString("base64url")');
    expect(identity).not.toContain("console.log");
    expect(identity).not.toContain("console.error");
  });

  it("uses Clerk's custom flow and role bootstrap instead of Supabase form auth", () => {
    expect(login).toContain("signIn.password");
    expect(login).toContain("signUp.password");
    expect(login).toContain("/api/auth/bootstrap");
    expect(clerkErrors).toContain("form_identifier_not_found");
    expect(clerkErrors).toContain("Akun tidak ditemukan. Silakan daftar terlebih dahulu.");
    expect(login).toContain("AUTH_REQUEST_TIMEOUT_MS");
    expect(login).not.toContain("signInWithPassword");
    expect(login).not.toContain("supabase.auth.signUp");
  });

  it("explains missing accounts without exposing Clerk's raw error", () => {
    expect(
      friendlyClerkError({
        code: "form_identifier_not_found",
        longMessage: "Couldn't find your account.",
      }),
    ).toBe("Akun tidak ditemukan. Silakan daftar terlebih dahulu.");
    expect(
      friendlyClerkError({
        errors: [{ code: "form_password_incorrect", message: "Password is incorrect" }],
      }),
    ).toBe("Email atau password salah.");
    expect(
      friendlyClerkError(
        { longMessage: "This email is already registered. Please sign in." },
        "signin",
      ),
    ).toBe("Email atau password salah.");
    expect(
      friendlyClerkError(
        { longMessage: "This email is already registered. Please sign in." },
        "signup",
      ),
    ).toBe("Email ini sudah terdaftar. Coba masuk, atau gunakan email lain.");
  });

  it("allows Clerk's browser runtime through the application CSP", () => {
    expect(nextConfig).toContain("https://*.clerk.accounts.dev");
    expect(nextConfig).toContain("https://*.clerk.com");
    expect(nextConfig).toContain("https://*.clerk.dev");
    expect(nextConfig).toContain("https://challenges.cloudflare.com");
    expect(nextConfig).toContain('process.env.NODE_ENV === "development"');
    expect(nextConfig).toContain("'unsafe-eval'");
  });

  it("covers the rebuilt dashboard route in both provider and compatibility gates", () => {
    expect(middleware).toContain('"/dashboard-v2"');
    expect(middleware).toContain('"/dashboard-v2/:path*"');
    expect(middleware).toContain("clerkMiddleware");
    expect(middleware).toContain("legacyMiddleware");
  });
});
