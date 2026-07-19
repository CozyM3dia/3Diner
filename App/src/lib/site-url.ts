/** Canonical public origin untuk aset yang diekspor (QR, share link).
 *  Server-side only untuk env non-NEXT_PUBLIC; hasilnya dikirim ke client sebagai prop. */
export function canonicalOrigin(): string {
  const explicit = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;

  const vercelProd = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProd) return vercelProd;

  return "http://localhost:3000";
}

/** Normalisasi kandidat origin: trim, tambahkan https:// bila protokol hilang,
 *  toleran terhadap protokol yang tak sengaja terduplikasi, buang trailing slash.
 *  Null bila kosong/whitespace. */
export function normalizeOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  // Buang seluruh prefix protokol (termasuk ganda seperti "https://https://host").
  const host = value.replace(/^(https?:\/\/)+/i, "");
  if (host === "") return null;
  const protocol = /^http:\/\//i.test(value) ? "http" : "https";
  return stripTrailingSlash(`${protocol}://${host}`);
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** URL menu publik kafe: `${origin}/${slug}`. Slug di-encode agar aman. */
export function menuUrlFor(origin: string, slug: string): string {
  return `${stripTrailingSlash(origin)}/${encodeURIComponent(slug)}`;
}
