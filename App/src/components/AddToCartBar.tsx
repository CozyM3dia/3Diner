"use client";

import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { logEvent } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import type { Menu } from "@/types";

export default function AddToCartBar({ menu, slug }: { menu: Menu; slug: string }) {
  const { items, add, setQty } = useCart();
  const item = items.find((i) => i.id_menu === menu.id_menu);
  const qty = item?.qty ?? 0;

  function inc() {
    if (qty === 0) {
      add(menu, 1);
      logEvent({ cafe_id: menu.cafe_id, menu_id: menu.id_menu, event_type: "click_order", duration: 0 });
    } else {
      setQty(menu.id_menu, qty + 1);
    }
  }

  function dec() {
    setQty(menu.id_menu, qty - 1);
  }

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        background: "var(--white)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2 max-w-xl mx-auto">
        {qty === 0 ? (
          <button
            onClick={inc}
            className="btn-primary press flex-1 inline-flex items-center justify-between gap-2 h-[52px] px-5 rounded-2xl text-white"
          >
            <span className="font-semibold text-sm whitespace-nowrap">Tambah ke Pesanan</span>
            <span className="font-bold text-sm whitespace-nowrap tabular-nums">{formatRupiah(menu.harga_menu)}</span>
          </button>
        ) : (
          <>
            <div
              className="shrink-0 inline-flex items-center h-[52px] px-1 rounded-2xl"
              style={{ background: "var(--surface)" }}
            >
              <button
                onClick={dec}
                aria-label={qty === 1 ? `Hapus ${menu.nama_menu} dari pesanan` : "Kurangi jumlah"}
                className="press w-9 h-9 rounded-full inline-flex items-center justify-center"
                style={{ background: "var(--white)", color: "var(--navy)" }}
              >
                <Minus size={15} strokeWidth={2.5} />
              </button>
              <span className="w-7 text-center font-bold text-base tabular-nums" style={{ color: "var(--navy)" }}>
                {qty}
              </span>
              <button
                onClick={inc}
                aria-label="Tambah jumlah"
                className="press w-9 h-9 rounded-full inline-flex items-center justify-center text-white"
                style={{ background: "var(--orange)" }}
              >
                <Plus size={15} strokeWidth={2.5} />
              </button>
            </div>

            <Link
              href={`/${slug}/keranjang`}
              className="btn-primary press flex-1 min-w-0 inline-flex items-center justify-between gap-2 h-[52px] px-4 rounded-2xl text-white"
            >
              <span className="font-semibold text-sm whitespace-nowrap">Pesanan</span>
              <span className="font-bold text-sm whitespace-nowrap tabular-nums">
                {formatRupiah(menu.harga_menu * qty)}
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
