import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (service role). Bypasses RLS.
 * NEVER import this into a client component — service key must stay on server.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder";

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
