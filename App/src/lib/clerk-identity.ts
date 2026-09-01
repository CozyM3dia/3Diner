import "server-only";

import { randomBytes } from "node:crypto";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const IDENTITY_TABLE = "Clerk_Identities";
const USERS_PER_PAGE = 200;
const MAX_USER_PAGES = 50;

export interface ClerkIdentity {
  clerkUserId: string;
  supabaseUserId: string;
  email: string;
}

/** Error type used to fail closed when the compatibility bridge is unavailable. */
export class ClerkIdentityError extends Error {
  constructor(message = "Sesi identitas belum siap.") {
    super(message);
    this.name = "ClerkIdentityError";
  }
}

export function normalizeIdentityEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

async function getClerkUserId(): Promise<string | null> {
  try {
    return (await auth()).userId ?? null;
  } catch {
    // The fallback keeps older Supabase sessions usable while Clerk is being
    // configured, and also keeps non-Clerk local environments bootable.
    return null;
  }
}

async function getExistingIdentity(clerkUserId: string): Promise<ClerkIdentity | null> {
  const { data, error } = await supabaseAdmin
    .from(IDENTITY_TABLE)
    .select("clerk_user_id, supabase_user_id, email")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) throw new ClerkIdentityError("Database identity bridge belum aktif.");
  if (!data) return null;

  return {
    clerkUserId: String(data.clerk_user_id),
    supabaseUserId: String(data.supabase_user_id),
    email: String(data.email),
  };
}

async function findSupabaseUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    });
    if (error) throw new ClerkIdentityError("Gagal mencari identitas akun lama.");

    const match = data.users.find(
      (user) => normalizeIdentityEmail(user.email) === email,
    );
    if (match) return match.id;
    if (data.users.length < USERS_PER_PAGE) return null;
  }

  throw new ClerkIdentityError("Daftar identitas akun terlalu besar untuk dicari.");
}

async function createShadowSupabaseUser(email: string, clerkUserId: string): Promise<string> {
  const password = randomBytes(32).toString("base64url");
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { clerk_user_id: clerkUserId },
  });

  if (!error && data.user) return data.user.id;

  // Another request may have provisioned the same email between listUsers and
  // createUser. Reconcile that race without exposing the generated password.
  const existingUserId = await findSupabaseUserIdByEmail(email);
  if (existingUserId) return existingUserId;
  throw new ClerkIdentityError("Gagal menyiapkan identitas akun.");
}

/** Create or retrieve the UUID used by the existing Supabase business schema. */
export async function ensureClerkIdentity(clerkUserId: string): Promise<ClerkIdentity> {
  const existing = await getExistingIdentity(clerkUserId);
  if (existing) return existing;

  const user = await currentUser();
  const email = normalizeIdentityEmail(
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress,
  );
  if (!email) throw new ClerkIdentityError("Akun Clerk belum memiliki email terverifikasi.");

  let supabaseUserId = await findSupabaseUserIdByEmail(email);
  if (!supabaseUserId) supabaseUserId = await createShadowSupabaseUser(email, clerkUserId);

  const { data, error } = await supabaseAdmin
    .from(IDENTITY_TABLE)
    .insert({
      clerk_user_id: clerkUserId,
      supabase_user_id: supabaseUserId,
      email,
    })
    .select("clerk_user_id, supabase_user_id, email")
    .single();

  if (!error && data) {
    return {
      clerkUserId: String(data.clerk_user_id),
      supabaseUserId: String(data.supabase_user_id),
      email: String(data.email),
    };
  }

  // A concurrent request can win the unique Clerk ID insert. Prefer the
  // committed mapping in that case instead of provisioning another session.
  const raced = await getExistingIdentity(clerkUserId);
  if (raced) return raced;
  throw new ClerkIdentityError("Gagal menyimpan link identitas akun.");
}

/**
 * Return the legacy Supabase UUID for the current authenticated principal.
 * Clerk is preferred; the Supabase fallback is temporary compatibility for
 * sessions created before the Clerk cutover.
 */
export const getAuthenticatedSupabaseUserId = cache(async (): Promise<string | null> => {
  const clerkUserId = await getClerkUserId();
  if (clerkUserId) {
    const identity = await ensureClerkIdentity(clerkUserId);
    return identity.supabaseUserId;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});
