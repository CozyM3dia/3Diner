import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (service role). Bypasses RLS.
 * NEVER import this into a client component — service key must stay on server.
 * Guard `server-only` membuat pelanggaran itu gagal build, bukan sekadar
 * bergantung pada disiplin.
 *
 * Kontrak env: di runtime produksi kedua variabel wajib diisi (Vercel env).
 * Placeholder di bawah BUKAN konfigurasi yang sah — ia hanya pengaman impor
 * untuk `next build` dan vitest, yang di CI sengaja diberi env placeholder
 * (lihat `.github/workflows/ci.yml`) karena semua halaman force-dynamic dan
 * tidak ada query yang berjalan saat build. Request nyata dengan key
 * placeholder akan ditolak Supabase, jadi kebocoran konfigurasi tetap keras
 * terasa, tidak diam-diam.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder";

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
