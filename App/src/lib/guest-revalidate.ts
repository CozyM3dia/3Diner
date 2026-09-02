import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { guestCafeIdTag, guestCafeTag } from "@/lib/guest-cache-tags";

export { guestCafeIdTag, guestCafeTag } from "@/lib/guest-cache-tags";

/** Invalidate ISR menu tamu satu kafe, bukan seluruh pohon `/`.
 *
 *  `revalidatePath("/", "layout")` memaksa setiap slug di-CDN di-render ulang.
 *  Path literal `/${slug}` + type layout menyentuh daftar menu, detail, 3D,
 *  dan keranjang kafe itu saja. */
export function revalidateGuestCafe(
  slug: string | null | undefined,
  cafeId?: string | null,
): void {
  const trimmed = slug?.trim();
  if (!trimmed) {
    revalidatePath("/[slug]", "page");
  } else {
    revalidatePath(`/${trimmed}`, "layout");
    revalidateTag(guestCafeTag(trimmed), "max");
  }
  const id = cafeId?.trim();
  if (id) revalidateTag(guestCafeIdTag(id), "max");
}
