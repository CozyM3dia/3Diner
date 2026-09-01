import { cache } from "react";
import { getAuthenticatedSupabaseUserId } from "@/lib/clerk-identity";
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
  const userId = await getAuthenticatedSupabaseUserId();
  if (!userId) return EMPTY;

  const slug = await getOwnerCafeSlug(userId);
  if (!slug) return { ...EMPTY, userId };

  const cafe = await getCafeBySlug(slug);

  return {
    userId,
    slug,
    cafeId: cafe?.id_cafe ?? null,
    cafeName: cafe?.nama_cafe ?? null,
    logoUrl: cafe?.logo_url ?? null,
  };
});
