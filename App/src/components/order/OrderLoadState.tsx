"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type LoadState = "loading" | "transient-error" | "not-found";

export function OrderLoadState({
  state,
  slug,
  onRetry,
}: {
  state: LoadState;
  slug: string;
  onRetry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state !== "loading") headingRef.current?.focus();
  }, [state]);

  if (state === "loading") {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div className="w-10 h-10 rounded-full skeleton" role="status" aria-label="Memuat pesanan" />
      </main>
    );
  }

  const isTransient = state === "transient-error";
  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center text-center px-8"
      style={{ background: "var(--paper)" }}
    >
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold" style={{ color: "var(--navy)" }}>
        {isTransient ? "Pesanan belum dapat dimuat" : "Pesanan tidak ditemukan"}
      </h1>
      <p
        className="text-sm mt-1.5 mb-6 max-w-[38ch]"
        style={{ color: "var(--navy-muted)" }}
        {...(isTransient ? { role: "alert" } : {})}
      >
        {isTransient
          ? "Periksa koneksi internetmu, lalu coba lagi."
          : "Tautan pesanan mungkin sudah tidak berlaku, atau dibuka dari perangkat yang berbeda. Minta kasir membuka pesanan dengan nomor mejamu."}
      </p>
      {isTransient ? (
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary press inline-flex items-center justify-center h-12 px-6 rounded-2xl font-semibold text-sm text-white"
        >
          Coba Lagi
        </button>
      ) : (
        <Link
          href={`/${slug}`}
          className="btn-primary press inline-flex items-center justify-center h-12 px-6 rounded-2xl font-semibold text-sm text-white"
        >
          Kembali ke Menu
        </Link>
      )}
    </main>
  );
}
