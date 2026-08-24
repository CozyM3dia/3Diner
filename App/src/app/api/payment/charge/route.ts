import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";

const CHARGE_PER_IP = { limit: 6, windowSeconds: 60 };
const MIDTRANS_TIMEOUT_MS = 8_000;
const ALLOWED_QR_HOSTS = new Set(["api.midtrans.com", "api.sandbox.midtrans.com"]);
const ACTIVE_ORDER_STATUSES = ["awaiting", "received", "preparing"];

type MidtransQrisAction = {
  name?: unknown;
  url?: unknown;
};

type MidtransQrisResponse = {
  status_code?: unknown;
  status_message?: unknown;
  payment_type?: unknown;
  transaction_status?: unknown;
  transaction_id?: unknown;
  actions?: unknown;
  error_messages?: unknown;
};

type QrisRecovery =
  | { kind: "pending"; qrisUrl: string; transactionId: string }
  | { kind: "settled" }
  | { kind: "terminal"; transactionId: string | null }
  | { kind: "unknown" };

type ResetResult = "reset" | "superseded" | "error";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAllowedQrUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.port === "" && ALLOWED_QR_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Prefer ASPI's bordered QR when Midtrans provides it, then fall back to the
 *  original QR action for older merchant/API responses. */
function getQrisUrl(data: MidtransQrisResponse | null, apiBaseUrl?: string): string | null {
  const actions = Array.isArray(data?.actions)
    ? data.actions.filter((action): action is MidtransQrisAction =>
      typeof action === "object" && action !== null
    )
    : [];
  const action =
    actions.find((candidate) => candidate.name === "generate-qr-code-v2") ??
    actions.find((candidate) => candidate.name === "generate-qr-code");
  if (isAllowedQrUrl(action?.url)) return action.url;

  // The standard QRIS image path is deterministic from transaction_id. This
  // lets us recover a transaction after a charge response was lost, even when
  // Get Status omits the original actions array.
  if (apiBaseUrl && isNonEmptyString(data?.transaction_id)) {
    const fallback = `${apiBaseUrl}/v2/qris/${encodeURIComponent(data.transaction_id)}/qr-code`;
    return isAllowedQrUrl(fallback) ? fallback : null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { orderId, orderToken } = (await req.json()) as {
      orderId?: unknown; orderToken?: unknown;
    };
    if (typeof orderId !== "string" || typeof orderToken !== "string" || !orderId || !orderToken) {
      return NextResponse.json({ error: "Data pesanan tidak valid" }, { status: 400 });
    }

    const limit = await consumeRateLimit(`charge:ip:${clientIp(req)}`, CHARGE_PER_IP.limit, CHARGE_PER_IP.windowSeconds);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    // maybeSingle: token salah ATAU order hilang = data null (bukan error),
    // sedangkan kegagalan query sesungguhnya tetap terlihat sebagai error —
    // DB yang sedang gagal tidak boleh dilaporkan "Pesanan tidak ditemukan".
    const { data: order, error } = await supabaseAdmin
      .from("Orders")
      .select("id_order,customer_token,total,subtotal,tax_amount,service_amount,prices_include_tax,status,payment_status,payment_qr_url,payment_transaction_id,payment_idempotency_key,items")
      .eq("id_order", orderId)
      .eq("customer_token", orderToken)
      .maybeSingle();
    if (error) {
      console.error("[api/payment/charge] read order failed", error);
      return NextResponse.json({ error: "Gagal membaca pesanan. Coba lagi." }, { status: 503 });
    }
    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }
    if (!ACTIVE_ORDER_STATUSES.includes(order.status)) {
      return NextResponse.json({ error: "Pesanan ini tidak dapat dibayar" }, { status: 409 });
    }
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Pembayaran pesanan ini sudah lunas" }, { status: 409 });
    }
    if (order.payment_status === "pending" &&
        isAllowedQrUrl(order.payment_qr_url) &&
        isNonEmptyString(order.payment_transaction_id)) {
      return NextResponse.json({ qris_url: order.payment_qr_url });
    }
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) return NextResponse.json({ error: "Pembayaran belum dikonfigurasi" }, { status: 503 });
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const apiBaseUrl = isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
    const chargeUrl = isProduction
      ? "https://api.midtrans.com/v2/charge"
      : "https://api.sandbox.midtrans.com/v2/charge";
    const authHeader = `Basic ${Buffer.from(serverKey + ":").toString("base64")}`;
    let attemptIdempotencyKey: string | null = null;
    let shouldClaimNewAttempt = order.payment_status === "awaiting_payment";

    if (order.payment_status === "pending") {
      const recovery = await recoverPendingQris(
        order.id_order,
        serverKey,
        apiBaseUrl,
        order.payment_transaction_id,
        order.payment_idempotency_key
      );
      if (recovery.kind === "pending") {
        return NextResponse.json({ qris_url: recovery.qrisUrl });
      }
      if (recovery.kind === "settled") {
        return NextResponse.json({ error: "Pembayaran sudah diterima; menunggu konfirmasi" }, { status: 409 });
      }
      if (recovery.kind === "terminal") {
        const resetResult = await resetPendingQris(
          order.id_order,
          order.payment_transaction_id,
          order.payment_idempotency_key
        );
        if (resetResult === "error") return NextResponse.json({ error: "Gagal mereset pembayaran" }, { status: 502 });
        if (resetResult === "superseded") {
          return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
        }
        shouldClaimNewAttempt = true;
      } else {
        // A 404 or transient status failure is ambiguous: the charge may have
        // succeeded but not be visible to Get Status yet. Only retry with the
        // stored Midtrans idempotency key; legacy attempts without one stay
        // pending until they can be reconciled safely.
        attemptIdempotencyKey = isNonEmptyString(order.payment_idempotency_key)
          ? order.payment_idempotency_key
          : null;
        if (!attemptIdempotencyKey) {
          return NextResponse.json({ error: "Pembayaran sedang diverifikasi" }, { status: 409 });
        }
      }
    }

    if (shouldClaimNewAttempt) {
      // Klaim atomik: hanya order yang masih menunggu bayar yang boleh di-charge.
      // Mencegah dua tab membuat dua transaksi QRIS untuk order yang sama.
      const newIdempotencyKey = randomUUID();
      const { data: claimedRows, error: claimError } = await supabaseAdmin
        .from("Orders")
        .update({ payment_status: "pending", payment_qr_url: null, payment_transaction_id: null, payment_idempotency_key: newIdempotencyKey })
        .eq("id_order", order.id_order)
        .eq("payment_status", "awaiting_payment")
        .in("status", ACTIVE_ORDER_STATUSES)
        .select("id_order,payment_idempotency_key");
      if (claimError) {
        return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
      }
      if (!claimedRows || claimedRows.length !== 1 || claimedRows[0]?.payment_idempotency_key !== newIdempotencyKey) {
        return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
      }
      attemptIdempotencyKey = newIdempotencyKey;
    }
    if (!attemptIdempotencyKey) {
      return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
    }

    const items = (Array.isArray(order.items) ? order.items as {
      id_menu: string; harga_menu: number; qty: number; nama_menu: string }[] : []);
    const itemDetails = items.map((it) => ({
      id: it.id_menu, price: it.harga_menu, quantity: it.qty, name: it.nama_menu.slice(0, 50),
    }));
    const serviceAmount = Number(order.service_amount ?? 0);
    const taxAmount = order.prices_include_tax ? 0 : Number(order.tax_amount ?? 0);
    if (!Number.isInteger(serviceAmount) || serviceAmount < 0 || !Number.isInteger(taxAmount) || taxAmount < 0) {
      const resetResult = await resetPendingQris(order.id_order, null, attemptIdempotencyKey);
      if (resetResult === "error") return NextResponse.json({ error: "Gagal mereset pembayaran" }, { status: 502 });
      if (resetResult === "superseded") return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
      return NextResponse.json({ error: "Total pesanan tidak valid" }, { status: 500 });
    }
    if (serviceAmount > 0) itemDetails.push({ id: "service-charge", price: serviceAmount, quantity: 1, name: "Service charge" });
    if (taxAmount > 0) itemDetails.push({ id: "tax", price: taxAmount, quantity: 1, name: "Tax" });
    const itemDetailsTotal = itemDetails.reduce((sum, it) => sum + it.price * it.quantity, 0);
    if (itemDetailsTotal !== Number(order.total)) {
      const resetResult = await resetPendingQris(order.id_order, null, attemptIdempotencyKey);
      if (resetResult === "error") return NextResponse.json({ error: "Gagal mereset pembayaran" }, { status: 502 });
      if (resetResult === "superseded") return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
      return NextResponse.json({ error: "Rincian total pesanan tidak valid" }, { status: 500 });
    }
    const body = {
      payment_type: "qris",
      transaction_details: { order_id: order.id_order, gross_amount: order.total },
      item_details: itemDetails,
    };

    let res: Response;
    let data: MidtransQrisResponse | null;
    try {
      res = await fetch(chargeUrl, {
        method: "POST",
        signal: AbortSignal.timeout(MIDTRANS_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: authHeader,
          "Idempotency-Key": attemptIdempotencyKey,
        },
        body: JSON.stringify(body),
      });
      data = await res.json() as MidtransQrisResponse | null;
    } catch (midtransErr) {
      console.error("[api/payment/charge] midtrans charge failed", midtransErr);
      // The request may have reached Midtrans even though the response was
      // lost. Query by merchant order ID before allowing a retry, otherwise a
      // retry could create a second active QRIS transaction.
      const recovery = await recoverPendingQris(
        order.id_order,
        serverKey,
        apiBaseUrl,
        order.payment_transaction_id,
        attemptIdempotencyKey
      );
      if (recovery.kind === "pending") return NextResponse.json({ qris_url: recovery.qrisUrl });
      if (recovery.kind === "settled") {
        return NextResponse.json({ error: "Pembayaran sudah diterima; menunggu konfirmasi" }, { status: 409 });
      }
      if (recovery.kind === "terminal") {
        const resetResult = await resetPendingQris(
          order.id_order,
          order.payment_transaction_id,
          attemptIdempotencyKey
        );
        if (resetResult === "error") return NextResponse.json({ error: "Gagal mereset pembayaran" }, { status: 502 });
        if (resetResult === "superseded") {
          return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
        }
        return NextResponse.json({ error: "Gagal menghubungi pembayaran" }, { status: 502 });
      }
      return NextResponse.json({ error: "Pembayaran sedang diverifikasi" }, { status: 502 });
    }

    const qrisUrl = getQrisUrl(data, apiBaseUrl);
    const transactionId = isNonEmptyString(data?.transaction_id) ? data.transaction_id : null;
    const statusCode = Number(data?.status_code ?? res.status);
    if (!res.ok || !Number.isFinite(statusCode) || statusCode >= 400 || data?.payment_type !== "qris" ||
        data?.transaction_status !== "pending" || !qrisUrl || !transactionId) {
      // A non-ambiguous Midtrans 4xx means this attempt was rejected before a
      // usable QR was created. Release only this attempt's claim so the
      // customer can choose another payment path. Duplicate-order (406) and
      // rate-limit (429) responses stay pending because they may represent an
      // already accepted request and must be retried with the same key.
      const definitiveClientFailure = Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 500 &&
        statusCode !== 406 && statusCode !== 429;
      if (definitiveClientFailure) {
        const resetResult = await resetPendingQris(order.id_order, order.payment_transaction_id, attemptIdempotencyKey);
        if (resetResult === "error") return NextResponse.json({ error: "Gagal mereset pembayaran" }, { status: 502 });
        if (resetResult === "superseded") {
          return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
        }
      }
      const msgs = data?.error_messages;
      const msg = Array.isArray(msgs)
        ? msgs.join(", ")
        : data?.status_message ?? "QRIS tidak dapat dibuat";
      return NextResponse.json({ error: msg }, { status: res.ok ? 502 : res.status === 406 ? 409 : 400 });
    }

    const { data: persistedRows, error: qrPersistError } = await supabaseAdmin
      .from("Orders")
      .update({ payment_qr_url: qrisUrl, payment_transaction_id: transactionId })
      .eq("id_order", order.id_order)
      .eq("payment_status", "pending")
      .eq("payment_idempotency_key", attemptIdempotencyKey)
      .in("status", ACTIVE_ORDER_STATUSES)
      .select("payment_qr_url,payment_transaction_id");
    if (qrPersistError || persistedRows?.length !== 1 ||
        persistedRows[0]?.payment_qr_url !== qrisUrl ||
        persistedRows[0]?.payment_transaction_id !== transactionId) {
      return NextResponse.json({ error: "QRIS dibuat, tetapi belum tersimpan. Silakan ulangi." }, { status: 502 });
    }

    return NextResponse.json({ qris_url: qrisUrl });
  } catch (err: unknown) {
    console.error("[api/payment/charge] unhandled error", err);
    return NextResponse.json({ error: "Gagal memproses pembayaran. Coba lagi." }, { status: 500 });
  }
}

async function recoverPendingQris(
  orderId: string,
  serverKey: string,
  apiBaseUrl: string,
  transactionIdHint?: unknown,
  idempotencyKey?: unknown
): Promise<QrisRecovery> {
  const statusIdentifier = isNonEmptyString(transactionIdHint) ? transactionIdHint : orderId;
  const statusUrl = `${apiBaseUrl}/v2/${encodeURIComponent(statusIdentifier)}/status`;
  try {
    const response = await fetch(statusUrl, {
      signal: AbortSignal.timeout(MIDTRANS_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(serverKey + ":").toString("base64")}`,
      },
    });
    if (response.status === 404) return { kind: "unknown" };
    if (!response.ok) return { kind: "unknown" };
    const data = await response.json() as MidtransQrisResponse;
    if (isNonEmptyString(transactionIdHint) && data.transaction_id !== transactionIdHint) {
      return { kind: "unknown" };
    }
    if (data.transaction_status === "settlement" || data.transaction_status === "capture") {
      return { kind: "settled" };
    }
    if (["expire", "cancel", "deny", "failure"].includes(String(data.transaction_status))) {
      return {
        kind: "terminal",
        transactionId: isNonEmptyString(data.transaction_id) ? data.transaction_id : null,
      };
    }
    const qrisUrl = getQrisUrl(data, apiBaseUrl);
    const transactionId = isNonEmptyString(data.transaction_id) ? data.transaction_id : null;
    if (data.payment_type !== "qris" || data.transaction_status !== "pending" || !qrisUrl || !transactionId) {
      return { kind: "unknown" };
    }
    let persistedQuery = supabaseAdmin
      .from("Orders")
      .update({ payment_qr_url: qrisUrl, payment_transaction_id: transactionId })
      .eq("id_order", orderId)
      .eq("payment_status", "pending");
    persistedQuery = persistedQuery.in("status", ACTIVE_ORDER_STATUSES);
    if (isNonEmptyString(transactionIdHint)) {
      // A status lookup by transaction ID must only update that same attempt.
      persistedQuery = persistedQuery.eq("payment_transaction_id", transactionIdHint);
    } else if (isNonEmptyString(idempotencyKey)) {
      // A lost charge response has no transaction ID yet; the attempt key is
      // the compare-and-set identity that prevents a stale recovery write.
      persistedQuery = persistedQuery.eq("payment_idempotency_key", idempotencyKey);
    } else {
      return { kind: "unknown" };
    }
    const { data: persistedRows, error } = await persistedQuery.select("payment_qr_url,payment_transaction_id");
    if (error || persistedRows?.length !== 1 ||
        persistedRows[0]?.payment_qr_url !== qrisUrl ||
        persistedRows[0]?.payment_transaction_id !== transactionId) {
      return { kind: "unknown" };
    }
    return { kind: "pending", qrisUrl, transactionId };
  } catch {
    return { kind: "unknown" };
  }
}

async function resetPendingQris(
  orderId: string,
  transactionId: unknown,
  idempotencyKey: unknown
): Promise<ResetResult> {
  if (!isNonEmptyString(transactionId) && !isNonEmptyString(idempotencyKey)) return "error";
  let resetQuery = supabaseAdmin
    .from("Orders")
    .update({ payment_status: "awaiting_payment", payment_qr_url: null, payment_transaction_id: null, payment_idempotency_key: null })
    .eq("id_order", orderId)
    .eq("payment_status", "pending");
  resetQuery = resetQuery.in("status", ACTIVE_ORDER_STATUSES);
  if (isNonEmptyString(transactionId)) resetQuery = resetQuery.eq("payment_transaction_id", transactionId);
  if (isNonEmptyString(idempotencyKey)) resetQuery = resetQuery.eq("payment_idempotency_key", idempotencyKey);
  const { data, error } = await resetQuery.select("id_order");
  if (error || !data || data.length > 1) return "error";
  return data.length === 0 ? "superseded" : "reset";
}
