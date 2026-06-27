"use client";

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ShoppingBag, Clock, ChefHat, CheckCircle2, Loader2, Copy, Check, Printer, X, BellRing, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/lib/dashboard-actions";
import { formatRupiah } from "@/lib/format";
import type { CartItem } from "@/types";

export interface OrderRow {
  id_order: string;
  cafe_id: string;
  table_number: string;
  items: CartItem[];
  total: number;
  status: "received" | "preparing" | "ready";
  payment_method: string | null;
  payment_status: string;
  created_at: string;
  notes?: string | null;
}

type Filter = "all" | "received" | "preparing" | "ready";

const STATUS_META = {
  received: { label: "Baru", color: "#FD5002", bg: "rgba(253,80,2,0.12)", icon: Clock },
  preparing: { label: "Diproses", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: ChefHat },
  ready: { label: "Siap", color: "#22D3A6", bg: "rgba(34,211,166,0.12)", icon: CheckCircle2 },
} as const;

const TABS: { v: Filter; l: string }[] = [
  { v: "all", l: "Semua" },
  { v: "received", l: "Baru" },
  { v: "preparing", l: "Diproses" },
  { v: "ready", l: "Siap" },
];

function buildReceiptHtml(order: OrderRow, cafeName: string): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const items = Array.isArray(order.items) ? order.items : [];
  const payLabel =
    order.payment_method === "qris" ? "QRIS"
    : order.payment_method === "cash" ? "Tunai"
    : "-";
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
      <tr><td colspan="2" style="font-weight:600;padding-top:3px;">${it.qty}x ${it.nama_menu}</td></tr>
      <tr>
        <td style="padding-left:12px;font-size:10.5px;color:#333;">${it.qty} x Rp ${price}</td>
        <td style="text-align:right;font-weight:600;white-space:nowrap;">Rp ${sub}</td>
      </tr>`;
  }).join("");

  const notesBlock = order.notes
    ? `<div style="border:1px dashed #000;padding:4px 5px;margin:5px 0;font-size:10.5px;word-break:break-word;"><b>** CATATAN **</b><br>${order.notes}</div>`
    : "";

  const totalStr = order.total.toLocaleString("id-ID");
  const orderId  = order.id_order.slice(-8).toUpperCase();

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
  <div class="cafe">${cafeName}</div>
  <div class="sub">Powered by 3Diner POS</div>
  <div class="sep c">${D}</div>
  <div class="meja">MEJA ${order.table_number}</div>
  <div class="sep c">${S}</div>
  <div class="meta"><b>No.</b> <span>#${orderId}</span></div>
  <div class="meta"><b>Tgl</b> <span>${dateStr} ${timeStr}</span></div>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col"
        style={{ maxHeight: "90vh", width: "min(360px, 95vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none" }}>
          <span className="font-semibold text-sm" style={{ color: "#E9EEF6" }}>Preview Struk · Meja {order.table_number}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: "#5A7898" }} />
          </button>
        </div>

        {/* Receipt preview — looks like paper */}
        <div className="overflow-y-auto flex-1" style={{ background: "#f5f0e8", borderLeft: "1px solid rgba(255,255,255,0.1)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
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
        <div className="flex gap-3 px-4 py-3 rounded-b-2xl" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.1)", borderTop: "none" }}>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-sm font-semibold"
            style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#5A7898" }}
          >
            Tutup
          </button>
          <button
            onClick={() => { triggerPrint(html); onClose(); }}
            className="flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: "#FD5002" }}
          >
            <Printer size={14} /> Cetak Sekarang
          </button>
        </div>
      </div>
    </div>
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<OrderRow | null>(null);

  // ── New-order alerts (sound + browser notification + in-app toast) ──
  const [alertsOn, setAlertsOn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<{ key: string; table: string; total: number; items: number }[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setMounted(true);
    setAlertsOn(localStorage.getItem("3diner.orderAlerts") === "on");
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

  const dismissToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
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
    const key = row.id_order + ":" + Date.now();
    setToasts((prev) => [{ key, table: row.table_number, total: row.total, items: itemCount }, ...prev].slice(0, 4));
    setTimeout(() => dismissToast(key), 6500);
  }, [playChime, dismissToast]);

  async function toggleAlerts() {
    if (alertsOn) {
      setAlertsOn(false);
      localStorage.setItem("3diner.orderAlerts", "off");
      return;
    }
    // Turning on: prime audio (user gesture) + request notification permission.
    playChime();
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    setAlertsOn(true);
    localStorage.setItem("3diner.orderAlerts", "on");
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafeId]);

  function advance(o: OrderRow) {
    const next = o.status === "received" ? "preparing" : "ready";
    setBusyId(o.id_order);
    // optimistic
    setOrders((prev) => prev.map((x) => (x.id_order === o.id_order ? { ...x, status: next } : x)));
    startTransition(async () => {
      await updateOrderStatus(o.id_order, next);
      setBusyId(null);
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
        <ReceiptModal order={previewOrder} cafeName={cafeName} onClose={() => setPreviewOrder(null)} />
      )}

      {/* New-order toasts */}
      {mounted && toasts.length > 0 && createPortal(
        <div className="fixed z-[120] flex flex-col gap-2.5 pointer-events-none"
          style={{ top: "calc(env(safe-area-inset-top,0px) + 16px)", right: 16, width: "min(320px, calc(100vw - 32px))" }}>
          <style>{`@keyframes ord-toast-in { from { opacity:0; transform: translateX(16px) } to { opacity:1; transform:none } }`}</style>
          {toasts.map((t) => (
            <div key={t.key}
              className="pointer-events-auto flex items-center gap-3 p-3.5 rounded-2xl"
              style={{ background: "#0D1829", border: "1px solid rgba(34,211,166,0.35)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)", animation: "ord-toast-in .32s cubic-bezier(0.22,1,0.36,1)" }}>
              <span className="w-10 h-10 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: "rgba(34,211,166,0.14)" }}>
                <ShoppingBag size={18} style={{ color: "#22D3A6" }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight" style={{ color: "#E9EEF6" }}>Pesanan baru · Meja {t.table}</p>
                <p className="text-xs mt-0.5 tabular-nums" style={{ color: "#9FB6D1" }}>{t.items} item · {formatRupiah(t.total)}</p>
              </div>
              <button onClick={() => dismissToast(t.key)} className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Tutup">
                <X size={15} style={{ color: "#5A7898" }} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Filter tabs + alert toggle */}
      <div className="flex items-center gap-3 mb-5">
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
                  color: on ? "#FD5002" : "#5A7898",
                  border: `1px solid ${on ? "rgba(253,80,2,0.3)" : "rgba(255,255,255,0.07)"}`,
                }}
              >
                {t.l}
                <span className="text-xs tabular-nums" style={{ color: on ? "#FD5002" : "#5A7898" }}>
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
            color: alertsOn ? "#22D3A6" : "#5A7898",
            border: `1px solid ${alertsOn ? "rgba(34,211,166,0.3)" : "rgba(255,255,255,0.07)"}`,
          }}
          title={alertsOn ? "Alarm pesanan aktif (suara + notifikasi)" : "Aktifkan alarm pesanan baru"}
        >
          {alertsOn ? <BellRing size={15} /> : <BellOff size={15} />}
          <span className="hidden sm:inline">{alertsOn ? "Alarm Aktif" : "Alarm Mati"}</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
          <ShoppingBag size={38} style={{ color: "#5A7898" }} strokeWidth={1.2} />
          <p className="mt-4 font-semibold" style={{ color: "#E9EEF6" }}>Belum ada pesanan</p>
          <p className="text-sm mt-1" style={{ color: "#5A7898" }}>Pesanan baru akan muncul di sini secara otomatis</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((o) => {
            const meta = STATUS_META[o.status];
            const Icon = meta.icon;
            const items = Array.isArray(o.items) ? o.items : [];
            return (
              <div key={o.id_order} className="dash-card dash-reveal rounded-2xl p-5" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: "#E9EEF6" }}>Meja {o.table_number}</span>
                      <span className="text-xs flex items-center gap-1 group/id" style={{ color: "#5A7898" }}>
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
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: "#5A7898" }}>{relTime(o.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPreviewOrder(o)}
                      className="dash-press p-1.5 rounded-lg transition-colors duration-150"
                      style={{ color: "#5A7898", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                      title="Preview & Cetak Struk"
                      aria-label="Preview & Cetak Struk"
                    >
                      <Printer size={14} strokeWidth={1.8} />
                    </button>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>
                      <Icon size={12} /> {meta.label}
                    </span>
                  </div>
                </div>

                <ul className="space-y-1.5 mb-3">
                  {items.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span style={{ color: "#9FB6D1" }}>
                        <span style={{ color: "#E9EEF6", fontWeight: 600 }}>{it.qty}×</span> {it.nama_menu}
                      </span>
                      <span className="tabular-nums" style={{ color: "#5A7898" }}>{formatRupiah(it.harga_menu * it.qty)}</span>
                    </li>
                  ))}
                </ul>

                {o.notes && (
                  <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: "rgba(253,80,2,0.06)", border: "1px solid rgba(253,80,2,0.15)" }}>
                    <p style={{ color: "#FD5002", fontWeight: 600, marginBottom: "3px" }}>Catatan:</p>
                    <p style={{ color: "#E9EEF6", whiteSpace: "pre-wrap" }}>{o.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "#E9EEF6" }}>{formatRupiah(o.total)}</span>
                  {o.status === "ready" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#22D3A6" }}>
                      <CheckCircle2 size={14} /> Selesai
                    </span>
                  ) : (
                    <button
                      onClick={() => advance(o)}
                      disabled={pending && busyId === o.id_order}
                      className="dash-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
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
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
