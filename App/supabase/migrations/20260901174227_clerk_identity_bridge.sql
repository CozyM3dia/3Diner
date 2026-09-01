-- Clerk owns the browser session, while the existing business schema still
-- points to Supabase Auth UUIDs. This table keeps that compatibility boundary
-- explicit and lets the bridge be reconciled without changing cafe data.
create table if not exists public."Clerk_Identities" (
  clerk_user_id text primary key,
  supabase_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists "Clerk_Identities_email_idx"
  on public."Clerk_Identities" (lower(email));

alter table public."Clerk_Identities" enable row level security;

revoke all on table public."Clerk_Identities" from anon, authenticated;
grant select, insert, update, delete on table public."Clerk_Identities" to service_role;
