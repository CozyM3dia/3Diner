import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface DashboardCafeContext {
  userId: string | null;
  slug: string | null;
  cafeId: string | null;
  cafeName: string | null;
  logoUrl: string | null;
}

const EMPTY: DashboardCafeContext = {
  userId: null,
  slug: null,
  cafeId: null,
  cafeName: null,
  logoUrl: null,
};

/**
 * Satu lookup auth + kafe per request, dipakai bersama oleh layout dan
 * semua page dashboard. React cache() men-dedupe pemanggilan di dalam
 * satu render tree (layout + page + nested component).
 */
export const getDashboardCafeContext = cache(async (): Promise<DashboardCafeContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const slug = await getOwnerCafeSlug(user.id);
  if (!slug) return { ...EMPTY, userId: user.id };

  const { data } = await supabaseAdmin
    .from("Cafes")
    .select("id_cafe, nama_cafe, logo_url, slug_url")
    .eq("slug_url", slug)
    .single();

  return {
    userId: user.id,
    slug,
    cafeId: (data?.id_cafe as string | undefined) ?? null,
    cafeName: (data?.nama_cafe as string | undefined) ?? null,
    logoUrl: (data?.logo_url as string | null | undefined) ?? null,
  };
});
