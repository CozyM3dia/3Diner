"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Wallet,
  QrCode,
  ChevronRight,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Star,
  Loader2,
} from "lucide-react";
import { fetchOrder, getStub, setPaymentMethod } from "@/lib/orders";
import { formatRupiah } from "@/lib/format";
import type { Order, OrderItem } from "@/types";

type View = "loading" | "missing" | "choose" | "qris" | "status";

/** Selang polling. Layar QRIS menunggu webhook Midtrans, jadi diperiksa lebih
 *  sering; layar status hanya menunggu dapur, yang bergerak dalam menit. */
const POLL_QRIS_MS = 4000;
const POLL_STATUS_MS = 15000;

export default function OrderView({ slug, orderId }: { slug: string; orderId: string }) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [view, setView] = useState<View>("loading");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Token boleh datang dari tautan (perangkat lain, cache terhapus) atau dari
  // cache lokal perangkat yang membuat pesanan. getStub menyentuh localStorage,
  // jadi hanya boleh dibaca setelah komponen terpasang.
  const linkToken = searchParams.get("token");

  /** Token dibaca saat dibutuhkan, bukan disimpan di state: getStub menyentuh
   *  localStorage, yang tidak ada saat render di server. Semua pemanggil di
   *  bawah ini berjalan setelah komponen terpasang. */
  const resolveToken = useCallback(
    () => linkToken ?? getStub(orderId)?.customer_token ?? null,
    [linkToken, orderId]
  );

  /** Satu-satunya jalan status masuk ke layar ini: dibaca dari server. */
  const load = useCallback(async (): Promise<Order | null> => {
    const token = resolveToken();
    if (!token) return null;
    const fetched = await fetchOrder(orderId, token);
    if (!fetched) return null;
    setOrder(fetched.order);
    setReviewUrl(fetched.reviewUrl);
    return fetched.order;
  }, [orderId, resolveToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = await load();
      if (cancelled) return;
      setView(fresh ? viewForOrder(fresh) : "missing");
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Polling menggantikan langganan Realtime anon: tabel Orders dicabut aksesnya
  // dari peran anon, jadi postgres_changes tidak pernah sampai ke pelanggan.
  useEffect(() => {
    if (view !== "qris" && view !== "status") return;
    if (order?.status === "ready" && order?.payment_status === "paid") return;

    const interval = view === "qris" ? POLL_QRIS_MS : POLL_STATUS_MS;
    const timer = setInterval(() => {
      void load().then((fresh) => {
        if (fresh && fresh.payment_status === "paid" && view === "qris") setView("status");
      });
    }, interval);

    return () => clearInterval(timer);
  }, [view, order?.status, order?.payment_status, load]);

  async function refreshNow() {
    setRefreshing(true);
    const fresh = await load();
    if (fresh?.payment_status === "paid") setView("status");
    setRefreshing(false);
  }

  async function chooseCash() {
    const token = resolveToken();
    if (!order || !token) return;
    setCashLoading(true);
    setQrError(null);
    const error = await setPaymentMethod(order.id_order, token, "cash");
    if (error) {
      setQrError(error);
      setCashLoading(false);
      return;
    }
    await load();
    setCashLoading(false);
    setView("status");
  }

  async function chooseQris() {
    const token = resolveToken();
    if (!order || !token) return;
    if (qrUrl) {
      setView("qris");
      return;
    }

    setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetch("/api/payment/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id_order, orderToken: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat QRIS");

      const url: string = data.actions?.[0]?.url ?? null;
      if (!url) throw new Error("QR URL tidak ditemukan dari Midtrans");
      setQrUrl(url);
      await load();
      setView("qris");
    } catch (e: unknown) {
      setQrError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setQrLoading(false);
    }
  }

  if (view === "loading") {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div className="w-10 h-10 rounded-full skeleton" />
      </main>
    );
  }

  if (view === "missing" || !order) {
    return (
      <main
        className="min-h-dvh flex flex-col items-center justify-center text-center px-8"
        style={{ background: "var(--paper)" }}
      >
        <h1 className="font-display text-xl font-bold" style={{ color: "var(--navy)" }}>
          Pesanan tidak ditemukan
        </h1>
        <p className="text-sm mt-1.5 mb-6 max-w-[38ch]" style={{ color: "var(--navy-muted)" }}>
          Tautan pesanan mungkin sudah tidak berlaku, atau dibuka dari perangkat yang berbeda.
          Minta kasir membuka pesanan dengan nomor mejamu.
        </p>
        <Link
          href={`/${slug}`}
          className="btn-primary press inline-flex items-center justify-center h-12 px-6 rounded-2xl font-semibold text-sm text-white"
        >
          Kembali ke Menu
        </Link>
      </main>
    );
  }

  if (view === "choose") {
    return (
      <PaymentChoice
        order={order}
        onCash={chooseCash}
        onQris={chooseQris}
        cashLoading={cashLoading}
        qrLoading={qrLoading}
        errorMessage={qrError}
      />
    );
  }

  if (view === "qris") {
    return (
      <QrisView
        order={order}
        qrUrl={qrUrl}
        refreshing={refreshing}
        onRefresh={refreshNow}
        onBack={() => setView("choose")}
      />
    );
  }

  return <StatusView order={order} slug={slug} reviewUrl={reviewUrl} refreshing={refreshing} onRefresh={refreshNow} />;
}

/** Layar yang cocok untuk keadaan pesanan menurut server. Tidak ada jalur yang
 *  membiarkan klien menyatakan pesanan lunas sendiri. */
function viewForOrder(order: Order): View {
  if (order.payment_status === "paid") return "status";
  if (order.payment_method === "cash") return "status";
  if (order.payment_method === "qris" && order.payment_status === "pending") return "qris";
  return "choose";
}

/* ── Ringkasan pesanan di kepala layar ── */
function ConfirmBanner({ order }: { order: Order }) {
  return (
    <header
      className="relative px-5 pt-12 pb-6 text-white"
      style={{ background: "var(--navy)", borderRadius: "0 0 28px 28px" }}
    >
      <div
        className="w-12 h-12 rounded-full inline-flex items-center justify-center fade-up"
        style={{ background: "var(--orange)" }}
      >
        <Check size={26} strokeWidth={3} />
      </div>
      <h1 className="font-display text-xl font-extrabold mt-4">Pesanan Terkirim</h1>
      <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.78)" }}>
        Sudah masuk ke dapur {order.cafe_name}
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        <Chip>No. {shortOrderId(order.id_order)}</Chip>
        <Chip>Meja {order.table_number}</Chip>
      </div>
    </header>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-xs font-medium px-3 py-1 rounded-full"
      style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
    >
      {children}
    </span>
  );
}

/* ── 1. Pilihan pembayaran ── */
function PaymentChoice({
  order,
  onCash,
  onQris,
  cashLoading,
  qrLoading,
  errorMessage,
}: {
  order: Order;
  onCash: () => void;
  onQris: () => void;
  cashLoading: boolean;
  qrLoading: boolean;
  errorMessage: string | null;
}) {
  const busy = cashLoading || qrLoading;

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)" }}>
      <ConfirmBanner order={order} />

      <div className="px-4">
        <div className="card flex items-center justify-between p-4 -mt-4 relative z-10">
          <span className="text-[13px]" style={{ color: "var(--navy-muted)" }}>
            {order.items.reduce((n, i) => n + i.qty, 0)} item · Total
          </span>
          <span className="font-display text-lg font-extrabold" style={{ color: "var(--orange-ink)" }}>
            {formatRupiah(order.total)}
          </span>
        </div>

        <h2 className="font-display text-base font-bold mt-6 mb-3" style={{ color: "var(--navy)" }}>
          Pilih Metode Pembayaran
        </h2>

        <div className="space-y-3">
          <button
            onClick={onCash}
            disabled={busy}
            className="press card w-full flex items-center gap-3 p-4 text-left disabled:opacity-60"
          >
            <span
              className="w-11 h-11 rounded-full inline-flex items-center justify-center shrink-0"
              style={{ background: "var(--surface)" }}
            >
              {cashLoading ? (
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--navy)" }} />
              ) : (
                <Wallet size={20} style={{ color: "var(--navy)" }} />
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
                Bayar di Kasir
              </span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--navy-muted)" }}>
                {cashLoading ? "Menyimpan pilihan…" : "Tunjukkan nomor pesanan ke kasir, bayar tunai"}
              </span>
            </span>
            <ChevronRight size={20} style={{ color: "var(--navy-muted)" }} />
          </button>

          <button
            onClick={onQris}
            disabled={busy}
            className="press w-full flex items-center gap-3 p-4 text-left rounded-2xl disabled:opacity-60"
            style={{
              background: "var(--white)",
              border: "1.5px solid var(--orange)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <span
              className="w-11 h-11 rounded-full inline-flex items-center justify-center shrink-0"
              style={{ background: "var(--orange-blush)" }}
            >
              {qrLoading ? (
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--orange)" }} />
              ) : (
                <QrCode size={20} style={{ color: "var(--orange)" }} />
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
                Bayar dengan QRIS
              </span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--navy-muted)" }}>
                {qrLoading ? "Membuat kode QRIS…" : "Scan & bayar langsung, semua e-wallet & bank"}
              </span>
            </span>
            {!qrLoading && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="badge-3d">Cepat</span>
                <ChevronRight size={20} style={{ color: "var(--navy-muted)" }} />
              </span>
            )}
          </button>

          {errorMessage && (
            <p className="text-xs text-center px-2" style={{ color: "var(--orange-ink)" }}>
              {errorMessage}
            </p>
          )}
        </div>

        <p
          className="flex items-center justify-center gap-1.5 text-[11px] mt-5 pb-8"
          style={{ color: "var(--navy-muted)" }}
        >
          <ShieldCheck size={13} /> Pembayaran aman &amp; terenkripsi
        </p>
      </div>
    </main>
  );
}

/* ── 2. QRIS ── */
function QrisView({
  order,
  qrUrl,
  refreshing,
  onRefresh,
  onBack,
}: {
  order: Order;
  qrUrl: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
}) {
  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "120px" }}>
      <style>{`
        @keyframes qr-scan {
          0%   { top: 8px; opacity: 1; }
          48%  { top: calc(100% - 8px); opacity: 1; }
          50%  { opacity: 0; }
          52%  { top: 8px; opacity: 0; }
          54%  { opacity: 1; }
          100% { top: calc(100% - 8px); opacity: 1; }
        }
        @keyframes qr-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,111,32,0); }
          50%       { box-shadow: 0 0 24px 4px rgba(255,111,32,0.18); }
        }
        @keyframes dot-bounce {
          0%,80%,100% { transform: translateY(0); opacity: .4; }
          40%          { transform: translateY(-5px); opacity: 1; }
        }
        .qr-scan-line {
          position: absolute; left: 8px; right: 8px; height: 2px;
          background: linear-gradient(90deg, transparent, var(--orange), transparent);
          border-radius: 2px;
          animation: qr-scan 2.4s ease-in-out infinite;
          pointer-events: none;
        }
        .qr-glow { animation: qr-glow 2.4s ease-in-out infinite; }
        .dot-1 { animation: dot-bounce 1.2s ease-in-out infinite 0s; }
        .dot-2 { animation: dot-bounce 1.2s ease-in-out infinite .2s; }
        .dot-3 { animation: dot-bounce 1.2s ease-in-out infinite .4s; }
        @media (prefers-reduced-motion: reduce) {
          .qr-scan-line, .qr-glow, .dot-1, .dot-2, .dot-3 { animation: none; }
        }
      `}</style>

      <header
        className="relative px-5 pt-12 pb-8 text-center text-white"
        style={{ background: "var(--navy)", borderRadius: "0 0 32px 32px" }}
      >
        <button
          onClick={onBack}
          aria-label="Kembali ke pilihan pembayaran"
          className="press absolute left-4 top-12 w-10 h-10 inline-flex items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <ArrowLeft size={20} />
        </button>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.55)" }}>
          Total Pembayaran
        </p>
        <p className="font-display text-4xl font-extrabold mt-2">{formatRupiah(order.total)}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          <Chip>No. {shortOrderId(order.id_order)}</Chip>
          <Chip>Meja {order.table_number}</Chip>
        </div>
      </header>

      <div className="px-4 -mt-4">
        <div className="card qr-glow mx-auto p-5 fade-up" style={{ maxWidth: "300px", position: "relative" }}>
          <div className="flex items-center justify-between mb-4">
            <span className="font-extrabold text-base tracking-tight" style={{ color: "var(--navy)" }}>
              QRIS
            </span>
            <span className="text-[11px] font-medium" style={{ color: "var(--navy-muted)" }}>
              {order.cafe_name}
            </span>
          </div>

          <div className="relative rounded-xl overflow-hidden" style={{ background: "#fff", padding: "8px" }}>
            {qrUrl ? (
              <Image
                src={qrUrl}
                alt="Kode QRIS pembayaran"
                width={240}
                height={240}
                unoptimized
                className="w-full h-auto block"
              />
            ) : (
              <div className="w-full aspect-square skeleton rounded-lg" />
            )}
            {qrUrl && <div className="qr-scan-line" />}

            {[
              ["top-0 left-0", "border-t-2 border-l-2 rounded-tl-lg"],
              ["top-0 right-0", "border-t-2 border-r-2 rounded-tr-lg"],
              ["bottom-0 left-0", "border-b-2 border-l-2 rounded-bl-lg"],
              ["bottom-0 right-0", "border-b-2 border-r-2 rounded-br-lg"],
            ].map(([pos, cls], i) => (
              <span
                key={i}
                className={`absolute ${pos} ${cls} w-5 h-5 pointer-events-none`}
                style={{ borderColor: "var(--orange)" }}
              />
            ))}
          </div>

          <p className="text-[11px] text-center mt-3 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
            Scan pakai GoPay, OVO, DANA, ShopeePay, atau m-banking
          </p>

          {qrUrl && <DownloadQris qrUrl={qrUrl} orderId={order.id_order} />}
        </div>
      </div>

      <div className="text-center mt-5 px-4">
        <div
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full"
          style={{ background: "var(--orange-blush)" }}
        >
          <span className="dot-1 w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--orange)" }} />
          <span className="dot-2 w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--orange)" }} />
          <span className="dot-3 w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--orange)" }} />
          <span className="text-[13px] font-semibold ml-1" style={{ color: "var(--orange-ink)" }}>
            Menunggu pembayaran
          </span>
        </div>
        <p className="text-xs mt-2 max-w-[34ch] mx-auto" style={{ color: "var(--navy-muted)" }}>
          Layar ini memeriksa status ke server tiap beberapa detik dan berpindah sendiri begitu
          pembayaran masuk.
        </p>
      </div>

      <div
        className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          background: "var(--white)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="press w-full h-[52px] rounded-2xl font-semibold text-[15px] max-w-xl mx-auto flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ border: "1.5px solid var(--border)", color: "var(--navy-muted)" }}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : undefined} />
          {refreshing ? "Memeriksa…" : "Periksa Status Sekarang"}
        </button>
      </div>
    </main>
  );
}

/* ── 3. Status pesanan ── */
const STATUS_ORDER = ["received", "preparing", "ready"] as const;

function StatusView({
  order,
  slug,
  reviewUrl,
  refreshing,
  onRefresh,
}: {
  order: Order;
  slug: string;
  reviewUrl: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const paid = order.payment_status === "paid";
  const ready = order.status === "ready";
  const currentIndex = Math.max(
    0,
    STATUS_ORDER.indexOf(order.status as (typeof STATUS_ORDER)[number])
  );

  const steps = [
    { key: "received", label: "Pesanan Diterima", sub: timeOf(order.created_at) },
    { key: "preparing", label: "Sedang Disiapkan", sub: "Estimasi 10–15 menit" },
    { key: "ready", label: "Siap Diantar", sub: ready ? "Silakan dinikmati" : "" },
  ];

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "104px" }}>
      <header
        className="relative px-5 pt-12 pb-7 text-center text-white"
        style={{ background: "var(--navy)", borderRadius: "0 0 28px 28px" }}
      >
        <div
          className="w-16 h-16 rounded-full inline-flex items-center justify-center mx-auto fade-up"
          style={{ background: "var(--orange)" }}
        >
          <Check size={34} strokeWidth={3} />
        </div>
        <h1 className="font-display text-[22px] font-extrabold mt-4">
          {ready ? "Pesanan Siap" : paid ? "Pembayaran Berhasil" : "Pesanan Diterima"}
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.78)" }}>
          {ready
            ? "Pesananmu sudah selesai disiapkan"
            : paid
            ? "Pesananmu sedang disiapkan"
            : "Tunjukkan nomor pesanan ke kasir untuk bayar tunai"}
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Chip>{shortOrderId(order.id_order)}</Chip>
          <Chip>Meja {order.table_number}</Chip>
          <Chip>{paymentLabel(order)}</Chip>
        </div>
      </header>

      <div className="px-4 pt-5">
        {/* Status bayar diambil apa adanya dari server. Sebelumnya layar ini bisa
            menampilkan "LUNAS" hanya karena tombol lokal ditekan. */}
        {!paid && (
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "var(--orange-blush)", border: "1px solid var(--orange-tint)" }}
          >
            <Wallet size={18} className="shrink-0 mt-0.5" style={{ color: "var(--orange-ink)" }} />
            <div className="min-w-0">
              <p className="font-semibold text-sm" style={{ color: "var(--orange-ink)" }}>
                Belum lunas
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
                Kasir akan menandai pesanan ini lunas setelah pembayaran diterima. Status di layar
                mengikuti catatan kasir.
              </p>
            </div>
          </div>
        )}

        <div className={`card p-5 ${paid ? "" : "mt-3"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[15px] font-bold" style={{ color: "var(--navy)" }}>
              Status Pesanan
            </h2>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Perbarui status pesanan"
              className="press inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 disabled:opacity-60"
              style={{ background: "var(--surface)", color: "var(--navy-muted)" }}
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : undefined} />
              Perbarui
            </button>
          </div>
          <ol className="relative">
            {steps.map((s, i) => {
              const last = i === steps.length - 1;
              const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
              return (
                <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {!last && (
                    <span
                      className="absolute left-[13px] top-7 bottom-0 w-0.5"
                      style={{ background: state === "done" ? "var(--orange)" : "var(--surface)" }}
                    />
                  )}
                  <span
                    className={`relative z-10 w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 ${
                      state === "active" ? "pulse-ring" : ""
                    }`}
                    style={
                      state === "done"
                        ? { background: "var(--orange)", color: "#fff" }
                        : state === "active"
                        ? { background: "var(--white)", border: "2px solid var(--orange)" }
                        : { background: "var(--surface)" }
                    }
                  >
                    {state === "done" && <Check size={15} strokeWidth={3} />}
                    {state === "active" && (
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--orange)" }} />
                    )}
                  </span>
                  <span className="flex-1 pt-0.5">
                    <span className="flex items-center gap-2">
                      <span
                        className="font-semibold text-sm"
                        style={{ color: state === "pending" ? "var(--navy-muted)" : "var(--navy)" }}
                      >
                        {s.label}
                      </span>
                      {state === "active" && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: "var(--orange-blush)", color: "var(--orange-ink)" }}
                        >
                          Berjalan
                        </span>
                      )}
                    </span>
                    {s.sub && (
                      <span className="block text-xs mt-0.5" style={{ color: "var(--navy-muted)" }}>
                        {s.sub}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Ajakan review muncul di momen kepuasan tertinggi, bukan di halaman menu. */}
        {ready && reviewUrl && <ReviewPrompt reviewUrl={reviewUrl} cafeName={order.cafe_name} />}

        <div className="card p-4 mt-3">
          <h2 className="font-display text-sm font-bold mb-3" style={{ color: "var(--navy)" }}>
            Rincian Pesanan
          </h2>
          <div className="space-y-2.5">
            {order.items.map((it, i) => (
              <OrderLine key={`${it.id_menu}-${i}`} item={it} />
            ))}
          </div>
          <div className="w-full h-px my-3" style={{ background: "var(--border)" }} />
          <div className="flex items-center justify-between">
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>
              Total
            </span>
            <span className="font-display text-base font-extrabold" style={{ color: "var(--orange-ink)" }}>
              {formatRupiah(order.total)}
            </span>
          </div>
        </div>

        {order.notes && (
          <div className="card p-4 mt-3">
            <h2 className="font-display text-sm font-bold mb-2" style={{ color: "var(--navy)" }}>
              Catatan Tambahan
            </h2>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "var(--navy-muted)", whiteSpace: "pre-wrap" }}
            >
              {order.notes}
            </p>
          </div>
        )}
      </div>

      <div
        className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          background: "var(--white)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <Link
          href={`/${slug}`}
          className="btn-primary press w-full h-[52px] rounded-2xl font-semibold text-[15px] text-white max-w-xl mx-auto flex items-center justify-center"
        >
          Kembali ke Menu
        </Link>
      </div>
    </main>
  );
}

/** Satu baris pesanan, termasuk varian yang dipilih. Varian ditampilkan supaya
 *  pelanggan bisa memverifikasi pesanannya sebelum makanan datang. */
function OrderLine({ item }: { item: OrderItem }) {
  const options = item.options ?? [];
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <span className="min-w-0">
        <span className="block" style={{ color: "var(--navy)" }}>
          {item.qty}× {item.nama_menu}
        </span>
        {options.length > 0 && (
          <span className="block text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
            {options.map((o) => o.name).join(" · ")}
          </span>
        )}
      </span>
      <span className="font-semibold shrink-0" style={{ color: "var(--orange-ink)" }}>
        {formatRupiah(item.harga_menu * item.qty)}
      </span>
    </div>
  );
}

function ReviewPrompt({ reviewUrl, cafeName }: { reviewUrl: string; cafeName: string }) {
  return (
    <div
      className="rounded-2xl p-4 mt-3"
      style={{ background: "var(--navy)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center gap-1 mb-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={15} fill="var(--orange)" strokeWidth={0} />
        ))}
      </div>
      <p className="font-display text-[15px] font-bold text-white">Bagaimana pesananmu?</p>
      <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
        Satu ulasan singkat sangat membantu {cafeName}.
      </p>
      <a
        href={reviewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="press mt-3 h-11 rounded-xl font-semibold text-sm flex items-center justify-center"
        style={{ background: "var(--orange)", color: "#fff" }}
      >
        Tulis Ulasan di Google
      </a>
    </div>
  );
}

function DownloadQris({ qrUrl, orderId }: { qrUrl: string; orderId: string }) {
  const proxyUrl = `/api/payment/qr-proxy?url=${encodeURIComponent(qrUrl)}&orderId=${encodeURIComponent(orderId)}`;
  return (
    <a
      href={proxyUrl}
      download={`QRIS-${orderId}.png`}
      className="press mt-3 w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
      style={{ background: "var(--orange)", color: "#fff" }}
    >
      Unduh Kode QRIS
    </a>
  );
}

function paymentLabel(order: Order): string {
  if (order.payment_status === "paid") {
    return order.payment_method === "qris" ? "QRIS · Lunas" : "Tunai · Lunas";
  }
  if (order.payment_method === "qris") return "QRIS · Menunggu";
  if (order.payment_method === "cash") return "Tunai · Belum";
  return "Belum dibayar";
}

/** Nomor pesanan penuh adalah uuid; yang dibacakan ke kasir cukup ekornya. */
function shortOrderId(id: string): string {
  return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();
}

function timeOf(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
