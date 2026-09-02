import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Cafe, Menu, Announcement } from "@/types";
import { guestCafeIdTag, guestCafeTag } from "@/lib/guest-cache-tags";

async function getSupabaseFns() {
  return import("./supabase");
}

export async function getActiveAnnouncement(cafeId: string): Promise<Announcement | null> {
  const { getActiveAnnouncement: fn } = await getSupabaseFns();
  return fn(cafeId);
}

/** `generateMetadata` dan komponen halaman berjalan dalam satu request yang
 *  sama dan memerlukan kafe serta menu yang persis sama. Tanpa cache(), tiap
 *  halaman menu menembak Supabase dua kali untuk jawaban yang identik.
 *  `unstable_cache` menahan hasil lintas-request selama ISR 60s, di-tag
 *  supaya tulis admin tidak menunggu jendela waktu. */
export const getCafeBySlug = cache((slug: string): Promise<Cafe | null> =>
  unstable_cache(
    async () => {
      const { getCafeBySlug: fn } = await getSupabaseFns();
      return fn(slug);
    },
    ["guest-cafe-by-slug", slug],
    { revalidate: 60, tags: [guestCafeTag(slug)] },
  )()
);

export const getMenusByCafeId = cache(async (cafeId: string): Promise<Menu[]> => {
  const { getMenusByCafeId: fn } = await getSupabaseFns();
  return fn(cafeId);
});

export const getMenuPageBySlug = cache((
  slug: string
): Promise<{ cafe: Cafe; menus: Menu[]; announcement: Announcement | null } | null> =>
  unstable_cache(
    async () => {
      const { getMenuPageBySlug: fn } = await getSupabaseFns();
      return fn(slug);
    },
    ["guest-menu-page", slug],
    { revalidate: 60, tags: [guestCafeTag(slug)] },
  )()
);

export const getCafeAndMenuBySlug = cache((
  slug: string,
  menuId: string
): Promise<{ cafe: Cafe; menu: Menu } | null> =>
  unstable_cache(
    async () => {
      const { getCafeAndMenuBySlug: fn } = await getSupabaseFns();
      return fn(slug, menuId);
    },
    ["guest-cafe-and-menu", slug, menuId],
    { revalidate: 60, tags: [guestCafeTag(slug)] },
  )()
);

export const getMenuById = cache((
  cafeId: string,
  menuId: string
): Promise<Menu | null> =>
  unstable_cache(
    async () => {
      const { getMenuById: fn } = await getSupabaseFns();
      return fn(cafeId, menuId);
    },
    ["guest-menu-by-id", cafeId, menuId],
    { revalidate: 60, tags: [guestCafeIdTag(cafeId)] },
  )()
);
