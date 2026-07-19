/** Canonical public origin untuk aset yang diekspor (QR, share link).
 *  Server-side only untuk env non-NEXT_PUBLIC; hasilnya dikirim ke client sebagai prop. */
export function canonicalOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim() !== "") return stripTrailingSlash(explicit.trim());

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd && vercelProd.trim() !== "") return `https://${stripTrailingSlash(vercelProd.trim())}`;

  return "http://localhost:3000";
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** URL menu publik kafe: `${origin}/${slug}`. Slug di-encode agar aman. */
export function menuUrlFor(origin: string, slug: string): string {
  return `${stripTrailingSlash(origin)}/${encodeURIComponent(slug)}`;
}
