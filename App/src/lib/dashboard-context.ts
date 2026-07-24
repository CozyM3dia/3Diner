import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug, getCafeBySlug } from "@/lib/analytics";

export type { CafeRow } from "@/lib/analytics";

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

  const cafe = await getCafeBySlug(slug);

  return {
    userId: user.id,
    slug,
    cafeId: cafe?.id_cafe ?? null,
    cafeName: cafe?.nama_cafe ?? null,
    logoUrl: cafe?.logo_url ?? null,
  };
});
