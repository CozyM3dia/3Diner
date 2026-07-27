"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/format";
import { acceptOrder, cancelOrder, completeOrder, markCashPaid } from "@/lib/kasir-actions";
import CancelOrderDialog from "@/components/kasir/CancelOrderDialog";
import KasirOrderSheet from "@/components/kasir/KasirOrderSheet";
import {
  AGE_LABEL,
  ageLevel,
  belongsInQueue,
  formatAge,
  itemSummary,
  minutesSince,
  needsCash,
} from "@/lib/kasir-queue-rules";
import type { OrderItem, OrderStatus } from "@/types";

export interface KasirOrder {
  id_order: string;
  table_number: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
  notes?: string | null;
  /** Potret tarif saat pesanan dibuat. Struk dan rincian memakai angka ini,
   *  bukan tarif kafe hari ini — kalau tidak, mengubah tarif akan menulis ulang
   *  nilai pesanan yang sudah terjadi. */
  subtotal?: number;
  tax_pct?: number;
  tax_amount?: number;
  service_pct?: number;
  service_amount?: number;
  prices_include_tax?: boolean;
}

export interface KasirTotals {
  completedCount: number;
  receivedAmount: number;
  cashAmount: number;
  qrisAmount: number;
}

interface Props {
  initial: KasirOrder[];
  totals: KasirTotals | null;
  cafeId: string;
  cafeName: string;
  cafeAddress?: string | null;
  staffName: string;
  /** `false` = pemilik belum pernah memutuskan tarif pajak. Ditampilkan apa
   *  adanya di rincian dan struk, bukan disembunyikan. */
  taxConfigured?: boolean;
  /** Jam buka, untuk baris identitas. Kosong = belum diisi pemilik. */
  openingHours?: string | null;
}

export default function KasirQueue({
  initial,
  totals,
  cafeId,
  cafeName,
  cafeAddress,
  staffName,
  taxConfigured,
  openingHours,
}: Props) {
  const [orders, setOrders] = useState<KasirOrder[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<KasirOrder | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Waktu sinkron terakhir yang berhasil. Dipakai untuk menyatakan sejak kapan
   *  layar ini mungkin usang — bukan sekadar "terjadi kesalahan". */
  const [lastSync, setLastSync] = useState<Date>(() => new Date());
  const [disconnected, setDisconnected] = useState(false);
  /** null sampai komponen ter-mount.
   *
   *  Jam server dan jam tablet tidak pernah sama persis, jadi umur yang dihitung
   *  saat render server berbeda satu menit dari hitungan pertama di klien —
   *  dan React membuang seluruh pohonnya karena teksnya tidak cocok. Umur baru
   *  dirender setelah mount, di mana hanya ada satu jam yang berlaku. */
  const [now, setNow] = useState<number | null>(null);
  const channelRef = useRef<ReturnType<typeof createClient>["channel"] extends never ? never : unknown>(null);

  // Umur baris dihitung ulang tiap 30 detik. Tidak lebih sering: satu-satunya
  // yang berubah adalah menit, dan render tiap detik membakar baterai tablet.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!cafeId) return;
    const supabase = createClient();
    let disposed = false;

    const channel = supabase
      .channel(`kasir-${cafeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Orders", filter: `cafe_id=eq.${cafeId}` },
        (payload) => {
          if (disposed) return;
          setLastSync(new Date());
          const row = payload.new as KasirOrder | null;

          setOrders((prev) => {
            if (payload.eventType === "DELETE") {
              const gone = payload.old as { id_order?: string };
              return prev.filter((o) => o.id_order !== gone.id_order);
            }
            if (!row?.id_order) return prev;

            // Pesanan terminal keluar dari antrean. Itu satu-satunya cara
            // daftar ini bisa benar-benar kosong.
            if (!belongsInQueue(row.status)) {
              return prev.filter((o) => o.id_order !== row.id_order);
            }

            const exists = prev.some((o) => o.id_order === row.id_order);
            if (exists) return prev.map((o) => (o.id_order === row.id_order ? { ...o, ...row } : o));
            return [...prev, row];
          });
        }
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setDisconnected(false);
          setLastSync(new Date());
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setDisconnected(true);
        }
      });

    channelRef.current = channel;
    return () => {
      disposed = true;
      supabase.removeChannel(channel);
    };
  }, [cafeId]);

  const run = useCallback(
    (id: string, fn: () => Promise<{ error?: string }>, optimisticRemove: boolean) => {
      setBusyId(id);
      setError(null);
      setMenuFor(null);
      startTransition(async () => {
        const result = await fn();
        if (result.error) {
          setError(result.error);
        } else if (optimisticRemove) {
          setOrders((prev) => prev.filter((o) => o.id_order !== id));
        }
        setBusyId(null);
      });
    },
    []
  );

  const incoming = orders.filter((o) => o.status === "received");
  const preparing = orders
    .filter((o) => o.status === "preparing" || o.status === "ready")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const isBusy = (id: string) => pending && busyId === id;

  function renderRow(o: KasirOrder, group: "incoming" | "preparing") {
    const mins = now === null ? null : minutesSince(o.created_at, now);
    const level = mins === null ? "normal" : ageLevel(mins);
    const cash = needsCash(o);

    return (
      <div key={o.id_order} className="kasir-row">
        {/* Baris adalah objek yang bisa dibuka. Yang membuka hanya bagian
            identitas dan isinya — tombol aksi tetap terpisah, supaya jari yang
            meleset sedikit tidak membuka lembar alih-alih menerima pesanan. */}
        <button
          className="kasir-open"
          onClick={() => setOpenFor(o.id_order)}
          aria-label={`Buka rincian pesanan ${o.table_number}`}
        >
          <span className="kasir-id">{o.table_number || "Tanpa meja"}</span>
          <span className="kasir-items" title={itemSummary(o.items)}>
            {itemSummary(o.items)}
          </span>
        </button>

        {group === "preparing" && mins !== null && (
          <span className="kasir-age" data-level={level}>
            {formatAge(mins)}
            {level !== "normal" ? ` · ${AGE_LABEL[level]}` : ""}
          </span>
        )}

        <span className="kasir-pay">
          {o.payment_status === "paid"
            ? `Sudah bayar · ${o.payment_method === "qris" ? "QRIS" : "Tunai"}`
            : `Belum bayar · ${formatRupiah(o.total)}`}
        </span>

        <span className="kasir-actions">
          {group === "incoming" ? (
            <button
              className="kasir-btn kasir-btn-solid"
              onClick={() => run(o.id_order, () => acceptOrder(o.id_order), false)}
              disabled={isBusy(o.id_order)}
            >
              {isBusy(o.id_order) ? <Loader2 size={13} className="animate-spin" /> : null}
              Terima
            </button>
          ) : cash ? (
            <button
              className="kasir-btn kasir-btn-solid"
              onClick={() => run(o.id_order, () => markCashPaid(o.id_order), false)}
              disabled={isBusy(o.id_order)}
            >
              {isBusy(o.id_order) ? <Loader2 size={13} className="animate-spin" /> : null}
              Terima tunai
            </button>
          ) : (
            <button
              className="kasir-btn kasir-btn-solid"
              onClick={() => run(o.id_order, () => completeOrder(o.id_order), true)}
              disabled={isBusy(o.id_order)}
            >
              {isBusy(o.id_order) ? <Loader2 size={13} className="animate-spin" /> : null}
              Selesai
            </button>
          )}

          <span className="kasir-more-wrap">
            <button
              className="kasir-btn kasir-more"
              aria-label={`Tindakan lain untuk pesanan ${o.table_number}`}
              aria-expanded={menuFor === o.id_order}
              onClick={() => setMenuFor((c) => (c === o.id_order ? null : o.id_order))}
            >
              <MoreHorizontal size={14} aria-hidden="true" />
            </button>
            {menuFor === o.id_order && (
              <span className="kasir-menu" role="menu">
                {group === "preparing" && cash && (
                  <button
                    role="menuitem"
                    className="kasir-menu-item"
                    onClick={() => run(o.id_order, () => completeOrder(o.id_order), true)}
                  >
                    Selesai tanpa bayar
                  </button>
                )}
                <button
                  role="menuitem"
                  className="kasir-menu-item"
                  onClick={() => {
                    setMenuFor(null);
                    setCancelFor(o);
                  }}
                >
                  Batalkan pesanan
                </button>
              </span>
            )}
          </span>
        </span>
      </div>
    );
  }

  const nothingLeft = orders.length === 0;
  /** Lembar dibaca dari daftar, bukan disalin ke state sendiri: kalau realtime
   *  mengubah pesanan sementara lembarnya terbuka, isinya ikut berubah. */
  const openOrder = openFor ? (orders.find((o) => o.id_order === openFor) ?? null) : null;

  return (
    <>
      <div className="kasir-bar">
        <h1 className="kasir-h1">Kasir</h1>
        <span className="kasir-sub">
          {cafeName}
          {openingHours ? ` · buka ${openingHours}` : ""}
        </span>
        <span className="kasir-sub kasir-push">{staffName}</span>
      </div>

      {disconnected && (
        <div className="kasir-state kasir-state-left" role="status">
          <p className="kasir-state-title">Pesanan baru tidak akan muncul</p>
          <p className="kasir-state-body">
            Koneksi terputus sejak {lastSync.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.
            Pesanan yang tamu kirim setelah jam itu belum terlihat di sini.
          </p>
          <button className="kasir-btn kasir-btn-solid kasir-state-cta" onClick={() => window.location.reload()}>
            Coba sambungkan lagi
          </button>
        </div>
      )}

      {error && (
        <div className="kasir-state kasir-state-left" role="alert">
          <p className="kasir-state-title">{error}</p>
        </div>
      )}

      {nothingLeft ? (
        <div className="kasir-state">
          <p className="kasir-state-title">Semua pesanan sudah ditangani</p>
          <p className="kasir-state-body">Pesanan baru dari QR meja akan muncul di sini.</p>
        </div>
      ) : (
        <>
          {incoming.length > 0 && (
            <section className="kasir-group" aria-label="Masuk">
              <div className="kasir-ghd">
                <span>
                  Masuk <b>{incoming.length}</b>
                </span>
                <span className="kasir-ghd-note">dari QR meja · belum dikonfirmasi</span>
              </div>
              {incoming.map((o) => renderRow(o, "incoming"))}
            </section>
          )}

          {preparing.length > 0 && (
            <section className="kasir-group" aria-label="Disiapkan">
              <div className="kasir-ghd">
                <span>
                  Disiapkan <b>{preparing.length}</b>
                </span>
                <span className="kasir-ghd-note">urut: menunggu paling lama</span>
              </div>
              {preparing.map((o) => renderRow(o, "preparing"))}
            </section>
          )}
        </>
      )}

      <div className="kasir-foot">
        <div>
          <div className="kasir-fig">{totals ? totals.completedCount : "—"}</div>
          <div className="kasir-sub">
            {totals ? "Pesanan selesai hari ini" : `Tidak tersedia sejak ${lastSync.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
          </div>
        </div>
        <div>
          <div className="kasir-fig">{totals ? formatRupiah(totals.receivedAmount) : "—"}</div>
          <div className="kasir-sub">
            {totals
              ? `Diterima · tunai ${formatRupiah(totals.cashAmount)} · QRIS ${formatRupiah(totals.qrisAmount)}`
              : "Diterima · tidak tersedia"}
          </div>
        </div>
      </div>

      {openOrder && (
        <KasirOrderSheet
          order={openOrder}
          cafeName={cafeName}
          cafeAddress={cafeAddress}
          taxConfigured={taxConfigured}
          busy={pending && busyId === openOrder.id_order}
          onClose={() => setOpenFor(null)}
          onAccept={() => run(openOrder.id_order, () => acceptOrder(openOrder.id_order), false)}
          onCash={() => run(openOrder.id_order, () => markCashPaid(openOrder.id_order), false)}
          onComplete={() => {
            run(openOrder.id_order, () => completeOrder(openOrder.id_order), true);
            setOpenFor(null);
          }}
          onCancel={() => {
            setOpenFor(null);
            setCancelFor(openOrder);
          }}
        />
      )}

      {cancelFor && (
        <CancelOrderDialog
          order={cancelFor}
          onClose={() => setCancelFor(null)}
          onConfirm={async (reason) => {
            const id = cancelFor.id_order;
            const result = await cancelOrder(id, reason);
            if (result.error) return result.error;
            setOrders((prev) => prev.filter((o) => o.id_order !== id));
            setCancelFor(null);
            return null;
          }}
        />
      )}
    </>
  );
}
