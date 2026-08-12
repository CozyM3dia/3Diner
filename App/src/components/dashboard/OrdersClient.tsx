"use client";

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import { ShoppingBag, ChefHat, CheckCircle2, XCircle, Loader2, Copy, Check, Printer, X, BellRing, BellOff, QrCode, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { markOrderCashPaid, updateOrderStatus } from "@/lib/dashboard-actions";
import { escapeHtml, formatRupiah } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import {
  DashboardEmptyState,
  DashboardPanel,
  DashboardToolbar,
  StatusBadge,
  getDashPortal,
  type StatusKind,
} from "@/components/dashboard/system";
import type { OrderItem, OrderStatus } from "@/types";

export interface OrderRow {
  id_order: string;
  cafe_id: string;
  table_number: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
  notes?: string | null;
}

/** Pesanan yang sudah terminal tidak bisa dimajukan lagi. Ini dashboard lama —
 *  ia tidak punya tab untuk keduanya, tapi harus tetap menampilkannya dengan
 *  benar sejak status terminal masuk ke database. */
function isTerminal(status: OrderRow["status"]): boolean {
  return status === "completed" || status === "cancelled";
}

type Filter = "all" | "received" | "preparing" | "ready";

/** Baris pembayaran: memisahkan pekerjaan kasir dari pekerjaan dapur.
 *
 *  Hanya pesanan tunai yang boleh dilunasi kasir; semua metode online selesai
 *  lewat webhook Midtrans. */
function PaymentRow({
  order,
  busy,
  onMarkPaid,
}: {
  order: OrderRow;
  busy: boolean;
  onMarkPaid: () => void;
}) {
  const paid = order.payment_status === "paid";
  const isCash = order.payment_method === "cash";
  const methodLabel = paymentMethodLabel(order.payment_method);

  return (
    <div
      className="flex items-center justify-between gap-3 mb-3 px-3 py-2.5 rounded-xl"
      style={{
        background: paid ? "rgba(34,211,166,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${paid ? "rgba(34,211,166,0.22)" : "var(--dash-border)"}`,
      }}
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        <Wallet size={14} strokeWidth={1.8} style={{ color: paid ? "#22D3A6" : "var(--dash-muted)" }} />
        <span className="text-xs truncate" style={{ color: "var(--dash-secondary)" }}>
          {methodLabel}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
          style={
            paid
              ? { background: "rgba(34,211,166,0.16)", color: "#22D3A6" }
              : { background: "rgba(245,158,11,0.14)", color: "#F59E0B" }
          }
        >
          {paid ? "Lunas" : "Belum"}
        </span>
      </span>

      {!paid && isCash && (
        <button
          onClick={onMarkPaid}
          disabled={busy}
          className="dash-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 disabled:opacity-60"
          style={{ background: "rgba(34,211,166,0.14)", color: "#22D3A6", border: "1px solid rgba(34,211,166,0.3)" }}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          Tandai Lunas
        </button>
      )}

      {!paid && !isCash && (
        <span className="text-[11px] shrink-0" style={{ color: "var(--dash-muted)" }}>
          Menunggu Midtrans
        </span>
      )}
    </div>
  );
}

/** Status pesanan memakai vocabulary StatusBadge system (label identik). */
const STATUS_KIND: Record<OrderRow["status"], StatusKind> = {
  awaiting: "order-awaiting",
  received: "order-received",
  preparing: "order-preparing",
  ready: "order-ready",
  completed: "order-completed",
  cancelled: "order-cancelled",
};

const TABS: { v: Filter; l: string }[] = [
  { v: "all", l: "Semua" },
  { v: "received", l: "Baru" },
  { v: "preparing", l: "Diproses" },
  { v: "ready", l: "Siap" },
];

/** Struk dirakit sebagai string HTML lalu ditulis via document.write ke iframe
 *  same-origin — SEMUA teks yang disisipkan harus lewat escapeHtml.
 *  table_number dan notes berasal dari POST /api/orders yang publik. */
export function buildReceiptHtml(order: OrderRow, cafeName: string): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const items = Array.isArray(order.items) ? order.items : [];
  const payLabel = order.payment_method ? paymentMethodLabel(order.payment_method) : "-";
  const statusLabel =
    order.payment_status === "paid" ? "LUNAS"
    : "BELUM BAYAR";

  // 32 chars = safe for 80mm thermal @ 11px monospace
  const D = "================================";
  const S = "--------------------------------";

  const itemRows = items.map((it) => {
    const price = it.harga_menu.toLocaleString("id-ID");
    const sub   = (it.harga_menu * it.qty).toLocaleString("id-ID");
    // name row + indent price row
    return `
      <tr><td colspan="2" style="font-weight:600;padding-top:3px;">${it.qty}x ${escapeHtml(String(it.nama_menu ?? ""))}</td></tr>
      <tr>
        <td style="padding-left:12px;font-size:10.5px;color:#333;">${it.qty} x Rp ${price}</td>
        <td style="text-align:right;font-weight:600;white-space:nowrap;">Rp ${sub}</td>
      </tr>`;
  }).join("");

  const notesBlock = order.notes
    ? `<div style="border:1px dashed #000;padding:4px 5px;margin:5px 0;font-size:10.5px;word-break:break-word;"><b>** CATATAN **</b><br>${escapeHtml(order.notes)}</div>`
    : "";

  const totalStr = order.total.toLocaleString("id-ID");
  const orderId  = escapeHtml(order.id_order.slice(-8).toUpperCase());
  const cafe     = escapeHtml(cafeName);
  const table    = escapeHtml(String(order.table_number ?? ""));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Struk #${orderId}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{
    font-family:'Courier New',Courier,'Lucida Console',monospace;
    font-size:11.5px;
    line-height:1.5;
    color:#000;
    background:#fff;
    /* 80mm paper, 0 margin — printer driver trims edges */
    width:80mm;
    max-width:80mm;
  }
  body{ padding:4mm 4mm 12mm; }
  .c{text-align:center;}
  .b{font-weight:bold;}
  .sep{font-size:11px;margin:3px 0;letter-spacing:0;}
  .cafe{font-size:15px;font-weight:bold;text-align:center;letter-spacing:2px;text-transform:uppercase;}
  .sub{font-size:9.5px;text-align:center;color:#444;margin-bottom:2px;}
  .meja{font-size:24px;font-weight:900;text-align:center;margin:4px 0 3px;letter-spacing:1px;}
  .meta{font-size:10.5px;margin:1.5px 0;display:flex;justify-content:space-between;}
  .meta b{min-width:56px;display:inline-block;}
  table{width:100%;border-collapse:collapse;}
  td{padding:0;font-size:11px;vertical-align:top;}
  .total-row td{font-size:13px;font-weight:900;padding-top:5px;}
  .status-paid{font-weight:900;font-size:12px;text-align:center;
    border:2px solid #000;padding:2px 6px;display:inline-block;letter-spacing:2px;}
  .footer{text-align:center;font-size:10px;margin-top:2px;color:#333;}
  @media print{
    html,body{width:80mm;max-width:80mm;padding:0 3mm 14mm;}
    @page{size:80mm auto;margin:0;}
  }
</style>
</head>
<body>
  <div class="cafe">${cafe}</div>
  <div class="sub">Powered by 3Diner POS</div>
  <div class="sep c">${D}</div>
  <div class="meja">MEJA ${table}</div>
  <div class="sep c">${S}</div>
  <div class="meta"><b>No.</b> <span>#${orderId}</span></div>
  <div class="meta"><b>Tgl</b> <span>${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span></div>
  <div class="meta"><b>Bayar</b> <span>${payLabel}</span></div>
  <div class="meta"><b>Status</b> <span class="status-paid">${statusLabel}</span></div>
  <div class="sep c">${D}</div>
  <table><tbody>${itemRows}</tbody></table>
  <div class="sep c">${S}</div>
  <table>
    <tr class="total-row">
      <td>TOTAL</td>
      <td style="text-align:right;">Rp ${totalStr}</td>
    </tr>
  </table>
  ${notesBlock}
  <div class="sep c">${D}</div>
  <div class="footer">Terima kasih sudah mampir!</div>
  <div class="footer">Pesanan ini dicetak via 3Diner</div>
  <div style="height:10mm;"></div>
</body>
</html>`;
}

function triggerPrint(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1500);
  }, 350);
}

function ReceiptModal({ order, cafeName, onClose }: { order: OrderRow; cafeName: string; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = buildReceiptHtml(order, cafeName);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
  }, [html]);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        container={getDashPortal() ?? undefined}
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex flex-col gap-0 p-0 sm:max-w-none"
        style={{ maxHeight: "90vh", width: "min(360px, 95vw)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--dash-panel)", borderBottom: "1px solid var(--dash-border-strong)" }}>
          <DialogTitle className="font-semibold text-sm" style={{ color: "var(--dash-text)" }}>
            Preview Struk · Meja {order.table_number}
          </DialogTitle>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Tutup preview struk" title="Tutup">
            <X size={16} style={{ color: "var(--dash-muted)" }} />
          </button>
        </div>

        {/* Receipt preview — looks like paper */}
        <div className="overflow-y-auto flex-1" style={{ background: "#f5f0e8" }}>
          {/* Paper top perforation */}
          <div style={{ height: "6px", background: "repeating-linear-gradient(90deg,#d4ccbb 0,#d4ccbb 6px,#f5f0e8 6px,#f5f0e8 10px)" }} />
          <iframe
            ref={iframeRef}
            title="Receipt Preview"
            style={{ width: "100%", border: "none", display: "block", minHeight: "420px" }}
            scrolling="no"
            onLoad={() => {
              const iframe = iframeRef.current;
              if (!iframe) return;
              const h = iframe.contentDocument?.body?.scrollHeight;
              if (h) iframe.style.height = h + 8 + "px";
            }}
          />
          {/* Paper bottom perforation */}
          <div style={{ height: "6px", background: "repeating-linear-gradient(90deg,#d4ccbb 0,#d4ccbb 6px,#f5f0e8 6px,#f5f0e8 10px)" }} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-4 py-3" style={{ background: "var(--dash-panel)", borderTop: "1px solid var(--dash-border-strong)" }}>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-sm font-semibold"
            style={{ border: "1px solid rgba(255,255,255,0.12)", color: "var(--dash-muted)" }}
          >
            Tutup
          </button>
          <button
            onClick={() => { triggerPrint(html); onClose(); }}
            className="flex-1 h-10 rounded-xl text-sm font-bold dash-on-accent flex items-center justify-center gap-2"
            style={{ background: "var(--orange)" }}
          >
            <Printer size={14} /> Cetak Sekarang
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function relTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

export default function OrdersClient({ initial, cafeId, cafeName }: { initial: OrderRow[]; cafeId: string; cafeName: string }) {
  const [orders, setOrders] = useState<OrderRow[]>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payBusyId, setPayBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<OrderRow | null>(null);

  // Dialog di-unmount begitu previewOrder null, jadi restore-focus bawaan Radix
  // tidak sempat jalan — kembalikan fokus ke tombol pemicu sendiri
  // (pola sama dengan InventoryTable).
  const receiptTriggerRef = useRef<HTMLElement | null>(null);
  const openReceipt = useCallback((order: OrderRow, trigger: HTMLElement) => {
    receiptTriggerRef.current = trigger;
    setPreviewOrder(order);
  }, []);
  const closeReceipt = useCallback(() => {
    setPreviewOrder(null);
    requestAnimationFrame(() => receiptTriggerRef.current?.focus());
  }, []);

  // ── New-order alerts (sound + browser notification + Sonner toast) ──
  const [alertsOn, setAlertsOn] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Hydrate preferensi alarm setelah mount (localStorage client-only);
  // rAF menghindari setState sinkron di body effect.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (localStorage.getItem("3diner.orderAlerts") === "on") setAlertsOn(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const playChime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current ??= new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      // Two-note rising chime (G5 -> C6), soft bell envelope.
      [784, 1047].forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.13;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch { /* audio unavailable */ }
  }, []);

  const fireAlert = useCallback((row: OrderRow) => {
    const itemCount = (Array.isArray(row.items) ? row.items : []).reduce((n, i) => n + i.qty, 0);
    playChime();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Pesanan baru masuk", {
        body: `Meja ${row.table_number} · ${itemCount} item · ${formatRupiah(row.total)}`,
        tag: row.id_order,
      });
    }
    // Sonner id = ID pesanan -> event realtime berulang tidak pernah
    // menghasilkan toast ganda (dedupe kontrak spec).
    toast.custom(
      (t) => (
        <div
          className="flex items-center gap-3 p-3.5 rounded-2xl"
          style={{
            background: "var(--dash-panel)",
            border: "1px solid rgba(34,211,166,0.35)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
            width: "min(320px, calc(100vw - 32px))",
          }}
        >
          <span className="w-10 h-10 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: "rgba(34,211,166,0.14)" }}>
            <ShoppingBag size={18} style={{ color: "#22D3A6" }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight" style={{ color: "var(--dash-text)" }}>
              Pesanan baru · Meja {row.table_number}
            </p>
            <p className="text-xs mt-0.5 tabular-nums" style={{ color: "var(--dash-secondary)" }}>
              {itemCount} item · {formatRupiah(row.total)}
            </p>
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Tutup notifikasi pesanan"
            title="Tutup"
          >
            <X size={15} style={{ color: "var(--dash-muted)" }} />
          </button>
        </div>
      ),
      { id: row.id_order, duration: 6500 }
    );
  }, [playChime]);

  function toggleAlerts() {
    if (alertsOn) {
      setAlertsOn(false);
      localStorage.setItem("3diner.orderAlerts", "off");
      return;
    }
    // Flip state immediately (the permission prompt below must not block the UI).
    setAlertsOn(true);
    localStorage.setItem("3diner.orderAlerts", "on");
    playChime(); // prime audio within the user gesture
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }

  function handleCopy(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Keep the latest alert handler reachable from the one-time subscription closure.
  const fireAlertRef = useRef(fireAlert);
  const alertsOnRef = useRef(alertsOn);
  useEffect(() => { fireAlertRef.current = fireAlert; alertsOnRef.current = alertsOn; }, [fireAlert, alertsOn]);

  useEffect(() => {
    if (!cafeId) return;
    const supabase = createClient();
    let disposed = false;
    let hadIssue = false;
    const channel = supabase
      .channel(`orders-${cafeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Orders", filter: `cafe_id=eq.${cafeId}` },
        (payload) => {
          const row = payload.new as OrderRow;
          if (payload.eventType === "INSERT") {
            setOrders((prev) => {
              if (prev.some((o) => o.id_order === row.id_order)) return prev;
              if (alertsOnRef.current) fireAlertRef.current(row);
              return [row, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setOrders((prev) => prev.map((o) => (o.id_order === row.id_order ? { ...o, ...row } : o)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id_order: string };
            setOrders((prev) => prev.filter((o) => o.id_order !== old.id_order));
          }
        }
      )
      .subscribe((status) => {
        if (disposed) return;
        // Satu id tetap -> peringatan tidak pernah menumpuk (kontrak spec).
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          hadIssue = true;
          toast.warning("Koneksi realtime terputus. Pesanan baru mungkin tertunda — muat ulang bila perlu.", {
            id: "realtime-status",
            duration: 8000,
          });
        } else if (status === "SUBSCRIBED" && hadIssue) {
          hadIssue = false;
          toast.success("Koneksi realtime tersambung kembali.", { id: "realtime-status" });
        }
      });
    return () => {
      disposed = true;
      supabase.removeChannel(channel);
    };
  }, [cafeId]);

  function advance(o: OrderRow) {
    // Tanpa penjaga ini, pesanan yang sudah selesai atau dibatalkan akan
    // dilempar balik ke "ready" — mundur dari status terminal.
    if (isTerminal(o.status)) return;
    const next = o.status === "received" ? "preparing" : "ready";
    setBusyId(o.id_order);
    // optimistic
    setOrders((prev) => prev.map((x) => (x.id_order === o.id_order ? { ...x, status: next } : x)));
    startTransition(async () => {
      await updateOrderStatus(o.id_order, next);
      setBusyId(null);
    });
  }

  /** Kasir melunasi pesanan tunai. Tidak optimistis: uang yang berpindah tangan
   *  tidak boleh terlihat lunas di layar sebelum database mengonfirmasi. */
  function markPaid(o: OrderRow) {
    setPayBusyId(o.id_order);
    startTransition(async () => {
      const result = await markOrderCashPaid(o.id_order);
      if (result.error) {
        toast.error(result.error);
      } else {
        setOrders((prev) =>
          prev.map((x) =>
            x.id_order === o.id_order
              ? { ...x, payment_status: "paid", payment_method: "cash" }
              : x
          )
        );
        toast.success(`Meja ${o.table_number} ditandai lunas`);
      }
      setPayBusyId(null);
    });
  }

  const counts = {
    all: orders.length,
    received: orders.filter((o) => o.status === "received").length,
    preparing: orders.filter((o) => o.status === "preparing").length,
    ready: orders.filter((o) => o.status === "ready").length,
  };
  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <>
      {previewOrder && (
        <ReceiptModal order={previewOrder} cafeName={cafeName} onClose={closeReceipt} />
      )}

      {/* Filter tabs + alert toggle */}
      <DashboardToolbar className="dash-panel mb-5 gap-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
          {TABS.map((t) => {
            const on = filter === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setFilter(t.v)}
                className="dash-chip shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
                style={{
                  background: on ? "rgba(253,80,2,0.12)" : "#0D1829",
                  color: on ? "#FD5002" : "var(--dash-muted)",
                  border: `1px solid ${on ? "rgba(253,80,2,0.3)" : "rgba(255,255,255,0.07)"}`,
                }}
              >
                {t.l}
                <span className="text-xs tabular-nums" style={{ color: on ? "#FD5002" : "var(--dash-muted)" }}>
                  {counts[t.v]}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={toggleAlerts}
          className="dash-press shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{
            background: alertsOn ? "rgba(34,211,166,0.12)" : "#0D1829",
            color: alertsOn ? "#22D3A6" : "var(--dash-muted)",
            border: `1px solid ${alertsOn ? "rgba(34,211,166,0.3)" : "rgba(255,255,255,0.07)"}`,
          }}
          title={alertsOn ? "Alarm pesanan aktif (suara + notifikasi)" : "Aktifkan alarm pesanan baru"}
        >
          {alertsOn ? <BellRing size={15} /> : <BellOff size={15} />}
          <span className="hidden sm:inline">{alertsOn ? "Alarm Aktif" : "Alarm Mati"}</span>
        </button>
      </DashboardToolbar>

      {shown.length === 0 ? (
        <DashboardPanel>
          <DashboardEmptyState
            icon={<ShoppingBag size={38} strokeWidth={1.2} />}
            title="Belum ada pesanan"
            hint="Pesanan baru akan muncul di sini secara otomatis"
            action={
              <Link
                href="/dashboard/settings#qr-menu"
                className="dash-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold dash-on-accent"
                style={{ background: "var(--orange)" }}
              >
                <QrCode size={15} aria-hidden="true" /> Bagikan QR Menu
              </Link>
            }
          />
        </DashboardPanel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((o) => {
            const items = Array.isArray(o.items) ? o.items : [];
            return (
              <DashboardPanel
                key={o.id_order}
                className="dash-card dash-reveal"
                title={
                  <span className="inline-flex items-center gap-2 normal-case tracking-normal">
                    <span className="text-sm font-bold" style={{ color: "var(--dash-text)" }}>Meja {o.table_number}</span>
                    <span className="text-xs flex items-center gap-1 group/id" style={{ color: "var(--dash-muted)" }}>
                      · {o.id_order}
                      <button
                        onClick={() => handleCopy(o.id_order)}
                        className="dash-press p-0.5 rounded transition-colors duration-150 hover:bg-white/10 hover:text-white"
                        title="Salin ID Pesanan"
                        aria-label="Salin ID Pesanan"
                      >
                        {copiedId === o.id_order ? (
                          <Check size={11} className="text-emerald-400" />
                        ) : (
                          <Copy size={11} className="opacity-60 group-hover/id:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </span>
                  </span>
                }
                actions={
                  <>
                    <button
                      onClick={(event) => openReceipt(o, event.currentTarget)}
                      className="dash-press p-1.5 rounded-lg transition-colors duration-150"
                      style={{ color: "var(--dash-muted)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                      title="Preview & Cetak Struk"
                      aria-label="Preview & Cetak Struk"
                    >
                      <Printer size={14} strokeWidth={1.8} />
                    </button>
                    <StatusBadge kind={STATUS_KIND[o.status]} />
                  </>
                }
              >
                <p className="text-[11px] mb-3" style={{ color: "var(--dash-muted)" }}>{relTime(o.created_at)}</p>

                <ul className="space-y-1.5 mb-3">
                  {items.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0" style={{ color: "var(--dash-secondary)" }}>
                        <span style={{ color: "var(--dash-text)", fontWeight: 600 }}>{it.qty}×</span> {it.nama_menu}
                        {it.options && it.options.length > 0 && (
                          <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: "var(--dash-muted)" }}>
                            {it.options.map((opt) => opt.name).join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums shrink-0" style={{ color: "var(--dash-muted)" }}>{formatRupiah(it.harga_menu * it.qty)}</span>
                    </li>
                  ))}
                </ul>

                <PaymentRow
                  order={o}
                  busy={pending && payBusyId === o.id_order}
                  onMarkPaid={() => markPaid(o)}
                />

                {o.notes && (
                  <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: "rgba(253,80,2,0.06)", border: "1px solid rgba(253,80,2,0.15)" }}>
                    <p style={{ color: "#FD5002", fontWeight: 600, marginBottom: "3px" }}>Catatan:</p>
                    <p style={{ color: "var(--dash-text)", whiteSpace: "pre-wrap" }}>{o.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--dash-border)" }}>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--dash-text)" }}>{formatRupiah(o.total)}</span>
                  {o.status === "cancelled" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--dash-muted)" }}>
                      <XCircle size={14} /> Dibatalkan
                    </span>
                  ) : o.status === "ready" || o.status === "completed" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#22D3A6" }}>
                      <CheckCircle2 size={14} /> Selesai
                    </span>
                  ) : (
                    <button
                      onClick={() => advance(o)}
                      disabled={pending && busyId === o.id_order}
                      className="dash-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold dash-on-accent"
                      style={{ background: o.status === "received" ? "#FD5002" : "#F59E0B" }}
                    >
                      {pending && busyId === o.id_order ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : o.status === "received" ? (
                        <ChefHat size={13} />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      {o.status === "received" ? "Mulai Proses" : "Tandai Siap"}
                    </button>
                  )}
                </div>
              </DashboardPanel>
            );
          })}
        </div>
      )}
    </>
  );
}
