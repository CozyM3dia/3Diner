"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Box,
  Check,
  LoaderCircle,
  Minus,
  Plus,
  Plus as PlusIcon,
  ShoppingBag,
  Smartphone,
  Store,
  WifiOff,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { createOrder } from "@/lib/orders";
import { formatRupiah } from "@/lib/format";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { Cafe } from "@/types";

type CheckoutStep = "review" | "payment";

export default function CartView({ cafe, slug }: { cafe: Cafe; slug: string }) {
  const { items, count, total, table, notes, setQty, setTable, setNotes, clear } = useCart();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [touched, setTouched] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [channel, setChannel] = useState<"online" | "cashier">("online");
  const [step, setStep] = useState<CheckoutStep>("review");
  const orderErrorRef = useRef<HTMLDivElement>(null);
  const tableValid = table.trim().length > 0;

  function continueToPayment() {
    if (!tableValid) {
      setTouched(true);
      requestAnimationFrame(() => document.getElementById("meja")?.focus());
      return;
    }
    setStep("payment");
  }

  async function submit() {
    if (!tableValid) {
      setTouched(true);
      return;
    }
    setOrderError(null);
    setIsSubmitting(true);
    try {
      const order = await createOrder({
        cafeId: cafe.id_cafe,
        cafeSlug: slug,
        cafeName: cafe.nama_cafe,
        table: table.trim(),
        items,
        notes: notes.trim(),
        paymentChannel: channel,
      });
      clear();
      // Token ikut di URL supaya tautan status bisa dibuka ulang atau dibagikan
      // ke teman semeja tanpa bergantung pada localStorage perangkat ini.
      router.push(
        `/${slug}/pesanan/${order.id_order}?token=${encodeURIComponent(order.customer_token ?? "")}`
      );
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Gagal membuat pesanan. Silakan coba lagi.");
      requestAnimationFrame(() => orderErrorRef.current?.focus());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: count > 0 ? "176px" : "0" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
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
          Selesaikan pesanan
        </h1>
        {count > 0 && (
          <span className="text-xs font-medium" style={{ color: "var(--navy-muted)" }}>
            {count} item
          </span>
        )}
      </header>

      {count > 0 && (
        <nav aria-label="Tahap checkout" className="checkout-progress mx-auto w-full max-w-xl px-4 pt-4">
          <ol className="checkout-progress-list">
            {["Review", "Bayar", "Selesai"].map((label, index) => {
              const active = step === "review" ? index === 0 : index === 1;
              const complete = step === "payment" && index === 0;
              return (
                <li
                  key={label}
                  aria-current={active ? "step" : undefined}
                  className={`checkout-progress-step${active ? " is-active" : ""}${complete ? " is-complete" : ""}`}
                >
                  <span className="checkout-progress-marker" aria-hidden="true">
                    {complete ? <Check size={15} strokeWidth={3} /> : index + 1}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

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
        <div className="mx-auto w-full max-w-xl px-4 pt-4">
          {step === "review" ? (
            <>
          <div className="mb-5">
            <p className="checkout-kicker">Langkah 1 dari 2</p>
            <h2 id="review-heading" className="font-display text-xl font-bold" style={{ color: "var(--navy)" }}>
              Review pesanan
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--navy-muted)" }}>
              Periksa jumlah, meja, dan catatan sebelum memilih pembayaran.
            </p>
          </div>
          {/* Items */}
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.line_key} className="checkout-item card flex items-center gap-3 p-3.5 fade-up">
                <div className="relative w-[76px] h-[76px] rounded-2xl overflow-hidden shrink-0">
                  {it.image_url ? (
                    <Image src={it.image_url} alt={it.nama_menu} fill sizes="76px" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 dish-mesh flex items-center justify-center">
                      <Box size={20} color="rgba(253,253,253,0.5)" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center">
                  <h3 className="font-display text-sm font-semibold truncate" style={{ color: "var(--navy)" }}>
                    {it.nama_menu}
                  </h3>
                  {it.options && it.options.length > 0 && (
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--navy-muted)" }}>
                      {it.options.map((o) => o.name).join(" · ")}
                    </p>
                  )}
                  <p className="text-sm font-bold mt-1" style={{ color: "var(--orange-ink)" }}>
                    {formatRupiah(it.harga_menu)}
                  </p>
                </div>
                <div className="checkout-quantity shrink-0 inline-flex items-center gap-0.5 rounded-2xl p-1" aria-label={`Jumlah ${it.nama_menu}`}>
                  <button
                    onClick={() => setQty(it.line_key, it.qty - 1)}
                    aria-label={`Kurangi ${it.nama_menu}`}
                    className="press w-11 h-11 rounded-xl inline-flex items-center justify-center"
                    style={{ color: "var(--navy)" }}
                  >
                    <Minus size={16} strokeWidth={2.5} />
                  </button>
                  <span className="w-7 text-center font-bold text-sm tabular-nums" style={{ color: "var(--navy)" }}>
                    {it.qty}
                  </span>
                  <button
                    onClick={() => setQty(it.line_key, it.qty + 1)}
                    aria-label={`Tambah ${it.nama_menu}`}
                    className="press w-11 h-11 rounded-xl inline-flex items-center justify-center"
                    style={{ background: "var(--orange)", color: "var(--white)" }}
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

          {/* Table number & Notes */}
          <div className="card p-4 mt-4 space-y-4">
            <div>
              <label htmlFor="meja" className="block text-sm font-semibold mb-2" style={{ color: "var(--navy)" }}>
                Nomor meja
              </label>
              <input
                id="meja"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                onBlur={() => setTouched(true)}
                inputMode="numeric"
                aria-invalid={touched && !tableValid}
                aria-describedby={touched && !tableValid ? "meja-error" : undefined}
                placeholder="Contoh: 12"
                className="w-full h-12 px-4 rounded-xl text-sm transition-shadow"
                style={{
                  background: "var(--surface)",
                  color: "var(--navy)",
                  boxShadow: touched && !tableValid ? "0 0 0 2px var(--orange)" : undefined,
                }}
              />
              <p
                id={touched && !tableValid ? "meja-error" : undefined}
                role={touched && !tableValid ? "alert" : undefined}
                className="text-[11px] mt-1.5"
                style={{ color: touched && !tableValid ? "var(--orange-ink)" : "var(--navy-muted)" }}
              >
                {touched && !tableValid ? "Wajib diisi sebelum memesan" : "Wajib diisi"}
              </p>
            </div>

            <div>
              <label htmlFor="catatan" className="block text-sm font-semibold mb-2" style={{ color: "var(--navy)" }}>
                Catatan Tambahan <span className="text-[11px] font-normal" style={{ color: "var(--navy-muted)" }}>(Opsional)</span>
              </label>
              <textarea
                id="catatan"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Sambal dipisah, tanpa es batu, sendok plastik..."
                rows={2}
                className="w-full p-3 rounded-xl text-sm transition-shadow resize-none"
                style={{
                  background: "var(--surface)",
                  color: "var(--navy)",
                  minHeight: "72px",
                  lineHeight: "1.5",
                  border: "none",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="card p-4 mt-4">
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--navy-muted)" }}>Subtotal</span>
              <span style={{ color: "var(--navy)" }}>{formatRupiah(total)}</span>
            </div>
            {/* Tarif pajak/layanan hidup di database (RPC) — menampilkan angka
                hasil tebakan di sini berisiko beda dengan total akhir. Cukup
                beri tahu tamu apakah harganya sudah termasuk. */}
            {((cafe.tax_rate_pct ?? 0) > 0 || (cafe.service_charge_pct ?? 0) > 0) && (
              <p className="text-[11px] mt-2" style={{ color: "var(--navy-muted)" }}>
                {cafe.prices_include_tax
                  ? "Harga sudah termasuk pajak & layanan"
                  : "Belum termasuk pajak & layanan"}
              </p>
            )}
            <div className="w-full h-px my-3" style={{ background: "var(--border)" }} />
            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ color: "var(--navy)" }}>Total</span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--orange-ink)" }}>
                {formatRupiah(total)}
              </span>
            </div>
          </div>

            </>
          ) : (
            <section aria-labelledby="payment-heading" className="space-y-4">
              <div className="mb-1">
                <p className="checkout-kicker">Langkah 2 dari 2</p>
              </div>
              <div className="card p-4">
                <h2 id="payment-heading" className="font-display text-lg font-bold" style={{ color: "var(--navy)" }}>
                  Pilih metode pembayaran
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--navy-muted)" }}>
                  Pesananmu akan dikirim setelah metode pembayaran dipilih.
                </p>
                <div className="mt-4 space-y-2">
                  {items.map((it) => (
                    <div key={it.line_key} className="flex items-center justify-between gap-3 text-sm">
                      <span style={{ color: "var(--navy)" }}>{it.qty}× {it.nama_menu}</span>
                      <span style={{ color: "var(--navy-muted)" }}>{formatRupiah(it.harga_menu * it.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="w-full h-px my-3" style={{ background: "var(--border)" }} />
                <div className="flex items-center justify-between font-bold" style={{ color: "var(--navy)" }}>
                  <span>Total</span>
                  <span style={{ color: "var(--orange-ink)" }}>{formatRupiah(total)}</span>
                </div>
              </div>
              <PaymentChannelSelector value={channel} onChange={setChannel} />
            </section>
          )}
        </div>
      )}

      {/* Sticky CTA */}
      {count > 0 && (
      <div
        className="checkout-action-bar fixed bottom-0 inset-x-0 z-40 px-4 pt-3"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            background: "var(--navy)",
            borderTop: "1px solid rgba(253,253,253,0.14)",
          }}
        >
          {step === "review" ? (
            <>
              <button
                onClick={continueToPayment}
                disabled={!isOnline}
                className="btn-primary press w-full h-[52px] rounded-2xl font-semibold text-[15px] text-white max-w-xl mx-auto inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Lanjut ke pembayaran
              </button>
              <p className="checkout-action-hint text-[11px] text-center mt-2" style={{ color: "var(--navy-muted)" }}>
                {isOnline ? "Periksa meja dan catatan sebelum memilih pembayaran." : "Hubungkan ke Wi-Fi kafe untuk melanjutkan."}
              </p>
            </>
          ) : (
            <>
              {orderError && (
                <div
                  ref={orderErrorRef}
                  role="alert"
                  aria-live="assertive"
                  tabIndex={-1}
                  className="max-w-xl mx-auto mb-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--surface)", border: "1px solid var(--orange)", color: "var(--navy)" }}
                >
                  <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--orange-ink)" }} />
                  <p>{orderError}</p>
                </div>
              )}
              <div className="checkout-action-row max-w-xl mx-auto flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setStep("review")}
                  disabled={isSubmitting}
                  className="checkout-secondary-action press h-[48px] sm:h-[52px] rounded-2xl px-4 font-semibold text-sm disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Kembali ke review
                </button>
                <button
                  onClick={submit}
                  disabled={isSubmitting || !isOnline}
                  className="btn-primary press w-full flex-1 h-[52px] rounded-2xl font-semibold text-[15px] text-white inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
                  {isSubmitting ? "Mengirim pesanan..." : "Kirim pesanan"}
                </button>
              </div>
              <p className="checkout-action-hint text-[11px] text-center mt-2 flex items-center justify-center gap-1" style={{ color: isOnline ? "var(--navy-muted)" : "var(--orange-ink)" }}>
                {isOnline
                  ? channel === "online"
                    ? "Lanjut ke pembayaran online setelah pesanan dibuat"
                    : `Tunjukkan kode ke kasir ${cafe.nama_cafe} untuk bayar`
                  : <><WifiOff size={14} strokeWidth={1.8} /> Hubungkan ke Wi-Fi kafe untuk mengirim pesanan.</>}
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}

/* ── Pemilih metode pembayaran: dua segmen setara (online / kasir) ── */
function PaymentChannelSelector({
  value,
  onChange,
}: {
  value: "online" | "cashier";
  onChange: (v: "online" | "cashier") => void;
}) {
  const options = [
    {
      id: "online" as const,
      icon: Smartphone,
      title: "Bayar Online",
      sub: "Satu QR untuk semua aplikasi pembayaran",
    },
    {
      id: "cashier" as const,
      icon: Store,
      title: "Bayar di Kasir",
      sub: "Tunjukkan kode pesanan ke kasir",
    },
  ];

  return (
    <section aria-label="Pilih metode pembayaran">
      <h2 className="font-display text-sm font-bold mb-2" style={{ color: "var(--navy)" }}>
        Metode pembayaran
      </h2>
      <div
        role="radiogroup"
        aria-label="Pilih metode pembayaran"
        className="payment-choice-list space-y-2"
      >
        {options.map((opt) => {
          const active = value === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id)}
              className={`payment-choice press flex items-start gap-3 rounded-2xl px-3.5 py-3.5 text-left transition-[background,box-shadow,transform] duration-200${active ? " is-selected" : ""}`}
              style={
                active
                  ? { background: "var(--white)", boxShadow: "var(--shadow-md)", border: "1.5px solid var(--orange)" }
                  : { background: "var(--white)", border: "1.5px solid var(--border)" }
              }
            >
              <span className="payment-choice-icon w-10 h-10 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: active ? "var(--orange-blush)" : "var(--surface)" }}>
                <Icon
                  size={18}
                  strokeWidth={2.2}
                  style={{ color: active ? "var(--orange)" : "var(--navy-muted)" }}
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-[13px]" style={{ color: active ? "var(--navy)" : "var(--navy-muted)" }}>
                    {opt.title}
                  </span>
                  {active && <Check size={15} strokeWidth={2.8} style={{ color: "var(--orange)" }} aria-hidden="true" />}
                </span>
                <span className="block text-[11px] leading-tight mt-1" style={{ color: "var(--navy-muted)" }}>
                  {opt.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
