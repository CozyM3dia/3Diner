"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import {
  Check,
  Wallet,
  QrCode,
  Download,
  RefreshCw,
  Star,
  Store,
  Smartphone,
  Copy,
} from "lucide-react";
import { chargeOnline, fetchOrder, getQrisUrl, OrderFetchError, setQrisUrl } from "@/lib/orders";
import { formatRupiah } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { Order, OrderItem } from "@/types";
import { OrderLoadState } from "@/components/order/OrderLoadState";
import { OrderTerminalState } from "@/components/order/OrderTerminalState";

type View = "qris" | "cashier" | "status";
type LoadState = "loading" | "transient-error" | "not-found" | "loaded";

/** Selang polling. Layar bayar-online menunggu webhook Midtrans, jadi diperiksa
 *  lebih sering; layar kasir & status menunggu tindakan manusia (menit). */
const POLL_PAY_MS = 4000;
const POLL_SLOW_MS = 15000;

export default function OrderView({ slug, orderId }: { slug: string; orderId: string }) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [view, setView] = useState<View>("status");
  const [qrisUrl, setQrisUrlState] = useState<string | null>(null);
  const [chargeLoading, setChargeLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [acknowledgedTotalKey, setAcknowledgedTotalKey] = useState<string | null>(null);
  const autoChargeOrderRef = useRef<string | null>(null);
  const loadedOrderRef = useRef<Order | null>(null);

  // Token boleh datang dari tautan (perangkat lain, cache terhapus) atau dari
  // cache lokal perangkat yang membuat pesanan. getStub menyentuh localStorage,
  // jadi hanya boleh dibaca setelah komponen terpasang.
  const linkToken = searchParams.get("token");
  const reviewTotal = parseReviewTotal(searchParams.get("reviewTotal"));
  const reviewTotalKey = `${orderId}:${reviewTotal}`;

  /** Capability hanya datang dari link/session state; localStorage tidak lagi
   *  menyimpan credential customer. */
  const resolveToken = useCallback(() => linkToken ?? null, [linkToken]);

  /** Satu-satunya jalan status masuk ke layar ini: dibaca dari server. */
  const load = useCallback(async (): Promise<Order | null> => {
    const token = resolveToken();
    if (!token) {
      setLoadState("not-found");
      return null;
    }

    try {
      const fetched = await fetchOrder(orderId, token);
      loadedOrderRef.current = fetched.order;
      setOrder(fetched.order);
      setReviewUrl(fetched.reviewUrl);
      setRefreshError(null);
      setLoadState("loaded");
      const serverQrisUrl = fetched.order.payment_status === "pending"
        ? fetched.order.payment_qr_url ?? getQrisUrl(orderId)
        : null;
      setQrisUrlState(serverQrisUrl);
      return fetched.order;
    } catch (error) {
      const kind = error instanceof OrderFetchError ? error.kind : "transient";
      if (kind === "transient" && loadedOrderRef.current) {
        setRefreshError("Status pesanan belum dapat diperbarui. Coba lagi.");
        return null;
      }
      setLoadState(kind === "not-found" ? "not-found" : "transient-error");
      return null;
    }
  }, [orderId, resolveToken]);

  useEffect(() => {
    let cancelled = false;
    loadedOrderRef.current = null;
    (async () => {
      const fresh = await load();
      if (cancelled) return;
      if (fresh) setView(viewForOrder(fresh));
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
    if (loadState !== "loaded" || !order || isKitchenTerminal(order)) return;

    // Tab tersembunyi tidak perlu data segar: tiap tick = 1 RPC rate-limit +
    // 1 RPC baca di Postgres. Saat kembali terlihat, refresh langsung sekali.
    const interval = view === "qris" ? POLL_PAY_MS : POLL_SLOW_MS;
    let timer: ReturnType<typeof setInterval> | null = null;
    const startTimer = () => {
      if (timer === null) {
        timer = setInterval(() => {
          void load().then((fresh) => {
            if (fresh) setView(viewForOrder(fresh));
          });
        }, interval);
      }
    };
    const stopTimer = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) stopTimer();
      else {
        void load().then((fresh) => {
          if (fresh) setView(viewForOrder(fresh));
        });
        startTimer();
      }
    };

    if (document.hidden) stopTimer();
    else startTimer();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopTimer();
    };
  }, [loadState, view, order, load]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      const fresh = await load();
      if (fresh) setView(viewForOrder(fresh));
    } finally {
      setRefreshing(false);
    }
  }

  /** Membuat satu QRIS dinamis; status tetap mengikuti webhook Midtrans. */
  const payOnline = useCallback(async () => {
    const token = resolveToken();
    if (!order || !token) return;
    if (qrisUrl && order.payment_status === "pending") {
      setView("qris");
      return;
    }
    setChargeLoading(true);
    setPayError(null);
    try {
      const url = await chargeOnline(order.id_order, token);
      setQrisUrl(order.id_order, url);
      setQrisUrlState(url);
      const fresh = await load();
      setView(fresh ? viewForOrder(fresh) : "qris");
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : "Gagal memulai pembayaran");
    } finally {
      setChargeLoading(false);
    }
  }, [load, order, qrisUrl, resolveToken]);

  const requiresTotalAcknowledgement = Boolean(
    order &&
    reviewTotal !== null &&
    reviewTotal !== order.total &&
    acknowledgedTotalKey !== reviewTotalKey &&
    (view === "qris" || view === "cashier")
  );

  // QRIS is the only online payment path, so the customer should land on the
  // QR screen immediately and see a loading state while Midtrans creates it.
  useEffect(() => {
    if (view !== "qris" || !order || order.payment_status !== "awaiting_payment" ||
        qrisUrl || chargeLoading || payError || requiresTotalAcknowledgement ||
        autoChargeOrderRef.current === order.id_order) {
      return;
    }
    autoChargeOrderRef.current = order.id_order;
    void payOnline();
  }, [chargeLoading, order, payError, payOnline, qrisUrl, requiresTotalAcknowledgement, view]);

  const retryPayment = useCallback(() => {
    if (!order) return;
    autoChargeOrderRef.current = null;
    void payOnline();
  }, [order, payOnline]);

  if (loadState !== "loaded") {
    return <OrderLoadState state={loadState} slug={slug} onRetry={refreshNow} />;
  }

  if (!order) {
    return <OrderLoadState state="transient-error" slug={slug} onRetry={refreshNow} />;
  }

  if (requiresTotalAcknowledgement) {
    return (
      <TotalChangeAcknowledgement
        approvedTotal={reviewTotal!}
        currentTotal={order.total}
        paymentLabel={view === "qris" ? "QRIS" : "kode kasir"}
        onContinue={() => setAcknowledgedTotalKey(reviewTotalKey)}
      />
    );
  }

  if (order.status === "completed" || order.status === "cancelled") {
    return <OrderTerminalState order={order} slug={slug} />;
  }

  if (view === "qris") {
    return (
      <QrisView
        order={order}
        qrisUrl={qrisUrl}
        token={resolveToken()}
        loading={chargeLoading}
        errorMessage={payError}
        refreshError={refreshError}
        refreshing={refreshing}
        onRefresh={refreshNow}
        onRetry={retryPayment}
      />
    );
  }

  if (view === "cashier") {
    return <CashierView order={order} refreshError={refreshError} refreshing={refreshing} onRefresh={refreshNow} />;
  }

  return <StatusView order={order} slug={slug} reviewUrl={reviewUrl} refreshError={refreshError} refreshing={refreshing} onRefresh={refreshNow} />;
}

function parseReviewTotal(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const total = Number(value);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

function isKitchenTerminal(order: Order): boolean {
  return order.status === "completed" || order.status === "cancelled";
}

function TotalChangeAcknowledgement({
  approvedTotal,
  currentTotal,
  paymentLabel,
  onContinue,
}: {
  approvedTotal: number;
  currentTotal: number;
  paymentLabel: string;
  onContinue: () => void;
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4" style={{ background: "var(--paper)" }}>
      <section className="w-full max-w-md rounded-2xl p-6" aria-labelledby="total-change-heading" style={{ background: "var(--white)", boxShadow: "var(--shadow-sm)" }}>
        <h1 id="total-change-heading" className="font-display text-xl font-bold" style={{ color: "var(--navy)" }}>
          Total pesanan berubah
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--navy-muted)" }}>
          Total yang kamu setujui berbeda dari total pesanan saat ini. Periksa sebelum melanjutkan.
        </p>
        <dl className="mt-5 space-y-3 rounded-xl p-4" style={{ background: "var(--surface)" }}>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm" style={{ color: "var(--navy-muted)" }}>Total disetujui</dt>
            <dd className="font-semibold" style={{ color: "var(--navy)" }}>{formatRupiah(approvedTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm" style={{ color: "var(--navy-muted)" }}>Total saat ini</dt>
            <dd className="font-display text-lg font-extrabold" style={{ color: "var(--orange-ink)" }}>{formatRupiah(currentTotal)}</dd>
          </div>
        </dl>
        <button type="button" onClick={onContinue} className="btn-primary press mt-6 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white">
          Lanjutkan ke {paymentLabel}
        </button>
      </section>
    </main>
  );
}

/** Layar yang cocok untuk keadaan pesanan menurut server. Tidak ada jalur yang
 *  membiarkan klien menyatakan pesanan lunas sendiri. Jalur dipilih di keranjang
 *  saat pesanan dibuat, jadi di sini tinggal memetakan keadaan server. */
function viewForOrder(order: Order): View {
  if (order.payment_status === "paid") return "status";
  // Begitu dapur menerima pesanan (check-in kasir / webhook), QR tak berguna lagi.
  if (order.status !== "awaiting") return "status";
  if (order.payment_status === "awaiting_checkin") return "cashier";
  if (order.payment_status === "pending" || order.payment_status === "awaiting_payment") return "qris";
  return "status";
}

/* ── Ringkasan pesanan di kepala layar ── */
/*
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

*/
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

/* ── 1. Mulai pembayaran QRIS ── */
/*
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
        title="Pesanan Dibuat"
        subtitle={`Selesaikan pembayaran untuk mulai diproses ${order.cafe_name}`}
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
              Satu QRIS untuk berbagai aplikasi pembayaran
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
              Ketuk tombol di bawah untuk menampilkan QR. Scan dengan aplikasi
              pembayaran yang mendukung QRIS, lalu tunggu konfirmasi otomatis.
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
          {loading ? "Menyiapkan QRIS…" : "Tampilkan QRIS"}
        </button>
      </div>
    </main>
  );
}

/* ── 2. Bayar di kasir (QR + kode check-in) ── */
function QrisView({
  order,
  qrisUrl,
  token,
  loading,
  errorMessage,
  refreshError,
  refreshing,
  onRefresh,
  onRetry,
}: {
  order: Order;
  qrisUrl: string | null;
  token: string | null;
  loading: boolean;
  errorMessage: string | null;
  refreshError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
}) {
  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "120px" }}>
      <header
        className="relative px-5 pt-12 pb-8 text-center text-white"
        style={{ background: "var(--navy)", borderRadius: "0 0 32px 32px" }}
      >
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.55)" }}>
          Total Pembayaran
        </p>
        <p className="font-display text-4xl font-extrabold mt-2">{formatRupiah(order.total)}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          <Chip>No. {shortOrderId(order.id_order)}</Chip>
          <Chip>Meja {order.table_number}</Chip>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 -mt-4">
        {refreshError && (
          <p role="status" className="mt-5 rounded-xl p-3 text-center text-xs" style={{ background: "var(--orange-blush)", color: "var(--orange-ink)" }}>
            {refreshError}
          </p>
        )}
        <div className="card p-5 fade-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className="w-9 h-9 rounded-xl inline-flex items-center justify-center"
                style={{ background: "var(--orange-blush)" }}
              >
                <QrCode size={20} style={{ color: "var(--orange)" }} />
              </span>
              <span className="font-extrabold text-base tracking-tight" style={{ color: "var(--navy)" }}>
                Bayar dengan QRIS
              </span>
            </div>
            <span className="text-[11px] font-medium" style={{ color: "var(--navy-muted)" }}>
              {order.cafe_name}
            </span>
          </div>

          <div
            className="relative rounded-2xl overflow-hidden mx-auto"
            style={{ background: "#fff", padding: "10px", maxWidth: "280px" }}
          >
            {qrisUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrisUrl}
                alt="Kode QRIS pembayaran"
                width={260}
                height={260}
                className="w-full h-auto block"
              />
            ) : (
              <div className="w-full aspect-square skeleton rounded-lg" />
            )}
          </div>

          {loading ? (
            <p className="text-[12px] text-center mt-4 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
              Menyiapkan QRIS untuk pembayaranmu…
            </p>
          ) : errorMessage ? (
            <div className="mt-4 text-center">
              <p role="alert" className="text-[12px] leading-relaxed" style={{ color: "var(--orange-ink)" }}>
                {errorMessage}
              </p>
              <button
                onClick={onRetry}
                className="btn-primary press mt-3 h-11 px-5 rounded-xl text-sm font-semibold text-white"
              >
                Coba Lagi
              </button>
            </div>
          ) : null}

          {qrisUrl && <DownloadQris orderId={order.id_order} token={token} />}
        </div>

        <div
          className="rounded-2xl p-4 mt-3 flex items-start gap-3"
          style={{ background: "var(--orange-blush)", border: "1px solid var(--orange-tint)" }}
        >
          <Smartphone size={18} className="shrink-0 mt-0.5" style={{ color: "var(--orange-ink)" }} />
          <div className="min-w-0">
            <p className="font-semibold text-sm" style={{ color: "var(--orange-ink)" }}>
              {loading ? "Menyiapkan pembayaran" : errorMessage ? "QRIS belum siap" : "Menunggu pembayaran"}
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--navy-muted)" }}>
              {loading
                ? "QR akan muncul otomatis sebentar lagi."
                : errorMessage
                ? "Periksa koneksi lalu coba buat QRIS lagi."
                : "Setelah pembayaran berhasil, status pesanan akan berubah otomatis. Jangan tutup layar ini sebelum pembayaran selesai."}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <OrderSummaryCard order={order} />
        </div>
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

function DownloadQris({ orderId, token }: { orderId: string; token: string | null }) {
  if (!token) return null;
  const proxyUrl = `/api/payment/qr-proxy?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`;
  return (
    <a
      href={proxyUrl}
      download={`QRIS-${orderId}.png`}
      className="press mt-4 w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
      style={{ background: "var(--orange)", color: "#fff" }}
    >
      <Download size={16} />
      Unduh QRIS
    </a>
  );
}

function CashierView({
  order,
  refreshError,
  refreshing,
  onRefresh,
}: {
  order: Order;
  refreshError: string | null;
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
        {refreshError && (
          <p role="status" className="mt-5 rounded-xl p-3 text-center text-xs" style={{ background: "var(--orange-blush)", color: "var(--orange-ink)" }}>
            {refreshError}
          </p>
        )}
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
            className="press inline-flex h-11 items-center gap-1.5 mt-3 px-4 rounded-full text-xs font-semibold disabled:opacity-50"
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
  refreshError,
  refreshing,
  onRefresh,
}: {
  order: Order;
  slug: string;
  reviewUrl: string | null;
  refreshError: string | null;
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
        {refreshError && (
          <p role="status" className="mb-3 rounded-xl p-3 text-center text-xs" style={{ background: "var(--orange-blush)", color: "var(--orange-ink)" }}>
            {refreshError}
          </p>
        )}
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
              className="press inline-flex h-11 w-11 items-center justify-center rounded-full text-xs font-medium disabled:opacity-60"
              style={{ background: "var(--surface)", color: "var(--navy-muted)" }}
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : undefined} />
              <span className="sr-only">Perbarui</span>
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
