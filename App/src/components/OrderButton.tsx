"use client";

import { ShoppingBag } from "lucide-react";
import { logEvent } from "@/lib/data";

interface OrderButtonProps {
  redirectLink: string;
  cafeId: string;
  menuId: string;
}

export default function OrderButton({
  redirectLink,
  cafeId,
  menuId,
}: OrderButtonProps) {
  async function handleOrder() {
    // Log click_order — fire and forget
    logEvent({ cafe_id: cafeId, menu_id: menuId, event_type: "click_order", duration: 0 });
    window.open(redirectLink, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      onClick={handleOrder}
      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-white active:scale-95 transition-transform"
      style={{
        background: "#FD5002",
        boxShadow: "0 4px 20px rgba(253,80,2,0.35)",
      }}
    >
      <ShoppingBag size={18} strokeWidth={2} />
      Pesan Sekarang
    </button>
  );
}
