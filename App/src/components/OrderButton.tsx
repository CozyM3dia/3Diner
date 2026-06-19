"use client";

import { ShoppingBag } from "lucide-react";
import { logEvent } from "@/lib/supabase";

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
      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
      style={{
        background: "#F5E6D3",
        color: "#8B5E3C",
        border: "1.5px solid #E8D5C0",
      }}
    >
      <ShoppingBag size={18} strokeWidth={2} />
      Pesan Sekarang
    </button>
  );
}
