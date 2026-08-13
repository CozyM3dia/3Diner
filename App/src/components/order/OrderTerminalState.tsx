"use client";

import Link from "next/link";
import type { Order } from "@/types";

export function OrderTerminalState({ order, slug }: { order: Order; slug: string }) {
  const cancelled = order.status === "cancelled";

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center px-6" style={{ background: "var(--paper)" }}>
      <div className="max-w-md rounded-2xl p-6" style={{ background: "var(--white)", boxShadow: "var(--shadow-sm)" }}>
        <h1 className="font-display text-2xl font-extrabold" style={{ color: "var(--navy)" }}>
          {cancelled ? "Pesanan dibatalkan" : "Pesanan selesai"}
        </h1>
        <p className="text-sm mt-3" style={{ color: "var(--navy-muted)" }}>
          {cancelled ? "Pesanan ini tidak akan diproses lebih lanjut." : "Pesananmu sudah selesai."}
        </p>
        {cancelled && order.cancelled_reason && (
          <p className="mt-4 rounded-xl p-3 text-sm" role="status" style={{ background: "var(--orange-blush)", color: "var(--orange-ink)" }}>
            {order.cancelled_reason}
          </p>
        )}
        <Link
          href={`/${slug}`}
          className="btn-primary press mt-6 inline-flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-white"
        >
          Kembali ke Menu
        </Link>
      </div>
    </main>
  );
}
