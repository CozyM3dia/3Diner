"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

interface DetailHeaderProps {
  cafeName: string;
  slug: string;
}

export default function DetailHeader({ cafeName, slug }: DetailHeaderProps) {
  const router = useRouter();
  const { count } = useCart();

  const circle =
    "press w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0";
  const circleStyle = { background: "rgba(0,35,85,0.5)", backdropFilter: "blur(6px)" };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-3">
      <button onClick={() => router.push(`/${slug}`)} aria-label="Kembali ke menu" className={circle} style={circleStyle}>
        <ArrowLeft size={18} color="#fff" strokeWidth={2.5} />
      </button>

      <Link
        href={`/${slug}/keranjang`}
        aria-label={count > 0 ? `Keranjang, ${count} item` : "Keranjang"}
        className={`${circle} relative`}
        style={circleStyle}
      >
        <ShoppingBag size={17} color="#fff" strokeWidth={2.2} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--orange)", color: "#fff" }}
          >
            {count}
          </span>
        )}
      </Link>
    </header>
  );
}
