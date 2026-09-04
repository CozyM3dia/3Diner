"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  BanIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChefHatIcon,
  ClipboardListIcon,
  ClockIcon,
  Columns3Icon,
  InboxIcon,
  LayoutListIcon,
  type LucideIcon,
  PackageCheckIcon,
  PrinterIcon,
  ReceiptTextIcon,
  SearchIcon,
  StickyNoteIcon,
  TimerIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import Petunjuk from "@/components/dp/Petunjuk";
import { updateOrderStatus } from "@/lib/dashboard-actions";
import { cancelOrder } from "@/lib/kasir-actions";
import { buildReceiptHtml, printReceipt } from "@/lib/receipt-html";
import { createClient } from "@/lib/supabase/client";

/** Papan Pesanan konsol owner (rebuild 5 Sep 2026).
 *
 *  Dua tampilan atas data yang sama:
 *  • "daftar" — baris padat berkepala lengket untuk memindai & mencari
 *    seluruh jendela 30 hari sekaligus. Ini yang dibuka pertama.
 *  • "kanban" — empat kolom pipeline untuk mengerjakan antrean hari ini.
 *
 *  Aturan yang dipegang rebuild ini:
 *  1. Satu pesanan punya kemampuan yang sama di mana pun ia dilihat. Versi
 *     lama hanya memberi tombol di kanban dan menandai kartu grid
 *     "diubah melalui Kasir" — sumber kebingungan, bukan pengaman.
 *  2. Setiap mutasi lewat jalur server yang sudah ada (`updateOrderStatus`,
 *     `cancelOrder`) — sama persis dengan konsol Kasir. Tidak ada tombol hias.
 *  3. Rincian harga di panel detail dibaca dari potret pesanan, bukan
 *     dihitung ulang di browser: tarif pajak kafe bisa sudah berubah sejak
 *     pesanan dibuat, dan laporan lama harus tetap bisa direkonsiliasi. */

export type BoardOrder = {
  id_order: string;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  table_number: string | null;
  total: number | null;
  subtotal?: number | null;
  tax_pct?: number | null;
  tax_amount?: number | null;
  service_pct?: number | null;
  service_amount?: number | null;
  prices_include_tax?: boolean | null;
  items: { nama_menu?: string | null; qty?: number | null; harga_menu?: number | null }[];
  notes?: string | null;
  cancelled_reason?: string | null;
};

export type BoardCafe = {
  name: string;
  address: string | null;
  logoUrl: string | null;
  taxConfigured: boolean;
  cashierName: string;
  /** Preferensi Pengaturan Struk — diteruskan mentah ke builder struk. */
  receipt: Record<string, unknown> | null;
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const jam = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");
const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/** Umur manusiawi — dipakai panel detail untuk menyorot pesanan yang menua. */
function umurLabel(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const j = Math.floor(m / 60);
  if (j < 24) return `${j} jam lalu`;
  return `${Math.floor(j / 24)} hari lalu`;
}

/** Nomor tampilan mengikuti seluruh konsol: 5 karakter terakhir UUID. */
const nomor = (id: string) => `#${id.slice(-5)}`;

const mejaLabel = (t: string | null) =>
  !t?.trim() ? "Take Away" : /^(bungkus|delivery|take ?away)$/i.test(t.trim()) ? t.trim() : `Meja ${t.trim()}`;

/** Nada warna: satu peta untuk KPI, chip status, dan kepala kolom kanban.
 *  Nilainya adalah nama token yang didefinisikan di pesanan.css untuk kedua
 *  tema, jadi tidak ada heks yang tertanam di TSX. */
type Tone = "all" | "wait" | "ready" | "done" | "due" | "void";
const toneVars = (t: Tone) =>
  ({ "--psn-tone-ink": `var(--psn-${t}-ink)`, "--psn-tone-bg": `var(--psn-${t}-bg)` }) as React.CSSProperties;

const STATUS_TEXT: Record<string, string> = {
  awaiting: "Menunggu",
  awaiting_checkin: "Menunggu",
  received: "Baru",
  preparing: "Diproses",
  ready: "Siap",
  on_delivery: "Diantar",
  completed: "Selesai",
  cancelled: "Batal",
};

const STATUS_TONE: Record<string, Tone> = {
  awaiting: "wait",
  awaiting_checkin: "wait",
  received: "wait",
  preparing: "ready",
  ready: "ready",
  on_delivery: "ready",
  completed: "done",
  cancelled: "void",
};

const STATUS_CHIP: Record<Tone, string> = {
  all: "",
  wait: "psn-chip-wait",
  ready: "psn-chip-ready",
  done: "psn-chip-done",
  due: "",
  void: "psn-chip-void",
};

const TABS = [
  { key: "semua", label: "Semua" },
  { key: "awaiting", label: "Menunggu" },
  { key: "preparing", label: "Diproses" },
  { key: "ready", label: "Siap Diantar" },
  { key: "completed", label: "Selesai" },
  { key: "cancelled", label: "Dibatalkan" },
] as const;

/** Kolom kanban: anggota = status pipeline yang digabung ke kolom tsb. */
const KANBAN_COLS: Array<{
  key: string;
  label: string;
  tone: Tone;
  icon: LucideIcon;
  anggota: readonly string[];
}> = [
  { key: "baru", label: "Pesanan Baru", tone: "wait", icon: ClipboardListIcon, anggota: ["awaiting", "awaiting_checkin", "received"] },
  { key: "proses", label: "Diproses", tone: "ready", icon: ChefHatIcon, anggota: ["preparing", "ready", "on_delivery"] },
  { key: "selesai", label: "Selesai", tone: "done", icon: CheckCircle2Icon, anggota: ["completed"] },
  { key: "batal", label: "Dibatalkan", tone: "void", icon: BanIcon, anggota: ["cancelled"] },
];

/** Alasan batal preset — sama dengan dialog Kasir (CancelOrderDialog). */
const PRESET_BATAL = ["Tamu batal memesan", "Stok bahan habis", "Salah input meja", "Pesanan ganda"];

/** Langkah berikut yang sah untuk sebuah status. `null` = tahap terminal.
 *  Satu-satunya sumber kebenaran untuk tombol baris DAN tombol kartu, supaya
 *  dua tampilan tidak bisa menawarkan transisi yang berbeda. */
function langkahBerikut(status: string): { ke: "preparing" | "completed"; label: string; icon: LucideIcon } | null {
  if (["awaiting", "awaiting_checkin", "received"].includes(status)) {
    return { ke: "preparing", label: "Proses", icon: ChefHatIcon };
  }
  if (["preparing", "ready", "on_delivery"].includes(status)) {
    return { ke: "completed", label: "Selesaikan", icon: CheckIcon };
  }
  return null;
}

function gabungPesanan(lama: BoardOrder | undefined, baris: Record<string, unknown>): BoardOrder | null {
  const id = typeof baris.id_order === "string" ? baris.id_order : lama?.id_order;
  if (!id) return lama ?? null;
  const angka = (k: string, jatuh: number | null | undefined) =>
    typeof baris[k] === "number" ? (baris[k] as number) : jatuh ?? null;
  return {
    id_order: id,
    created_at:
      typeof baris.created_at === "string" && baris.created_at ? baris.created_at : lama?.created_at ?? "",
    status: typeof baris.status === "string" ? baris.status : lama?.status ?? "awaiting",
    payment_status:
      typeof baris.payment_status === "string" ? baris.payment_status : lama?.payment_status ?? "unpaid",
    payment_method:
      "payment_method" in baris ? (baris.payment_method as string | null) : lama?.payment_method ?? null,
    table_number:
      "table_number" in baris ? (baris.table_number as string | null) : lama?.table_number ?? null,
    total: angka("total", lama?.total),
    subtotal: angka("subtotal", lama?.subtotal),
    tax_pct: angka("tax_pct", lama?.tax_pct),
    tax_amount: angka("tax_amount", lama?.tax_amount),
    service_pct: angka("service_pct", lama?.service_pct),
    service_amount: angka("service_amount", lama?.service_amount),
    prices_include_tax:
      typeof baris.prices_include_tax === "boolean"
        ? baris.prices_include_tax
        : lama?.prices_include_tax ?? null,
    items: Array.isArray(baris.items) ? (baris.items as BoardOrder["items"]) : lama?.items ?? [],
    notes: "notes" in baris ? (baris.notes as string | null) : lama?.notes ?? null,
    cancelled_reason:
      "cancelled_reason" in baris
        ? (baris.cancelled_reason as string | null)
        : lama?.cancelled_reason ?? null,
  };
}

export default function OrdersBoard({
  orders,
  cafe,
  cafeId,
}: {
  orders: BoardOrder[];
  cafe: BoardCafe;
  cafeId: string;
}) {
  // Salinan lokal untuk mutasi optimis — prop baru (revalidasi) selalu menang.
  const [rows, setRows] = useState<BoardOrder[]>(orders);
  const [lastProp, setLastProp] = useState<BoardOrder[]>(orders);
  if (orders !== lastProp) {
    setLastProp(orders);
    setRows(prev => {
      const byId = new Map(orders.map(o => [o.id_order, o]));
      for (const o of prev) {
        if (!byId.has(o.id_order)) byId.set(o.id_order, o);
      }
      return [...byId.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    });
  }

  const [tab, setTab] = useState<string>("semua");
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"daftar" | "kanban">("daftar");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);
  const [batalFor, setBatalFor] = useState<BoardOrder | null>(null);
  const [liveOn, setLiveOn] = useState(false);

  useEffect(() => {
    if (!cafeId) return;
    const supabase = createClient();
    let disposed = false;
    const channel = supabase
      .channel(`pesanan-${cafeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Orders", filter: `cafe_id=eq.${cafeId}` },
        payload => {
          if (disposed) return;
          setRows(prev => {
            if (payload.eventType === "DELETE") {
              const gone = payload.old as { id_order?: string };
              return prev.filter(o => o.id_order !== gone.id_order);
            }
            const baris = payload.new as Record<string, unknown>;
            const next = gabungPesanan(
              prev.find(o => o.id_order === baris.id_order),
              baris,
            );
            if (!next) return prev;
            if (prev.some(o => o.id_order === next.id_order)) {
              return prev.map(o => (o.id_order === next.id_order ? next : o));
            }
            return [next, ...prev];
          });
        },
      )
      // Lencana "Langsung" hanya menyala kalau kanalnya benar-benar tersambung.
      // Lencana yang selalu hijau tidak memberi tahu apa pun.
      .subscribe(status => {
        if (!disposed) setLiveOn(status === "SUBSCRIBED");
      });
    return () => {
      disposed = true;
      setLiveOn(false);
      supabase.removeChannel(channel);
    };
  }, [cafeId]);

  // Tutup panel/dialog dengan Escape.
  useEffect(() => {
    if (!openId && !batalFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (batalFor) setBatalFor(null);
      else setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId, batalFor]);

  const count = useCallback(
    (key: string) => (key === "semua" ? rows.length : rows.filter(o => o.status === key).length),
    [rows],
  );

  const unpaid = rows.filter(o => o.payment_status !== "paid" && o.status !== "cancelled").length;

  const filtered = useMemo(() => {
    let base = tab === "semua" ? rows : rows.filter(o => o.status === tab);
    if (onlyUnpaid) base = base.filter(o => o.payment_status !== "paid" && o.status !== "cancelled");
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      o =>
        o.id_order.toLowerCase().includes(needle) ||
        (o.table_number ?? "").toLowerCase().includes(needle) ||
        (o.notes ?? "").toLowerCase().includes(needle) ||
        o.items.some(it => (it.nama_menu ?? "").toLowerCase().includes(needle)),
    );
  }, [rows, tab, q, onlyUnpaid]);

  /** Enam kartu KPI. Bukan hiasan: menekan satu memasang saringannya, dan
   *  menekan lagi melepasnya — angka dan daftar tidak bisa berbeda cerita. */
  const kpis: Array<{ key: string; icon: LucideIcon; tone: Tone; label: string; n: number; aktif: boolean }> = [
    { key: "semua", icon: ReceiptTextIcon, tone: "all", label: "Semua Pesanan", n: rows.length, aktif: tab === "semua" && !onlyUnpaid },
    { key: "awaiting", icon: TimerIcon, tone: "wait", label: "Menunggu", n: count("awaiting"), aktif: tab === "awaiting" && !onlyUnpaid },
    { key: "ready", icon: PackageCheckIcon, tone: "ready", label: "Siap Diantar", n: count("ready"), aktif: tab === "ready" && !onlyUnpaid },
    { key: "completed", icon: CheckCircle2Icon, tone: "done", label: "Selesai", n: count("completed"), aktif: tab === "completed" && !onlyUnpaid },
    { key: "unpaid", icon: WalletIcon, tone: "due", label: "Belum Bayar", n: unpaid, aktif: onlyUnpaid },
    { key: "cancelled", icon: BanIcon, tone: "void", label: "Dibatalkan", n: count("cancelled"), aktif: tab === "cancelled" && !onlyUnpaid },
  ];

  function pilihKpi(key: string) {
    setPesan(null);
    if (key === "unpaid") {
      setOnlyUnpaid(v => !v);
      setTab("semua");
      return;
    }
    setOnlyUnpaid(false);
    setTab(prev => (prev === key ? "semua" : key));
  }

  function resetSaringan() {
    setTab("semua");
    setOnlyUnpaid(false);
    setQ("");
  }

  function gantiStatusLokal(id: string, status: string) {
    setRows(rs => rs.map(o => (o.id_order === id ? { ...o, status } : o)));
  }

  /** Proses / Selesai — jalur server sama dengan yang dipakai konsol Kasir. */
  async function ubahStatus(o: BoardOrder, status: "preparing" | "completed") {
    setBusyId(o.id_order);
    setPesan(null);
    const res = await updateOrderStatus(o.id_order, status);
    setBusyId(null);
    if (res.error) {
      setPesan({ ok: false, text: res.error });
      return;
    }
    gantiStatusLokal(o.id_order, status);
    setPesan({ ok: true, text: `Pesanan ${nomor(o.id_order)} → ${STATUS_TEXT[status]}.` });
  }

  /** Cetak struk — builder & preferensi sama dengan printer POS. */
  function cetakStruk(o: BoardOrder) {
    printReceipt(
      buildReceiptHtml(
        {
          id_order: o.id_order,
          table_number: o.table_number ?? "",
          items: o.items.map(it => ({
            id_menu: "",
            nama_menu: it.nama_menu ?? "Item",
            harga_menu: it.harga_menu ?? 0,
            qty: it.qty ?? 1,
          })),
          total: o.total ?? 0,
          payment_method: (o.payment_method ?? null) as never,
          payment_status: o.payment_status,
          created_at: o.created_at,
          notes: o.notes ?? null,
        },
        {
          name: cafe.name,
          address: cafe.address,
          logoUrl: cafe.logoUrl,
          cashierName: cafe.cashierName,
          taxConfigured: cafe.taxConfigured,
          receipt: cafe.receipt,
        },
      ),
    );
  }

  const detail = openId ? rows.find(o => o.id_order === openId) ?? null : null;
  const adaSaringan = tab !== "semua" || onlyUnpaid || q.trim() !== "";

  return (
    <div className="psn">
      <header className="psn-head">
        <div>
          <h1>Pesanan</h1>
          <p>Jendela 30 hari terakhir · {rows.length} pesanan</p>
        </div>
        <div className="psn-head-side">
          <span className={liveOn ? "psn-live psn-live-on" : "psn-live"}>
            <i aria-hidden />
            {liveOn ? "Langsung" : "Tersambung ulang…"}
          </span>
          <Petunjuk judul="Saringan & tampilan" bab="pesanan" align="end">
            Papan membaca jendela 30 hari, bukan hari ini saja, jadi pesanan lama yang masih terbuka tetap terlihat.
            Kartu angka di atas juga tombol saringan. Daftar untuk memindai dan mencari, kanban untuk mengerjakan
            antrean; tombol di keduanya memanggil jalur server yang sama dengan konsol Kasir.
          </Petunjuk>
        </div>
      </header>

      {/* ══════════ KPI — sekaligus saringan ══════════ */}
      <section className="psn-kpis" aria-label="Ringkasan pesanan">
        {kpis.map(k => (
          <button
            key={k.key}
            type="button"
            className="psn-kpi"
            style={toneVars(k.tone)}
            aria-pressed={k.aktif}
            onClick={() => pilihKpi(k.key)}
          >
            <span className="psn-kpi-ic">
              <k.icon size={18} />
            </span>
            <span className="psn-kpi-txt">
              <span className="psn-kpi-lbl">{k.label}</span>
              <span className="psn-kpi-n">{k.n}</span>
            </span>
          </button>
        ))}
      </section>

      {/* ══════════ Toolbar ══════════ */}
      <section className="psn-bar">
        <div className="psn-tabs" role="tablist" aria-label="Saring pesanan menurut status">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? "psn-tab psn-tab-on" : "psn-tab"}
              onClick={() => {
                setTab(t.key);
                setOnlyUnpaid(false);
              }}
            >
              {t.label}
              <span className="psn-tab-n">{count(t.key)}</span>
            </button>
          ))}
        </div>

        <div className="psn-bar-right">
          <label className="psn-search">
            <SearchIcon size={15} aria-hidden />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari token, meja, menu, catatan…"
              aria-label="Cari pesanan"
            />
            {q && (
              <button type="button" className="psn-search-x" aria-label="Bersihkan pencarian" onClick={() => setQ("")}>
                <XIcon size={14} />
              </button>
            )}
          </label>
          <div className="psn-views" role="group" aria-label="Tampilan papan">
            <button
              type="button"
              className="psn-view"
              aria-pressed={view === "daftar"}
              onClick={() => setView("daftar")}
            >
              <LayoutListIcon aria-hidden /> Daftar
            </button>
            <button
              type="button"
              className="psn-view"
              aria-pressed={view === "kanban"}
              onClick={() => setView("kanban")}
            >
              <Columns3Icon aria-hidden /> Kanban
            </button>
          </div>
        </div>
      </section>

      {pesan && (
        <p className={pesan.ok ? "psn-toast psn-toast-ok" : "psn-toast psn-toast-err"} role="status">
          {pesan.ok ? <CheckCircle2Icon aria-hidden /> : <AlertCircleIcon aria-hidden />}
          {pesan.text}
        </p>
      )}

      {/* ══════════ Tampilan daftar ══════════ */}
      {view === "daftar" ? (
        <section className="psn-list" aria-label="Daftar pesanan">
          <div className="psn-row psn-rowhead" role="presentation">
            <span>Pesanan</span>
            <span className="psn-c-items">Item</span>
            <span className="psn-c-time">Waktu</span>
            <span className="psn-c-total">Total</span>
            <span className="psn-c-pay">Bayar</span>
            <span className="psn-c-status">Status</span>
            <span className="psn-c-act">Aksi</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState adaSaringan={adaSaringan} onReset={resetSaringan} />
          ) : (
            <div className="psn-scroll">
              {filtered.map(o => (
                <OrderRow
                  key={o.id_order}
                  o={o}
                  busy={busyId === o.id_order}
                  onOpen={() => setOpenId(o.id_order)}
                  onNext={ke => ubahStatus(o, ke)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* ══════════ Tampilan kanban ══════════ */
        <section className="psn-kb" aria-label="Papan pesanan per tahap">
          {KANBAN_COLS.map(col => {
            const list = filtered.filter(o => col.anggota.includes(o.status));
            return (
              <div key={col.key} className="psn-kb-col" style={toneVars(col.tone)}>
                <header className="psn-kb-head">
                  <col.icon aria-hidden />
                  <span>{col.label}</span>
                  <span className="psn-kb-n">{list.length}</span>
                </header>
                <div className="psn-kb-list">
                  {list.length === 0 ? (
                    <p className="psn-kb-empty">Tidak ada pesanan di tahap ini.</p>
                  ) : (
                    list.map(o => (
                      <OrderCard
                        key={o.id_order}
                        o={o}
                        busy={busyId === o.id_order}
                        onOpen={() => setOpenId(o.id_order)}
                        onNext={ke => ubahStatus(o, ke)}
                        onBatal={() => setBatalFor(o)}
                        onCetak={() => cetakStruk(o)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ══════════ Panel detail ══════════ */}
      {detail && (
        <DetailDrawer
          o={detail}
          busy={busyId === detail.id_order}
          onClose={() => setOpenId(null)}
          onNext={ke => ubahStatus(detail, ke)}
          onBatal={() => setBatalFor(detail)}
          onCetak={() => cetakStruk(detail)}
        />
      )}

      {/* ══════════ Dialog alasan batal ══════════ */}
      {batalFor && (
        <BatalDialog
          o={batalFor}
          onClose={() => setBatalFor(null)}
          onDone={(ok, text) => {
            if (ok) gantiStatusLokal(batalFor.id_order, "cancelled");
            setBatalFor(null);
            setPesan({ ok, text });
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

function EmptyState({ adaSaringan, onReset }: { adaSaringan: boolean; onReset: () => void }) {
  return (
    <div className="psn-empty">
      <InboxIcon aria-hidden />
      <b>{adaSaringan ? "Tidak ada pesanan yang cocok" : "Belum ada pesanan"}</b>
      <span>
        {adaSaringan
          ? "Saringan atau kata kunci menyisakan nol pesanan."
          : "Pesanan baru muncul di sini seketika, tanpa perlu memuat ulang."}
      </span>
      {adaSaringan && (
        <button type="button" onClick={onReset}>
          Bersihkan saringan
        </button>
      )}
    </div>
  );
}

/** Ringkasan item satu baris: "2× Nasi Goreng · 1× Es Teh". */
function ringkasItem(items: BoardOrder["items"]): { teks: string; sisa: number } {
  const tampil = items.slice(0, 2).map(it => `${it.qty ?? 1}× ${it.nama_menu ?? "Item"}`);
  return { teks: tampil.join(" · ") || "Tanpa item", sisa: Math.max(0, items.length - 2) };
}

function StatusChip({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "wait";
  return <span className={`psn-chip ${STATUS_CHIP[tone]}`}>{STATUS_TEXT[status] ?? status}</span>;
}

function PayChip({ paid }: { paid: boolean }) {
  return (
    <span className={paid ? "psn-chip psn-pay psn-pay-paid" : "psn-chip psn-pay psn-pay-due"}>
      {paid ? "Lunas" : "Belum bayar"}
    </span>
  );
}

/* ── Baris daftar ── */
function OrderRow({
  o,
  busy,
  onOpen,
  onNext,
}: {
  o: BoardOrder;
  busy: boolean;
  onOpen: () => void;
  onNext: (ke: "preparing" | "completed") => void;
}) {
  const tone = STATUS_TONE[o.status] ?? "wait";
  const next = langkahBerikut(o.status);
  const { teks, sisa } = ringkasItem(o.items);

  return (
    <div
      className={`psn-row psn-rowbody${o.status === "cancelled" ? " psn-row-void" : ""}`}
      style={toneVars(tone)}
      role="button"
      tabIndex={0}
      aria-label={`Buka detail pesanan ${nomor(o.id_order)}`}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <span className="psn-c-order">
        <span className="psn-ic">
          <ReceiptTextIcon aria-hidden />
        </span>
        <span className="psn-c-order-txt">
          <span className="psn-no">{nomor(o.id_order)}</span>
          <span className="psn-meja">{mejaLabel(o.table_number)}</span>
        </span>
      </span>

      <span className="psn-c-items">
        <span className="psn-items-line">{teks}</span>
        {sisa > 0 && <span className="psn-items-more">+{sisa} item lainnya</span>}
      </span>

      <span className="psn-c-time">{jam(o.created_at)}</span>
      <span className="psn-c-total">{rupiah(o.total ?? 0)}</span>
      <span className="psn-c-pay">
        <PayChip paid={o.payment_status === "paid"} />
      </span>
      <span className="psn-c-status">
        <StatusChip status={o.status} />
      </span>

      {/* Aksi tidak boleh ikut membuka panel — klik dihentikan di sini. */}
      <span className="psn-c-act" onClick={e => e.stopPropagation()} role="presentation">
        {next ? (
          <button
            type="button"
            className="psn-next"
            disabled={busy}
            onClick={() => onNext(next.ke)}
            aria-label={`${next.label} pesanan ${nomor(o.id_order)}`}
          >
            <next.icon aria-hidden />
            {busy ? "Memproses…" : next.label}
          </button>
        ) : (
          <button type="button" className="psn-next psn-next-ghost" onClick={onOpen}>
            Detail
          </button>
        )}
      </span>
    </div>
  );
}

/* ── Kartu kanban ── */
function OrderCard({
  o,
  busy,
  onOpen,
  onNext,
  onBatal,
  onCetak,
}: {
  o: BoardOrder;
  busy: boolean;
  onOpen: () => void;
  onNext: (ke: "preparing" | "completed") => void;
  onBatal: () => void;
  onCetak: () => void;
}) {
  const tone = STATUS_TONE[o.status] ?? "wait";
  const next = langkahBerikut(o.status);
  const shown = o.items.slice(0, 3);

  return (
    <article className="psn-card" style={toneVars(tone)}>
      <header className="psn-card-head">
        <span className="psn-ic">
          <ReceiptTextIcon aria-hidden />
        </span>
        <button
          type="button"
          className="psn-card-id"
          onClick={onOpen}
          aria-label={`Buka detail pesanan ${nomor(o.id_order)}`}
        >
          <span className="psn-no">{nomor(o.id_order)}</span>
          <span className="psn-meja">{mejaLabel(o.table_number)}</span>
        </button>
        <PayChip paid={o.payment_status === "paid"} />
      </header>

      <div className="psn-card-meta">
        <span>
          <ClockIcon aria-hidden /> {jam(o.created_at)}
        </span>
        <b>{rupiah(o.total ?? 0)}</b>
      </div>

      <ul className="psn-lines">
        {shown.map((it, i) => (
          <li key={`${o.id_order}-${i}`}>
            <span className="psn-line-name">{it.nama_menu ?? "Item"}</span>
            <span className="psn-line-dots" aria-hidden />
            <span className="psn-line-qty">×{it.qty ?? 1}</span>
          </li>
        ))}
        {o.items.length > 3 && <li className="psn-lines-more">+{o.items.length - 3} item lainnya</li>}
      </ul>

      {o.notes && (
        <p className="psn-note">
          <StickyNoteIcon aria-hidden /> {o.notes}
        </p>
      )}

      {o.status === "cancelled" ? (
        <p className="psn-note">
          <BanIcon aria-hidden /> {o.cancelled_reason?.trim() || "Dibatalkan — tidak dapat diubah."}
        </p>
      ) : (
        <div className="psn-card-btns">
          {next ? (
            <>
              <button type="button" className="psn-btn psn-btn-danger" disabled={busy} onClick={onBatal}>
                Batalkan
              </button>
              <button
                type="button"
                className="psn-btn psn-btn-primary"
                disabled={busy}
                onClick={() => onNext(next.ke)}
              >
                {busy ? "Memproses…" : next.label}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="psn-btn" onClick={onCetak}>
                <PrinterIcon aria-hidden /> Struk
              </button>
              <button type="button" className="psn-btn" onClick={onOpen}>
                Detail
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

/* ── Panel detail (drawer kanan) ── */
function DetailDrawer({
  o,
  busy,
  onClose,
  onNext,
  onBatal,
  onCetak,
}: {
  o: BoardOrder;
  busy: boolean;
  onClose: () => void;
  onNext: (ke: "preparing" | "completed") => void;
  onBatal: () => void;
  onCetak: () => void;
}) {
  const next = langkahBerikut(o.status);
  const total = o.total ?? 0;
  // Rincian hanya ditampilkan kalau potretnya memang ada. Menambal angka
  // yang hilang dengan hitungan browser akan menyajikan tebakan sebagai fakta.
  const adaRincian = typeof o.subtotal === "number";

  return (
    <div className="psn-drawer-root" role="presentation">
      <div className="psn-drawer-bd" onClick={onClose} role="presentation" />
      <aside
        className="psn-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail pesanan ${nomor(o.id_order)}`}
      >
        <header className="psn-dw-head">
          <div>
            <h2>{nomor(o.id_order)}</h2>
            <p className="psn-dw-sub">
              {mejaLabel(o.table_number)} · {tanggal(o.created_at)}, {jam(o.created_at)}
            </p>
            <div className="psn-dw-chips">
              <StatusChip status={o.status} />
              <PayChip paid={o.payment_status === "paid"} />
            </div>
          </div>
          <button type="button" className="psn-dw-x" aria-label="Tutup detail" onClick={onClose}>
            <XIcon size={15} />
          </button>
        </header>

        <div className="psn-dw-body">
          <section className="psn-dw-sec">
            <h3>Ringkas</h3>
            <div className="psn-dw-facts">
              <dl className="psn-fact">
                <dt>Masuk</dt>
                <dd>{umurLabel(o.created_at)}</dd>
              </dl>
              <dl className="psn-fact">
                <dt>Jumlah item</dt>
                <dd>{o.items.reduce((s, it) => s + (it.qty ?? 1), 0)} porsi</dd>
              </dl>
              <dl className="psn-fact">
                <dt>Metode bayar</dt>
                <dd>{o.payment_method ? o.payment_method.toUpperCase() : "Belum dipilih"}</dd>
              </dl>
              <dl className="psn-fact">
                <dt>Token</dt>
                <dd title={o.id_order}>{o.id_order.slice(0, 8)}</dd>
              </dl>
            </div>
          </section>

          <section className="psn-dw-sec">
            <h3>Item dipesan</h3>
            {o.items.length === 0 ? (
              <p className="psn-note">Pesanan ini tidak memuat rincian item.</p>
            ) : (
              <ul className="psn-dw-items">
                {o.items.map((it, i) => {
                  const qty = it.qty ?? 1;
                  const harga = it.harga_menu ?? 0;
                  return (
                    <li key={`${o.id_order}-d-${i}`}>
                      <span className="psn-dw-item-name">{it.nama_menu ?? "Item"}</span>
                      <span className="psn-dw-item-amt">{rupiah(harga * qty)}</span>
                      <span className="psn-dw-item-calc">
                        {qty} × {rupiah(harga)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {o.notes && (
            <section className="psn-dw-sec">
              <h3>Catatan</h3>
              <p className="psn-note">
                <StickyNoteIcon aria-hidden /> {o.notes}
              </p>
            </section>
          )}

          {o.status === "cancelled" && (
            <section className="psn-dw-sec">
              <h3>Alasan pembatalan</h3>
              <p className="psn-note">
                <BanIcon aria-hidden /> {o.cancelled_reason?.trim() || "Alasan tidak tercatat."}
              </p>
            </section>
          )}

          <section className="psn-dw-sec">
            <h3>Rincian pembayaran</h3>
            <div className="psn-dw-sum">
              {adaRincian ? (
                <>
                  <div className="psn-dw-sum-row">
                    <span>Subtotal</span>
                    <b>{rupiah(o.subtotal ?? 0)}</b>
                  </div>
                  {(o.service_amount ?? 0) > 0 && (
                    <div className="psn-dw-sum-row">
                      <span>Service ({o.service_pct ?? 0}%)</span>
                      <b>{rupiah(o.service_amount ?? 0)}</b>
                    </div>
                  )}
                  <div className="psn-dw-sum-row">
                    <span>
                      Pajak ({o.tax_pct ?? 0}%){o.prices_include_tax ? " · sudah termasuk" : ""}
                    </span>
                    <b>{rupiah(o.tax_amount ?? 0)}</b>
                  </div>
                </>
              ) : (
                <p className="psn-note">
                  Pesanan ini dibuat sebelum rincian pajak dipotret, jadi hanya totalnya yang tercatat.
                </p>
              )}
              <div className="psn-dw-total">
                <span>Total</span>
                <b>{rupiah(total)}</b>
              </div>
            </div>
          </section>
        </div>

        <footer className="psn-dw-foot">
          {next && (
            <button
              type="button"
              className="psn-btn psn-btn-primary"
              disabled={busy}
              onClick={() => onNext(next.ke)}
            >
              <next.icon aria-hidden />
              {busy ? "Memproses…" : next.label}
            </button>
          )}
          <div className="psn-card-btns">
            <button type="button" className="psn-btn" onClick={onCetak}>
              <PrinterIcon aria-hidden /> Cetak Struk
            </button>
            {o.status !== "cancelled" && o.status !== "completed" && (
              <button type="button" className="psn-btn psn-btn-danger" disabled={busy} onClick={onBatal}>
                <BanIcon aria-hidden /> Batalkan
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}

/* ── Dialog alasan pembatalan (aturan & jalur sama dengan Kasir) ── */
function BatalDialog({
  o,
  onClose,
  onDone,
}: {
  o: BoardOrder;
  onClose: () => void;
  onDone: (ok: boolean, text: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function konfirmasi() {
    if (!reason.trim()) {
      setError("Alasan wajib diisi.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await cancelOrder(o.id_order, reason.trim());
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onDone(true, `Pesanan ${nomor(o.id_order)} dibatalkan.`);
  }

  return (
    <div className="psn-modal-bd" role="presentation" onMouseDown={onClose}>
      <div
        className="psn-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Batalkan pesanan ${nomor(o.id_order)}`}
        onMouseDown={e => e.stopPropagation()}
      >
        <h3>Batalkan pesanan {nomor(o.id_order)}?</h3>
        <p className="psn-modal-sub">
          {mejaLabel(o.table_number)} · {rupiah(o.total ?? 0)} — stok bahan dikembalikan, alasannya tersimpan
          dan ikut terbaca di laporan.
        </p>
        <div className="psn-presets">
          {PRESET_BATAL.map(p => (
            <button
              key={p}
              type="button"
              className={reason === p ? "psn-preset psn-preset-on" : "psn-preset"}
              onClick={() => {
                setReason(p);
                setError(null);
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          className="psn-input"
          value={reason}
          onChange={e => {
            setReason(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Tulis alasan pembatalan…"
          aria-label="Alasan pembatalan"
          rows={2}
        />
        {error && (
          <p className="psn-toast psn-toast-err" role="alert" style={{ marginTop: 10 }}>
            <AlertCircleIcon aria-hidden />
            {error}
          </p>
        )}
        <div className="psn-modal-foot">
          <button type="button" className="psn-btn" onClick={onClose} disabled={busy}>
            Kembali
          </button>
          <button type="button" className="psn-btn psn-btn-danger" onClick={konfirmasi} disabled={busy}>
            {busy ? "Membatalkan…" : "Batalkan Pesanan"}
          </button>
        </div>
      </div>
    </div>
  );
}
