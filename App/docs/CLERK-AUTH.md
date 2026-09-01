# Clerk authentication

3Diner now uses Clerk for the browser authentication session. The existing
Supabase Auth UUIDs remain the business identity for `Cafes`, `Staff`, and
legacy owner queries. The server-only bridge in `src/lib/clerk-identity.ts`
links the two identities through `public."Clerk_Identities"`.

## Setup

1. Create or select the Clerk application for this environment.
2. Enable email and password sign-in. Enable email verification codes for sign-up.
3. Add these values to `App/.env.local` or the matching Vercel environment. Do not commit the file or print the values:

   ```text
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

4. Configure Clerk's allowed origins for the local URL and production URL.
5. Apply `supabase/migrations/20260901174227_clerk_identity_bridge.sql` through the normal Supabase migration workflow. This repository creates the file but does not apply it automatically.
6. Restart Next.js after changing environment variables.

The login page calls Clerk's custom password flow, verifies the email code when
required, then posts to `/api/auth/bootstrap`. That endpoint resolves the
existing role and routes the user to the correct console.

## Identity linking

- An existing Supabase user is matched by normalized email the first time they
  sign in with Clerk.
- A Clerk user without an existing Supabase Auth user receives a random,
  server-only shadow Supabase user. The generated password is never shown or
  logged.
- A new Clerk account is not automatically a staff member. An owner must add a
  `Staff` row or invite the user through the existing staff workflow.
- If the bridge table or service-role configuration is unavailable, the login
  reports a retryable setup error and does not silently grant access.

## Compatibility

Until the Clerk keys are configured, the app keeps its legacy Supabase session
gate available. The old dashboard shell also keeps a Supabase logout fallback;
once the publishable key is present, the dashboard uses Clerk logout.

## Supabase client access

Current server actions use the service-role client only after the Clerk session
has been verified and mapped to the legacy UUID. If browser Supabase queries or
Realtime channels are later moved to Clerk-native tokens, configure Supabase's
Clerk third-party authentication integration and pass the Clerk token to the
Supabase client instead of weakening the existing RLS policies.
