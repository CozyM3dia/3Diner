/** Tag `unstable_cache` untuk data menu tamu. Modul ini sengaja tidak
 *  mengimpor `next/cache` — tag string boleh dipakai dari data.ts server
 *  tanpa menyeret `revalidatePath` ke Client Component yang hanya butuh
 *  `logEvent`. */
export function guestCafeTag(slug: string): string {
  return `guest-cafe:${slug}`;
}

export function guestCafeIdTag(cafeId: string): string {
  return `guest-cafe-id:${cafeId}`;
}
