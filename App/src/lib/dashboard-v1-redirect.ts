/** Konsol v1 (`/dashboard`) diganti konsol v2. Bookmark, email, dan tautan
 *  lama harus mendarat di permukaan yang sama, bukan di analitik v1. */
export function dashboardV2Path(pathname: string): string | null {
  if (pathname === "/dashboard-v2" || pathname.startsWith("/dashboard-v2/")) return null;
  if (pathname !== "/dashboard" && !pathname.startsWith("/dashboard/")) return null;
  const rest = pathname.slice("/dashboard".length);
  if (!rest || rest === "/") return "/dashboard-v2";
  if (rest === "/orders" || rest.startsWith("/orders/")) return "/dashboard-v2/pesanan";
  if (rest === "/menu" || rest === "/menu/") return "/dashboard-v2/items";
  if (rest.startsWith("/menu/")) return `/dashboard-v2${rest}`;
  if (rest === "/settings" || rest.startsWith("/settings/")) return "/dashboard-v2/pengaturan";
  if (rest === "/revenue" || rest.startsWith("/revenue/")) return "/dashboard-v2/penjualan";
  return "/dashboard-v2";
}
