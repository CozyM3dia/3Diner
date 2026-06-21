"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatRupiah } from "@/lib/format";

export default function CartFab({ slug }: { slug: string }) {
  const { count, total } = useCart();
  const pathname = usePathname();

  // Show only on the cafe home grid (exactly /[slug]). On detail/3d/cart/order
  // the page has its own sticky action bar, so the FAB would collide.
  const segments = pathname.split("/").filter(Boolean);
  const isCafeHome = segments.length === 1;
  if (count === 0 || !isCafeHome) return null;

  return (
    <Link
      href={`/${slug}/keranjang`}
      aria-label={`Lihat keranjang, ${count} item, total ${formatRupiah(total)}`}
      className="fab-in press fixed right-4 z-50 flex items-center gap-3 h-12 pl-4 pr-5 rounded-full text-white"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
        background: "var(--orange)",
        boxShadow: "var(--shadow-orange)",
      }}
    >
      <span className="relative inline-flex">
        <ShoppingBag size={20} strokeWidth={2.2} />
        <span
          className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ background: "#fff", color: "var(--orange-ink)" }}
        >
          {count}
        </span>
      </span>
      <span className="text-[13px] font-semibold whitespace-nowrap">{count} item</span>
      <span className="w-px h-4" style={{ background: "rgba(255,255,255,0.35)" }} />
      <span className="text-[13px] font-bold whitespace-nowrap">{formatRupiah(total)}</span>
    </Link>
  );
}
