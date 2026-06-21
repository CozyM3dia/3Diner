"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, Plus as PlusIcon, Box, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { createOrder } from "@/lib/orders";
import { formatRupiah } from "@/lib/format";
import type { Cafe } from "@/types";

export default function CartView({ cafe, slug }: { cafe: Cafe; slug: string }) {
  const { items, count, total, table, setQty, setTable, clear } = useCart();
  const router = useRouter();
  const [touched, setTouched] = useState(false);
  const tableValid = table.trim().length > 0;

  function submit() {
    if (!tableValid) {
      setTouched(true);
      return;
    }
    const order = createOrder({
      cafeId: cafe.id_cafe,
      cafeSlug: slug,
      cafeName: cafe.nama_cafe,
      table: table.trim(),
      items,
      total,
    });
    clear();
    router.push(`/${slug}/pesanan/${order.id_order}`);
  }

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: count > 0 ? "120px" : "0" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{
          background: "rgba(246,248,251,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link href={`/${slug}`} aria-label="Kembali ke menu" className="press w-11 h-11 -ml-2 inline-flex items-center justify-center rounded-full">
          <ArrowLeft size={22} style={{ color: "var(--navy)" }} />
        </Link>
        <h1 className="font-display text-lg font-bold flex-1" style={{ color: "var(--navy)" }}>
          Pesanan Kamu
        </h1>
        {count > 0 && (
          <span className="text-xs font-medium" style={{ color: "var(--navy-muted)" }}>
            {count} item
          </span>
        )}
      </header>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center text-center px-8" style={{ minHeight: "70dvh" }}>
          <div className="w-20 h-20 rounded-full inline-flex items-center justify-center mb-5" style={{ background: "var(--surface)" }}>
            <ShoppingBag size={32} style={{ color: "var(--navy-muted)" }} strokeWidth={1.6} />
          </div>
          <h2 className="font-display text-xl font-bold" style={{ color: "var(--navy)" }}>
            Keranjang masih kosong
          </h2>
          <p className="text-sm mt-1.5 mb-6" style={{ color: "var(--navy-muted)" }}>
            Pilih hidangan favoritmu dulu, lihat dalam 3D, lalu tambahkan ke pesanan.
          </p>
          <Link href={`/${slug}`} className="btn-primary press inline-flex items-center justify-center h-12 px-6 rounded-2xl font-semibold text-sm text-white">
            Jelajahi Menu
          </Link>
        </div>
      ) : (
        <div className="px-4 pt-4">
          {/* Items */}
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id_menu} className="card flex items-center gap-3 p-3 fade-up">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                  {it.image_url ? (
                    <Image src={it.image_url} alt={it.nama_menu} fill sizes="64px" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 dish-mesh flex items-center justify-center">
                      <Box size={20} color="rgba(253,253,253,0.5)" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-sm font-semibold truncate" style={{ color: "var(--navy)" }}>
                    {it.nama_menu}
                  </h3>
                  <p className="text-sm font-bold mt-0.5" style={{ color: "var(--orange-ink)" }}>
                    {formatRupiah(it.harga_menu)}
                  </p>
                </div>
                <div className="shrink-0 inline-flex items-center gap-1">
                  <button
                    onClick={() => setQty(it.id_menu, it.qty - 1)}
                    aria-label={`Kurangi ${it.nama_menu}`}
                    className="press w-10 h-10 rounded-full inline-flex items-center justify-center"
                    style={{ background: "var(--surface)", color: "var(--navy)" }}
                  >
                    <Minus size={16} strokeWidth={2.5} />
                  </button>
                  <span className="w-7 text-center font-bold text-sm tabular-nums" style={{ color: "var(--navy)" }}>
                    {it.qty}
                  </span>
                  <button
                    onClick={() => setQty(it.id_menu, it.qty + 1)}
                    aria-label={`Tambah ${it.nama_menu}`}
                    className="press w-10 h-10 rounded-full inline-flex items-center justify-center text-white"
                    style={{ background: "var(--orange)" }}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add more */}
          <Link
            href={`/${slug}`}
            className="press flex items-center justify-center gap-1.5 mt-4 py-2.5 text-sm font-semibold"
            style={{ color: "var(--orange-ink)" }}
          >
            <PlusIcon size={16} strokeWidth={2.5} /> Tambah item lain
          </Link>

          {/* Table number */}
          <div className="card p-4 mt-4">
            <label htmlFor="meja" className="block text-sm font-semibold mb-2" style={{ color: "var(--navy)" }}>
              Nomor Meja
            </label>
            <input
              id="meja"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              onBlur={() => setTouched(true)}
              inputMode="numeric"
              placeholder="Contoh: 12"
              className="w-full h-12 px-4 rounded-xl text-sm transition-shadow"
              style={{
                background: "var(--surface)",
                color: "var(--navy)",
                boxShadow: touched && !tableValid ? "0 0 0 2px var(--orange)" : undefined,
              }}
            />
            <p className="text-[11px] mt-1.5" style={{ color: touched && !tableValid ? "var(--orange-ink)" : "var(--navy-muted)" }}>
              {touched && !tableValid ? "Wajib diisi sebelum memesan" : "Wajib diisi"}
            </p>
          </div>

          {/* Summary */}
          <div className="card p-4 mt-4">
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--navy-muted)" }}>Subtotal</span>
              <span style={{ color: "var(--navy)" }}>{formatRupiah(total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span style={{ color: "var(--navy-muted)" }}>Pajak &amp; Layanan</span>
              <span style={{ color: "var(--navy)" }}>{formatRupiah(0)}</span>
            </div>
            <div className="w-full h-px my-3" style={{ background: "var(--border)" }} />
            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ color: "var(--navy)" }}>Total</span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--orange-ink)" }}>
                {formatRupiah(total)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sticky CTA */}
      {count > 0 && (
        <div
          className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            background: "var(--white)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={submit}
            className="btn-primary press w-full h-[52px] rounded-2xl font-semibold text-[15px] text-white max-w-xl mx-auto block"
          >
            Pesan Sekarang
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: "var(--navy-muted)" }}>
            Pesananmu akan dikirim ke dapur {cafe.nama_cafe}
          </p>
        </div>
      )}
    </main>
  );
}
