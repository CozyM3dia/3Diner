"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  Wallet,
  QrCode,
  ChevronRight,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Bell,
  Loader2,
} from "lucide-react";
import { getOrder, updateOrder } from "@/lib/orders";
import { formatRupiah } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/types";

type View = "loading" | "missing" | "choose" | "qris" | "status";

export default function OrderView({ slug, orderId }: { slug: string; orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [view, setView] = useState<View>("loading");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const o = getOrder(orderId);
    if (!o) {
      setView("missing");
      return;
    }
    setOrder(o);
    if (o.payment_status === "paid" || o.payment_method === "cash") setView("status");
    else if (o.payment_method === "qris" && o.payment_status === "pending") setView("qris");
    else setView("choose");
  }, [orderId]);

  // Supabase Realtime: watch for payment_status=paid while on QRIS screen
  useEffect(() => {
    if (view !== "qris") {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
        realtimeRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`order-pay-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Orders", filter: `id_order=eq.${orderId}` },
        (payload) => {
          const updated = payload.new as Order;
          if (updated.payment_status === "paid") {
            updateOrder(orderId, { payment_status: "paid", status: "preparing" });
            setOrder((prev) => (prev ? { ...prev, payment_status: "paid", status: "preparing" } : prev));
            setView("status");
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      realtimeRef.current = null;
    };
  }, [view, orderId]);

  function chooseCash() {
    const next = updateOrder(orderId, { payment_method: "cash", payment_status: "pending", status: "preparing" });
    if (next) setOrder(next);
    setView("status");
  }

  async function chooseQris() {
    if (!order) return;
    // Already charged — just show the screen
    if (qrUrl) { setView("qris"); return; }

    setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetch("/api/payment/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id_order, orderToken: order.customer_token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat QRIS");
      // Midtrans QRIS returns actions[0].url for QR image
      const url: string = data.actions?.[0]?.url ?? null;
      if (!url) throw new Error("QR URL tidak ditemukan dari Midtrans");
      setQrUrl(url);
      const next = updateOrder(orderId, { payment_method: "qris", payment_status: "pending" });
      if (next) setOrder(next);
      setView("qris");
    } catch (e: unknown) {
      setQrError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setQrLoading(false);
    }
  }

  function confirmQrisPaid() {
    const next = updateOrder(orderId, { payment_status: "paid", status: "preparing" });
    if (next) setOrder(next);
    setView("status");
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
      <main className="min-h-dvh flex flex-col items-center justify-center text-center px-8" style={{ background: "var(--paper)" }}>
        <h1 className="font-display text-xl font-bold" style={{ color: "var(--navy)" }}>
          Pesanan tidak ditemukan
        </h1>
        <p className="text-sm mt-1.5 mb-6" style={{ color: "var(--navy-muted)" }}>
          Tautan pesanan mungkin sudah tidak berlaku.
        </p>
        <Link href={`/${slug}`} className="btn-primary press inline-flex items-center justify-center h-12 px-6 rounded-2xl font-semibold text-sm text-white">
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
        qrLoading={qrLoading}
        qrError={qrError}
      />
    );
  }
  if (view === "qris") return <QrisView order={order} qrUrl={qrUrl} onPaid={confirmQrisPaid} onBack={() => setView("choose")} />;
  return <StatusView order={order} slug={slug} />;
}

/* ── Order confirmation banner (shared top) ── */
function ConfirmBanner({ order }: { order: Order }) {
  return (
    <header className="relative px-5 pt-12 pb-6 text-white" style={{ background: "var(--navy)", borderRadius: "0 0 28px 28px" }}>
      <div className="w-12 h-12 rounded-full inline-flex items-center justify-center fade-up" style={{ background: "var(--orange)" }}>
        <Check size={26} strokeWidth={3} />
      </div>
      <h1 className="font-display text-xl font-extrabold mt-4">Pesanan Terkirim!</h1>
      <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.78)" }}>
        Pesananmu sudah masuk ke dapur {order.cafe_name}
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        <Chip>No. {order.id_order}</Chip>
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

/* ── 1. Payment choice ── */
function PaymentChoice({
  order,
  onCash,
  onQris,
  qrLoading,
  qrError,
}: {
  order: Order;
  onCash: () => void;
  onQris: () => void;
  qrLoading: boolean;
  qrError: string | null;
}) {
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
            className="press card w-full flex items-center gap-3 p-4 text-left"
          >
            <span className="w-11 h-11 rounded-full inline-flex items-center justify-center shrink-0" style={{ background: "var(--surface)" }}>
              <Wallet size={20} style={{ color: "var(--navy)" }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[15px]" style={{ color: "var(--navy)" }}>Bayar di Kasir</span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--navy-muted)" }}>
                Tunjukkan kode pesanan ke kasir, bayar tunai
              </span>
            </span>
            <ChevronRight size={20} style={{ color: "var(--navy-muted)" }} />
          </button>

          <button
            onClick={onQris}
            disabled={qrLoading}
            className="press w-full flex items-center gap-3 p-4 text-left rounded-2xl disabled:opacity-60"
            style={{ background: "var(--white)", border: "1.5px solid var(--orange)", boxShadow: "var(--shadow-md)" }}
          >
            <span className="w-11 h-11 rounded-full inline-flex items-center justify-center shrink-0" style={{ background: "var(--orange-blush)" }}>
              {qrLoading ? (
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--orange)" }} />
              ) : (
                <QrCode size={20} style={{ color: "var(--orange)" }} />
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[15px]" style={{ color: "var(--navy)" }}>Bayar dengan QRIS</span>
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

          {qrError && (
            <p className="text-xs text-center px-2" style={{ color: "var(--orange-ink)" }}>
              {qrError}
            </p>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[11px] mt-5 pb-8" style={{ color: "var(--navy-muted)" }}>
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
  onPaid,
  onBack,
}: {
  order: Order;
  qrUrl: string | null;
  onPaid: () => void;
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
      `}</style>

      {/* Header */}
      <header
        className="relative px-5 pt-12 pb-8 text-center text-white"
        style={{ background: "var(--navy)", borderRadius: "0 0 32px 32px" }}
      >
        <button
          onClick={onBack}
          aria-label="Kembali"
          className="press absolute left-4 top-12 w-10 h-10 inline-flex items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <ArrowLeft size={20} />
        </button>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.55)" }}>
          Total Pembayaran
        </p>
        <p className="font-display text-4xl font-extrabold mt-2">
          {formatRupiah(order.total)}
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          <Chip>No. {order.id_order}</Chip>
          <Chip>Meja {order.table_number}</Chip>
        </div>
      </header>

      {/* QR Card */}
      <div className="px-4 -mt-4">
        <div
          className="card qr-glow mx-auto p-5 fade-up"
          style={{ maxWidth: "300px", position: "relative" }}
        >
          {/* QRIS header */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-extrabold text-base tracking-tight" style={{ color: "var(--navy)" }}>QRIS</span>
            <span className="text-[11px] font-medium" style={{ color: "var(--navy-muted)" }}>{order.cafe_name}</span>
          </div>

          {/* QR image with scan animation */}
          <div className="relative rounded-xl overflow-hidden" style={{ background: "#fff", padding: "8px" }}>
            {qrUrl ? (
              <Image src={qrUrl} alt="Kode QRIS pembayaran" width={240} height={240} className="w-full h-auto block" />
            ) : (
              <div className="w-full aspect-square skeleton rounded-lg" />
            )}
            {qrUrl && <div className="qr-scan-line" />}

            {/* Corner brackets */}
            {[["top-0 left-0","border-t-2 border-l-2 rounded-tl-lg"],
              ["top-0 right-0","border-t-2 border-r-2 rounded-tr-lg"],
              ["bottom-0 left-0","border-b-2 border-l-2 rounded-bl-lg"],
              ["bottom-0 right-0","border-b-2 border-r-2 rounded-br-lg"],
            ].map(([pos, cls], i) => (
              <span key={i} className={`absolute ${pos} ${cls} w-5 h-5 pointer-events-none`}
                style={{ borderColor: "var(--orange)" }} />
            ))}
          </div>

          <p className="text-[11px] text-center mt-3 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
            Scan pakai GoPay, OVO, DANA, ShopeePay, atau m-banking
          </p>

          {qrUrl && <DownloadQris qrUrl={qrUrl} orderId={order.id_order} />}
        </div>
      </div>

      {/* Waiting indicator */}
      <div className="text-center mt-5 px-4">
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full"
          style={{ background: "var(--orange-blush)" }}>
          <span className="dot-1 w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--orange)" }} />
          <span className="dot-2 w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--orange)" }} />
          <span className="dot-3 w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--orange)" }} />
          <span className="text-[13px] font-semibold ml-1" style={{ color: "var(--orange-ink)" }}>
            Menunggu pembayaran…
          </span>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--navy-muted)" }}>
          Layar otomatis update setelah transaksi berhasil
        </p>
      </div>

      {/* Bottom bar */}
      <div
        className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          background: "var(--white)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          onClick={onPaid}
          className="press w-full h-[52px] rounded-2xl font-semibold text-[15px] max-w-xl mx-auto flex items-center justify-center gap-2"
          style={{ border: "1.5px solid var(--border)", color: "var(--navy-muted)" }}
        >
          <Clock size={16} /> Sudah Bayar? Cek Status Manual
        </button>
      </div>
    </main>
  );
}

/* ── 3. Status timeline ── */
function StatusView({ order, slug }: { order: Order; slug: string }) {
  const paid = order.payment_status === "paid";
  const steps = [
    { key: "received", label: "Pesanan Diterima", sub: timeOf(order.created_at), state: "done" as const },
    { key: "preparing", label: "Sedang Disiapkan", sub: "Estimasi 10–15 menit", state: "active" as const },
    { key: "ready", label: "Siap Diantar", sub: "", state: "pending" as const },
  ];

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "104px" }}>
      <header className="relative px-5 pt-12 pb-7 text-center text-white" style={{ background: "var(--navy)", borderRadius: "0 0 28px 28px" }}>
        <div className="w-16 h-16 rounded-full inline-flex items-center justify-center mx-auto fade-up" style={{ background: "var(--orange)" }}>
          <Check size={34} strokeWidth={3} />
        </div>
        <h1 className="font-display text-[22px] font-extrabold mt-4">
          {paid ? "Pembayaran Berhasil" : "Pesanan Diterima"}
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.78)" }}>
          {paid ? "Pesananmu sedang disiapkan" : "Tunjukkan kode ke kasir untuk bayar tunai"}
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Chip>{order.id_order}</Chip>
          <Chip>Meja {order.table_number}</Chip>
          <Chip>{order.payment_method === "qris" ? "QRIS" : "Tunai"}</Chip>
        </div>
      </header>

      <div className="px-4 pt-5">
        {/* Timeline */}
        <div className="card p-5">
          <h2 className="font-display text-[15px] font-bold mb-4" style={{ color: "var(--navy)" }}>Status Pesanan</h2>
          <ol className="relative">
            {steps.map((s, i) => {
              const last = i === steps.length - 1;
              return (
                <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {!last && (
                    <span
                      className="absolute left-[13px] top-7 bottom-0 w-0.5"
                      style={{ background: s.state === "done" ? "var(--orange)" : "var(--surface)" }}
                    />
                  )}
                  <span
                    className={`relative z-10 w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 ${s.state === "active" ? "pulse-ring" : ""}`}
                    style={
                      s.state === "done"
                        ? { background: "var(--orange)", color: "#fff" }
                        : s.state === "active"
                        ? { background: "var(--white)", border: "2px solid var(--orange)" }
                        : { background: "var(--surface)" }
                    }
                  >
                    {s.state === "done" && <Check size={15} strokeWidth={3} />}
                    {s.state === "active" && <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--orange)" }} />}
                  </span>
                  <span className="flex-1 pt-0.5">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: s.state === "pending" ? "var(--navy-muted)" : "var(--navy)" }}>
                        {s.label}
                      </span>
                      {s.state === "active" && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--orange-blush)", color: "var(--orange-ink)" }}>
                          Berjalan
                        </span>
                      )}
                    </span>
                    {s.sub && <span className="block text-xs mt-0.5" style={{ color: "var(--navy-muted)" }}>{s.sub}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Recap */}
        <div className="card p-4 mt-3">
          <h2 className="font-display text-sm font-bold mb-3" style={{ color: "var(--navy)" }}>Rincian Pesanan</h2>
          <div className="space-y-2">
            {order.items.map((it) => (
              <div key={it.id_menu} className="flex items-center justify-between text-[13px]">
                <span style={{ color: "var(--navy)" }}>
                  {it.qty}× {it.nama_menu}
                </span>
                <span className="font-semibold" style={{ color: "var(--orange-ink)" }}>
                  {formatRupiah(it.harga_menu * it.qty)}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full h-px my-3" style={{ background: "var(--border)" }} />
          <div className="flex items-center justify-between">
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>Total</span>
            <span className="font-display text-base font-extrabold" style={{ color: "var(--orange-ink)" }}>
              {formatRupiah(order.total)}
            </span>
          </div>
        </div>

        {/* Catatan Tambahan */}
        {order.notes && (
          <div className="card p-4 mt-3">
            <h2 className="font-display text-sm font-bold mb-2" style={{ color: "var(--navy)" }}>Catatan Tambahan</h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--navy-muted)", whiteSpace: "pre-wrap" }}>
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
        <p className="flex items-center justify-center gap-1.5 text-xs mt-2.5" style={{ color: "var(--navy-muted)" }}>
          <Bell size={13} /> Butuh bantuan? Panggil staff
        </p>
      </div>
    </main>
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
      ⬇ Unduh Kode QRIS
    </a>
  );
}

function timeOf(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
