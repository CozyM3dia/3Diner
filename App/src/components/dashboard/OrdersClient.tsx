"use client";

import { useEffect, useState, useTransition } from "react";
import { ShoppingBag, Clock, ChefHat, CheckCircle2, Loader2, Copy, Check } from "lucide-react";
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

function relTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

export default function OrdersClient({ initial, cafeId }: { initial: OrderRow[]; cafeId: string }) {
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
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={12} /> {meta.label}
                  </span>
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
