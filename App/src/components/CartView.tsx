"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { createOrder, quoteOrder } from "@/lib/orders";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { Cafe, CartItem, OrderQuote } from "@/types";
import { CheckoutCommitBar } from "./checkout/CheckoutCommitBar";
import { CheckoutConfirmation } from "./checkout/CheckoutConfirmation";
import { CheckoutReview } from "./checkout/CheckoutReview";

type CheckoutStage = "review" | "confirmation";
type PaymentChannel = "online" | "cashier";

export default function CartView({ cafe, slug }: { cafe: Cafe; slug: string }) {
  const { items, count, total, table, notes, setQty, setTable, setNotes, clear } = useCart();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [stage, setStage] = useState<CheckoutStage>("review");
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [channel, setChannel] = useState<PaymentChannel>("online");
  const [tableTouched, setTableTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsQuoteRetry, setNeedsQuoteRetry] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteFingerprint, setQuoteFingerprint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const quoteRequestGenerationRef = useRef(0);
  const tableValid = table.trim().length > 0;
  const currentCartFingerprint = cartFingerprint(items);
  const imageUrlsByMenuId = new Map(items.map(({ id_menu, image_url }) => [id_menu, image_url]));
  const currentCartFingerprintRef = useRef(currentCartFingerprint);
  const observedCartFingerprintRef = useRef(currentCartFingerprint);
  currentCartFingerprintRef.current = currentCartFingerprint;

  useEffect(() => {
    if (observedCartFingerprintRef.current !== currentCartFingerprint) {
      observedCartFingerprintRef.current = currentCartFingerprint;
      invalidateQuote();
      setNeedsQuoteRetry(false);
      setStage("review");
    }
  }, [currentCartFingerprint]);

  useEffect(() => {
    if (stage === "confirmation") confirmationHeadingRef.current?.focus();
  }, [stage]);

  function invalidateQuote() {
    quoteRequestGenerationRef.current += 1;
    setQuote(null);
    setQuoteFingerprint(null);
    setIsQuoting(false);
  }

  function focusTable() {
    document.getElementById("meja")?.focus();
  }

  async function continueToConfirmation() {
    if (isQuoting) return;
    setError(null);
    if (!isOnline) {
      setError("Hubungkan ke internet untuk memuat ringkasan pesanan.");
      return;
    }
    if (!tableValid) {
      setTableTouched(true);
      focusTable();
      return;
    }

    const requestGeneration = quoteRequestGenerationRef.current;
    const requestFingerprint = currentCartFingerprint;
    try {
      setNeedsQuoteRetry(false);
      setIsQuoting(true);
      const freshQuote = await quoteOrder({
        cafeId: cafe.id_cafe,
        table: table.trim(),
        items,
        notes: notes.trim(),
        paymentChannel: channel,
      });
      if (
        requestGeneration !== quoteRequestGenerationRef.current ||
        requestFingerprint !== currentCartFingerprintRef.current
      ) {
        setStage("review");
        return;
      }
      setQuote(freshQuote);
      setQuoteFingerprint(requestFingerprint);
      setStage("confirmation");
    } catch (quoteError) {
      if (requestGeneration !== quoteRequestGenerationRef.current) return;
      setStage("review");
      setNeedsQuoteRetry(true);
      setError(quoteError instanceof Error ? quoteError.message : "Gagal memuat ringkasan pesanan.");
    } finally {
      if (requestGeneration === quoteRequestGenerationRef.current) setIsQuoting(false);
    }
  }

  function editOrder() {
    invalidateQuote();
    setNeedsQuoteRetry(false);
    setError(null);
    setStage("review");
  }

  async function submit() {
    if (isSubmitting) return;
    if (!isOnline) {
      setError("Hubungkan ke internet untuk mengirim pesanan.");
      return;
    }
    if (!tableValid) {
      setTableTouched(true);
      editOrder();
      focusTable();
      return;
    }
    if (!quote || quoteFingerprint !== currentCartFingerprint ||
        !quote.quote_id || !quote.request_hash || !quote.expires_at) {
      setStage("review");
      setNeedsQuoteRetry(true);
      setError("Ringkasan pesanan perlu dimuat ulang sebelum dikirim.");
      return;
    }

    const quoteExpiresAt = Date.parse(quote.expires_at);
    if (!Number.isFinite(quoteExpiresAt) || quoteExpiresAt <= Date.now()) {
      invalidateQuote();
      setStage("review");
      setNeedsQuoteRetry(true);
      setError("Ringkasan pesanan sudah kedaluwarsa. Muat ulang sebelum dikirim.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    idempotencyKeyRef.current ??= crypto.randomUUID();
    try {
      const order = await createOrder({
        cafeId: cafe.id_cafe,
        cafeSlug: slug,
        cafeName: cafe.nama_cafe,
        table: table.trim(),
        items,
        notes: notes.trim(),
        paymentChannel: channel,
        quoteId: quote.quote_id,
        idempotencyKey: idempotencyKeyRef.current,
      });
      clear();
      const token = encodeURIComponent(order.customer_token ?? "");
      const totalMarker = order.total === quote.total ? "" : `&reviewTotal=${encodeURIComponent(String(quote.total))}`;
      router.push(`/${slug}/pesanan/${order.id_order}?token=${token}${totalMarker}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal membuat pesanan. Silakan coba lagi.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="checkout-page" style={{ paddingBottom: count > 0 ? "184px" : "0" }}>
      <header className="checkout-header">
        <Link href={`/${slug}`} aria-label="Kembali ke menu"><ArrowLeft size={22} aria-hidden="true" /></Link>
        <h1>Selesaikan pesanan</h1>
        {count > 0 ? <span>{count} item</span> : null}
      </header>

      {count === 0 ? (
        <div className="checkout-empty-state">
          <ShoppingBag size={32} aria-hidden="true" />
          <h2>Keranjang masih kosong</h2>
          <p>Pilih hidangan favoritmu dulu, lalu tambahkan ke pesanan.</p>
          <Link href={`/${slug}`}>Jelajahi menu</Link>
        </div>
      ) : (
        <div className="checkout-content">
          {error ? <div ref={errorRef} role="alert" aria-live="assertive" tabIndex={-1} className="checkout-alert">{error}</div> : null}
          {stage === "review" ? (
            <CheckoutReview
              items={items}
              table={table}
              notes={notes}
              subtotal={total}
              tableInvalid={tableTouched && !tableValid}
              slug={slug}
              onQuantityChange={(lineKey, quantity) => { invalidateQuote(); setQty(lineKey, quantity); }}
              onTableChange={(value) => { invalidateQuote(); setTable(value); }}
              onNotesChange={(value) => { invalidateQuote(); setNotes(value); }}
              onTableBlur={() => setTableTouched(true)}
            />
          ) : quote ? (
            <CheckoutConfirmation quote={quote} imageUrlsByMenuId={imageUrlsByMenuId} channel={channel} onChannelChange={setChannel} headingRef={confirmationHeadingRef} />
          ) : null}
          <CheckoutCommitBar
            stage={stage}
            itemCount={count}
            subtotal={total}
            table={table.trim()}
            total={quote?.total}
            channel={channel}
            isSubmitting={isSubmitting}
            continueLabel={needsQuoteRetry ? "Coba lagi" : "Lanjut"}
            onContinue={continueToConfirmation}
            onEdit={editOrder}
            onSubmit={submit}
          />
        </div>
      )}
    </main>
  );
}

function cartFingerprint(items: CartItem[]): string {
  return JSON.stringify(
    items
      .map(({ id_menu, qty, options }) => ({
        id_menu,
        qty,
        options: (options ?? []).map((option) => option.id_option_value).sort(),
      }))
      .sort((left, right) => {
        const leftKey = `${left.id_menu}:${left.options.join(",")}:${left.qty}`;
        const rightKey = `${right.id_menu}:${right.options.join(",")}:${right.qty}`;
        return leftKey.localeCompare(rightKey);
      })
  );
}
