"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import {
  Check,
  Wallet,
  ShieldCheck,
  RefreshCw,
  Star,
  Loader2,
  Store,
  Smartphone,
  Copy,
} from "lucide-react";
import { chargeOnline, fetchOrder, getStub, startSnapPayment } from "@/lib/orders";
import { formatRupiah } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { Order, OrderItem } from "@/types";

type View = "loading" | "missing" | "pay" | "cashier" | "status";

/** Selang polling. Layar bayar-online menunggu webhook Midtrans, jadi diperiksa
 *  lebih sering; layar kasir & status menunggu tindakan manusia (menit). */
const POLL_PAY_MS = 4000;
const POLL_SLOW_MS = 15000;

export default function OrderView({ slug, orderId }: { slug: string; orderId: string }) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [view, setView] = useState<View>("loading");
  const [chargeLoading, setChargeLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
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
  // Server tetap sumber kebenaran — tiap putaran menurunkan layar dari keadaan
  // pesanan, jadi webhook (lunas) atau check-in kasir memindahkan tampilan sendiri.
  useEffect(() => {
    if (view === "loading" || view === "missing") return;
    if (order?.status === "ready" && order?.payment_status === "paid") return;

    const interval = view === "pay" ? POLL_PAY_MS : POLL_SLOW_MS;
    const timer = setInterval(() => {
      void load().then((fresh) => {
        if (fresh) setView(viewForOrder(fresh));
      });
    }, interval);

    return () => clearInterval(timer);
  }, [view, order?.status, order?.payment_status, load]);

  async function refreshNow() {
    setRefreshing(true);
    const fresh = await load();
    if (fresh) setView(viewForOrder(fresh));
    setRefreshing(false);
  }

  /** Bayar online: minta token Snap lalu buka popup Midtrans. Poller yang
   *  menaikkan layar ke status begitu webhook menandai lunas — callback sukses
   *  hanya mempercepat perpindahan optimistis. */
  async function payOnline() {
    const token = resolveToken();
    if (!order || !token) return;
    setChargeLoading(true);
    setPayError(null);
    try {
      const snapToken = await chargeOnline(order.id_order, token);
      startSnapPayment(snapToken, {
        onSuccess: () => {
          void load().then((fresh) => fresh && setView(viewForOrder(fresh)));
        },
        onPending: () => {
          void load().then((fresh) => fresh && setView(viewForOrder(fresh)));
        },
        onError: () => setPayError("Pembayaran gagal diproses. Coba lagi."),
        onClose: () => {
          void load();
        },
      });
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : "Gagal memulai pembayaran");
    } finally {
      setChargeLoading(false);
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

  if (view === "pay") {
    return (
      <OnlinePayView
        order={order}
        loading={chargeLoading}
        errorMessage={payError}
        onPay={payOnline}
      />
    );
  }

  if (view === "cashier") {
    return <CashierView order={order} refreshing={refreshing} onRefresh={refreshNow} />;
  }

  return <StatusView order={order} slug={slug} reviewUrl={reviewUrl} refreshing={refreshing} onRefresh={refreshNow} />;
}

/** Layar yang cocok untuk keadaan pesanan menurut server. Tidak ada jalur yang
 *  membiarkan klien menyatakan pesanan lunas sendiri. Jalur dipilih di keranjang
 *  saat pesanan dibuat, jadi di sini tinggal memetakan keadaan server. */
function viewForOrder(order: Order): View {
  if (order.payment_status === "paid") return "status";
  // Begitu dapur menerima pesanan (check-in kasir / webhook), QR tak berguna lagi.
  if (order.status !== "awaiting") return "status";
  if (order.payment_status === "awaiting_checkin") return "cashier";
  return "pay";
}

/* ── Ringkasan pesanan di kepala layar ── */
function ConfirmBanner({
  order,
  title,
  subtitle,
}: {
  order: Order;
  title: string;
  subtitle: string;
}) {
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
      <h1 className="font-display text-xl font-extrabold mt-4">{title}</h1>
      <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.78)" }}>
        {subtitle}
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

/** Ringkasan item + total dipakai bersama oleh layar bayar-online dan kasir. */
function OrderSummaryCard({ order }: { order: Order }) {
  return (
    <div className="card p-4">
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
  );
}

/* ── 1. Bayar online (popup Snap) ── */
function OnlinePayView({
  order,
  loading,
  errorMessage,
  onPay,
}: {
  order: Order;
  loading: boolean;
  errorMessage: string | null;
  onPay: () => void;
}) {
  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "120px" }}>
      <ConfirmBanner
        order={order}
        title="Pesanan Terkirim"
        subtitle={`Sudah masuk ke dapur ${order.cafe_name}`}
      />

      <div className="mx-auto max-w-xl px-4">
        <div className="card flex items-center justify-between p-4 -mt-4 relative z-10">
          <span className="text-[13px]" style={{ color: "var(--navy-muted)" }}>
            {order.items.reduce((n, i) => n + i.qty, 0)} item · Total
          </span>
          <span className="font-display text-lg font-extrabold" style={{ color: "var(--orange-ink)" }}>
            {formatRupiah(order.total)}
          </span>
        </div>

        <div
          className="rounded-2xl p-4 mt-4 flex items-start gap-3"
          style={{ background: "var(--orange-blush)", border: "1px solid var(--orange-tint)" }}
        >
          <span
            className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0"
            style={{ background: "var(--white)" }}
          >
            <Smartphone size={19} style={{ color: "var(--orange)" }} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm" style={{ color: "var(--navy)" }}>
              Bayar dengan QRIS, e-wallet, atau bank
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
              Ketuk tombol di bawah untuk membuka pembayaran. Layar ini berpindah
              sendiri begitu pembayaranmu diterima.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <OrderSummaryCard order={order} />
        </div>

        {order.notes && (
          <div className="card p-4 mt-3">
            <h2 className="font-display text-sm font-bold mb-2" style={{ color: "var(--navy)" }}>
              Catatan Tambahan
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--navy-muted)", whiteSpace: "pre-wrap" }}>
              {order.notes}
            </p>
          </div>
        )}

        <p
          className="flex items-center justify-center gap-1.5 text-[11px] mt-5"
          style={{ color: "var(--navy-muted)" }}
        >
          <ShieldCheck size={13} /> Pembayaran aman &amp; terenkripsi oleh Midtrans
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
        {errorMessage && (
          <p
            role="alert"
            className="max-w-xl mx-auto mb-2.5 text-xs text-center px-2"
            style={{ color: "var(--orange-ink)" }}
          >
            {errorMessage}
          </p>
        )}
        <button
          onClick={onPay}
          disabled={loading}
          className="btn-primary press w-full h-[52px] rounded-2xl font-semibold text-[15px] text-white max-w-xl mx-auto flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
          {loading ? "Membuka pembayaran…" : "Bayar Sekarang"}
        </button>
      </div>
    </main>
  );
}

/* ── 2. Bayar di kasir (QR + kode check-in) ── */
function CashierView({
  order,
  refreshing,
  onRefresh,
}: {
  order: Order;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const code = order.checkin_code ?? null;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // QR di-encode di klien dari payload minimal {o,c}. Kasir memindainya untuk
  // membuka pesanan; kode 8 karakter adalah cadangan bila kamera bermasalah.
  useEffect(() => {
    if (!code) return;
    let active = true;
    const payload = JSON.stringify({ o: order.id_order, c: code });
    QRCode.toDataURL(payload, {
      margin: 1,
      width: 480,
      errorCorrectionLevel: "M",
      color: { dark: "#022C60", light: "#FDFDFD" },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [order.id_order, code]);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard tidak tersedia — kode tetap terbaca di layar */
    }
  }

  const codeDisplay = code ? `${code.slice(0, 4)} ${code.slice(4)}` : "————————";

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "104px" }}>
      <header
        className="relative px-5 pt-12 pb-8 text-center text-white"
        style={{ background: "var(--navy)", borderRadius: "0 0 32px 32px" }}
      >
        <div
          className="w-14 h-14 rounded-full inline-flex items-center justify-center mx-auto fade-up"
          style={{ background: "var(--orange)" }}
        >
          <Store size={28} strokeWidth={2.4} />
        </div>
        <h1 className="font-display text-xl font-extrabold mt-4">Bayar di Kasir</h1>
        <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.78)" }}>
          Tunjukkan QR atau kode ini ke kasir {order.cafe_name}
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Chip>No. {shortOrderId(order.id_order)}</Chip>
          <Chip>Meja {order.table_number}</Chip>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 -mt-4">
        {/* Kartu QR + kode: kanal utama pesanan ini, jadi diberi bobot visual paling besar. */}
        <div className="card p-5 fade-up text-center">
          <div
            className="mx-auto rounded-2xl inline-flex items-center justify-center"
            style={{ background: "var(--white)", padding: "12px", boxShadow: "var(--shadow-sm)" }}
          >
            {code && qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Kode QR check-in pesanan"
                width={220}
                height={220}
                className="block rounded-lg"
                style={{ width: "220px", height: "220px" }}
              />
            ) : (
              <div className="skeleton rounded-lg" style={{ width: "220px", height: "220px" }} />
            )}
          </div>

          <p
            className="text-[11px] font-semibold uppercase tracking-widest mt-5"
            style={{ color: "var(--navy-muted)" }}
          >
            Kode Check-in
          </p>
          <p
            className="font-display font-extrabold mt-1 tabular-nums"
            style={{ color: "var(--navy)", fontSize: "34px", letterSpacing: "0.14em" }}
          >
            {codeDisplay}
          </p>

          <button
            onClick={copyCode}
            disabled={!code}
            className="press inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-50"
            style={{ background: "var(--surface)", color: "var(--navy)" }}
          >
            {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
            {copied ? "Tersalin" : "Salin kode"}
          </button>
        </div>

        {/* Ajakan tindakan yang jelas — inti dari alur bayar-di-kasir. */}
        <div
          className="rounded-2xl p-4 mt-3 flex items-start gap-3"
          style={{ background: "var(--orange-blush)", border: "1px solid var(--orange-tint)" }}
        >
          <Store size={18} className="shrink-0 mt-0.5" style={{ color: "var(--orange-ink)" }} />
          <div className="min-w-0">
            <p className="font-semibold text-sm" style={{ color: "var(--orange-ink)" }}>
              Tunjukkan QR atau kode ini ke kasir
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
              Pesanan mulai disiapkan setelah kasir memindai QR atau memasukkan kode.
              Layar ini berpindah sendiri saat itu terjadi.
            </p>
          </div>
        </div>

        <div className="mt-3">
          <OrderSummaryCard order={order} />
        </div>

        {order.notes && (
          <div className="card p-4 mt-3">
            <h2 className="font-display text-sm font-bold mb-2" style={{ color: "var(--navy)" }}>
              Catatan Tambahan
            </h2>
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
    // Tanpa estimasi menit karangan — prep_time hidup per menu dan tidak
    // dikembalikan RPC pesanan; angka pasti yang salah lebih buruk daripada
    // tidak ada angka.
    { key: "preparing", label: "Sedang Disiapkan", sub: "" },
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

      <div className="mx-auto max-w-xl px-4 pt-5">
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

        <div className="mt-3">
          <OrderSummaryCard order={order} />
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

function paymentLabel(order: Order): string {
  const method = order.payment_method ? paymentMethodLabel(order.payment_method) : "Online";
  if (order.payment_status === "paid") {
    return `${method} · Lunas`;
  }
  if (order.payment_method === "cash") return "Tunai · Belum";
  return `${method} · Menunggu`;
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
