"use client";

import { useEffect, useState, useTransition } from "react";
import { ShoppingBag, Clock, ChefHat, CheckCircle2, Loader2, Copy, Check, Printer } from "lucide-react";
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

function printReceipt(order: OrderRow, cafeName: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }

  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const items = Array.isArray(order.items) ? order.items : [];

  const payLabel =
    order.payment_method === "qris" ? "QRIS"
    : order.payment_method === "cash" ? "Tunai"
    : "Belum Dibayar";

  const SEP32 = "--------------------------------";
  const SEP32D = "================================";

  const itemRows = items.map((it) => {
    const subtotal = (it.harga_menu * it.qty).toLocaleString("id-ID");
    return `
      <tr>
        <td style="vertical-align:top;padding-right:6px;white-space:nowrap;">${it.qty}x</td>
        <td style="vertical-align:top;width:100%;word-break:break-word;">${it.nama_menu}</td>
        <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:4px;">Rp ${subtotal}</td>
      </tr>`;
  }).join("");

  const notesBlock = order.notes
    ? `<div class="notes-box">** CATATAN **<br>${order.notes}</div>`
    : "";

  const totalStr = order.total.toLocaleString("id-ID");
  const orderId = order.id_order.slice(-8).toUpperCase();

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Struk #${orderId}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{
    font-family:'Courier New',Consolas,'Lucida Console',monospace;
    font-size:11.5px;
    line-height:1.45;
    width:76mm;
    max-width:76mm;
    padding:4mm 3mm 8mm;
    color:#000;
    background:#fff;
  }
  .c{text-align:center;}
  .r{text-align:right;}
  .b{font-weight:bold;}
  .cafe-name{font-size:15px;font-weight:bold;text-align:center;letter-spacing:1.5px;margin-bottom:1px;}
  .pos-sub{font-size:9.5px;text-align:center;margin-bottom:3px;}
  .sep{font-size:11px;letter-spacing:0px;margin:3px 0;}
  .meja{font-size:22px;font-weight:bold;text-align:center;margin:3px 0 2px;}
  .meta{font-size:10.5px;margin:1px 0;}
  table{width:100%;border-collapse:collapse;}
  td{padding:1px 0;font-size:11px;}
  .total-line{margin-top:5px;padding-top:4px;border-top:1px dashed #000;}
  .total-lbl{font-size:12px;font-weight:bold;}
  .total-val{font-size:13px;font-weight:bold;text-align:right;}
  .notes-box{border:1px dashed #000;padding:4px 5px;margin:5px 0;font-weight:bold;font-size:11px;word-break:break-word;}
  .footer{text-align:center;font-size:10px;margin-top:3px;}
  @media print{
    body{margin:0;padding:2mm 2mm 6mm;}
    @page{margin:0;size:80mm auto;}
  }
</style>
</head>
<body>
  <div class="cafe-name">${cafeName}</div>
  <div class="pos-sub">POS 3Diner</div>
  <div class="sep c">${SEP32D}</div>
  <div class="c b" style="font-size:12px;">STRUK PESANAN</div>
  <div class="sep c">${SEP32}</div>
  <div class="meja">MEJA ${order.table_number}</div>
  <div class="sep c">${SEP32}</div>
  <div class="meta"><span class="b">ID    :</span> #${orderId}</div>
  <div class="meta"><span class="b">Tgl   :</span> ${dateStr}  ${timeStr}</div>
  <div class="meta"><span class="b">Bayar :</span> ${payLabel}</div>
  <div class="sep c">${SEP32}</div>
  <table><tbody>${itemRows}</tbody></table>
  <div class="sep c">${SEP32}</div>
  <table>
    <tr>
      <td class="total-lbl">TOTAL</td>
      <td class="total-val">Rp ${totalStr}</td>
    </tr>
  </table>
  ${notesBlock}
  <div class="sep c">${SEP32D}</div>
  <div class="footer">Terima kasih telah berkunjung!</div>
  <div class="footer">Dicetak via POS 3Diner</div>
  <div style="height:6mm;"></div>
</body>
</html>`;

  doc.open();
  doc.write(html);
  doc.close();

  // Give browser time to parse & layout before triggering print
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 1000);
  }, 300);
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

  function handleCopy(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

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
            setOrders((prev) => (prev.some((o) => o.id_order === row.id_order) ? prev : [row, ...prev]));
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
      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
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
                      onClick={() => printReceipt(o, cafeName)}
                      className="dash-press p-1.5 rounded-lg transition-colors duration-150"
                      style={{ color: "#5A7898", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                      title="Cetak Struk"
                      aria-label="Cetak Struk"
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
