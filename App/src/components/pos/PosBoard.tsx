"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { orderNumber } from "@/lib/order-number";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  BikeIcon,
  CalculatorIcon,
  ChevronDownIcon,
  EyeIcon,
  FileTextIcon,
  FilesIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  ScrollTextIcon,
  SearchIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  Trash2Icon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { buildReceiptHtml, printReceipt } from "@/lib/receipt-html";
import PosItemModalInline from "@/components/pos/PosItemModal";
import PosItemDetails from "@/components/pos/PosItemDetails";
import type { OrderItem, OrderStatus, SelectedOption } from "@/types";

/** POS — papan kasir 3Diner.
 *
 *  Tata letak dua kolom (katalog kiri, Ringkasan Pesanan kanan) mengikuti
 *  referensi "Modern POS Dashboard UI"; palet & tipografi tetap DNA 3Diner.
 *
 *  Alur tulis TIDAK berubah dari versi sebelumnya — itu jalur produksi:
 *  pilih menu (varian/catatan via modal Item Details) -> keranjang -> quote
 *  (subtotal/pajak/service dihitung server) -> commit (kirim dapur / draf)
 *  -> tunai (mark_order_cash_paid) / QRIS (charge) -> struk / batal.
 *
 *  Dua medan baru di kolom kanan bukan hiasan:
 *  • "Nama Pelanggan" ditulis ke `notes` pesanan (kolom nyata, tercetak di
 *    struk dan terbaca dapur). Tidak ada kolom customer_name di Orders.
 *  • "Lokasi Meja" adalah combobox: daftar meja yang pernah dipakai kafe ini
 *    plus ketikan bebas — nomor meja di lapangan bisa "A3", bukan cuma angka.
 *  Tidak ada kotak kode promo: sistem promo belum ada, dan kotak yang tidak
 *  melakukan apa pun adalah bug, bukan dekorasi. Baris "Diskon" yang tampil
 *  berasal dari `discount_pct` menu yang memang dipotong server. */

export type PosMenu = {
  id: string;
  name: string;
  price: number;
  discountPct: number | null;
  imageUrl: string | null;
  category: string | null;
  isActive: boolean;
  /** Deskripsi menu — ditampilkan di modal Item Details. */
  description?: string | null;
};

export type PosOptionValue = { id: string; name: string; priceDelta: number };
export type PosMenuOption = {
  id: string;
  menuId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  values: PosOptionValue[];
};

export type PosCategoryChip = { name: string; count: number };

export type PosRecent = {
  id: string;
  table: string;
  total: number;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: string;
  menuCount: number;
  itemCount: number;
};

export interface PosQuote {
  items: OrderItem[];
  subtotal: number;
  tax_pct: number;
  tax_amount: number;
  service_pct: number;
  service_amount: number;
  prices_include_tax: boolean;
  total: number;
}

export interface PosCommitted {
  id: string;
  token: string;
  table: string;
}

type Line = {
  key: string;
  menu: PosMenu;
  qty: number;
  options: SelectedOption[];
  note: string;
};

type OrderType = "dine" | "takeaway";

const TAKEAWAY_LABEL = "Bungkus";

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

function hargaJual(m: PosMenu): number {
  const d = Math.min(Math.max(m.discountPct ?? 0, 0), 100);
  return Math.round(m.price * (1 - d / 100));
}

function lineRate(line: Line): number {
  return hargaJual(line.menu) + line.options.reduce((s, o) => s + o.price_delta, 0);
}

const STATUS_LABEL: Record<string, string> = {
  received: "Baru",
  preparing: "Di Dapur",
  ready: "Siap",
  completed: "Selesai",
  cancelled: "Batal",
  awaiting: "Menunggu",
  awaiting_checkin: "Menunggu",
};

const STATUS_CLASS: Record<string, string> = {
  received: "pos-st-baru",
  preparing: "pos-st-dapur",
  ready: "pos-st-siap",
  completed: "pos-st-selesai",
  awaiting: "pos-st-dapur",
  awaiting_checkin: "pos-st-dapur",
};

function umurMenit(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

const nomorOrder = (id: string) => `#${orderNumber(id)}`;

/** Umur terformat manusiawi: "baru saja", "12 mnt", "1 j 51 mnt". */
function umurLabel(iso: string): string {
  const m = umurMenit(iso);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt`;
  const j = Math.floor(m / 60);
  const sisa = m % 60;
  return sisa ? `${j} j ${sisa} mnt` : `${j} j`;
}

function isTakeawayLabel(table: string): boolean {
  return /^(bungkus|delivery|take ?away)$/i.test(table.trim());
}

export default function PosBoard({
  cafeId,
  cafeName,
  cafeAddress,
  taxConfigured,
  receiptSettings,
  staffName,
  menus,
  optionGroups,
  categories,
  recent,
  tables,
}: {
  cafeId: string;
  cafeName: string;
  cafeAddress: string | null;
  taxConfigured: boolean;
  /** Preferensi Pengaturan Struk — diteruskan apa adanya ke builder. */
  receiptSettings?: Record<string, unknown> | null;
  staffName: string;
  menus: PosMenu[];
  optionGroups: PosMenuOption[];
  categories: PosCategoryChip[];
  recent: PosRecent[];
  /** Nomor meja yang pernah dipakai kafe ini — isi daftar combobox. */
  tables: string[];
}) {
  const [cat, setCat] = useState("Semua Menu");
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine");
  const [customer, setCustomer] = useState("");
  const [table, setTable] = useState("");
  const [mejaErr, setMejaErr] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);
  const mejaRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  /** Jumlah tertahan per kartu menu (stepper di kartu, sebelum ditambahkan). */
  const [pending, setPending] = useState<Record<string, number>>({});
  const [noteKey, setNoteKey] = useState<string | null>(null);
  /** Panel "Pesanan aktif" di balik ikon mata pada kepala Ringkasan. */
  const [liveOpen, setLiveOpen] = useState(false);

  const [quote, setQuote] = useState<PosQuote | null>(null);
  /** Signature keranjang yang dilayani `quote` — membedakan quote segar vs basi. */
  const [quoteKey, setQuoteKey] = useState("");
  /** True saat ringkasan server sedang dihitung — Total menampilkan animasi. */
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [committed, setCommitted] = useState<PosCommitted | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<"cash" | "qris">("cash");
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  /** Item Details untuk pesanan aktif (menambah item ke pesanan berjalan). */
  const [recentFor, setRecentFor] = useState<PosRecent | null>(null);
  /** Menu yg dilihat detail-nya dari dalam pesanan aktif. */
  const [detailMenu, setDetailMenu] = useState<PosMenu | null>(null);
  /** Qty awal modal Item Details — diwarisi dari stepper kartu. */
  const [detailQty, setDetailQty] = useState(1);

  const live = committed === null;
  const lineCount = lines.reduce((s, l) => s + l.qty, 0);

  /** Nilai table_number yang dikirim: takeaway memakai label tetap. */
  const tableValue = orderType === "dine" ? table.trim() : TAKEAWAY_LABEL;
  const tableLabel = orderType === "dine" ? table.trim() || "-" : TAKEAWAY_LABEL;

  /** Catatan pesanan: satu-satunya tempat nama pelanggan bisa ikut ke server. */
  const orderNotes = customer.trim() ? `Pelanggan: ${customer.trim()}` : null;

  /** Menu punya grup opsi? Kalau ya, "Tambah" wajib lewat Item Details —
   *  menambah diam-diam tanpa varian membuat dapur menebak. */
  const groupsByMenu = useMemo(() => {
    const map = new Map<string, PosMenuOption[]>();
    for (const g of optionGroups) {
      const arr = map.get(g.menuId);
      if (arr) arr.push(g);
      else map.set(g.menuId, [g]);
    }
    return map;
  }, [optionGroups]);

  // ── Auto-quote: ringkasan dihitung server SETIAP keranjang/meja berubah
  // (debounce 600 ms) — total terisi sendiri, bukan menunggu tombol ditekan.
  // Quote basi (keranjang sudah beda) dinetralkan saat render lewat
  // pencocokan signature, bukan setState di dalam effect.
  const cartKey = useMemo(
    () => JSON.stringify([lines.map(l => [l.key, l.qty, l.note]), tableValue, orderNotes]),
    [lines, tableValue, orderNotes],
  );
  const quoted = quote && quoteKey === cartKey ? quote : null;

  /** Diskon menu yang sudah dipotong server (subtotal quote = setelah diskon).
   *  Ditampilkan sebagai baris tersendiri supaya kasir bisa menjelaskannya
   *  ke tamu; Subtotal di atasnya jadi harga kotor agar aritmetikanya utuh. */
  const discountAmount = useMemo(
    () => lines.reduce((s, l) => s + (l.menu.price - hargaJual(l.menu)) * l.qty, 0),
    [lines],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return menus.filter(m => {
      if (!m.isActive) return false;
      if (cat !== "Semua Menu" && (m.category ?? "") !== cat) return false;
      if (needle && !m.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [menus, cat, q]);

  /** Meja yang cocok dengan ketikan — daftar combobox. */
  const tableMatches = useMemo(() => {
    const needle = table.trim().toLowerCase();
    return tables.filter(t => !needle || t.toLowerCase().includes(needle)).slice(0, 40);
  }, [tables, table]);

  // ── Pintasan "/" memfokuskan pencarian menu. ⌘K sudah dipakai pencarian
  // global konsol (Shell), jadi POS tidak boleh merebutnya.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Klik di luar menutup daftar meja.
  useEffect(() => {
    if (!comboOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!comboRef.current?.contains(e.target as Node)) setComboOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [comboOpen]);

  /** Quote server: harga item, pajak, service — semuanya dari server, bukan JS klien.
   *  Mengembalikan juga quote_id untuk commit (checkout_metadata wajib server). */
  const refreshQuote = useCallback(async (): Promise<(PosQuote & { quoteId: string }) | null> => {
    if (lines.length === 0) return null;
    const res = await fetch("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cafeId,
        table: tableValue || "1",
        notes: orderNotes,
        paymentChannel: "cashier",
        items: lines.map(l => ({
          id_menu: l.menu.id,
          qty: l.qty,
          options: l.options.map(o => o.id_option_value),
          note: l.note.trim() || undefined,
        })),
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | ({ quote?: Partial<PosQuote>; quote_id?: string } & Record<string, unknown>)
      | { error?: string }
      | null;
    // Envelope RPC: { quote: {...angka...}, quote_id, expires_at, request_hash }.
    // Tanpa membuka wrapper ini, subtotal/total terbaca undefined -> "Rp NaN".
    const inner = data && typeof data === "object" && "quote" in data && data.quote
      ? (data as { quote: Partial<PosQuote>; quote_id?: string })
      : data && typeof data === "object" && "subtotal" in data
        ? (data as { quote?: undefined; quote_id?: string } & Partial<PosQuote>)
        : null;
    if (
      !res.ok || !inner?.quote ||
      !("quote_id" in (data as object)) || typeof (data as { quote_id?: unknown }).quote_id !== "string"
    ) {
      setMsg({ kind: "err", text: "Gagal menghitung ringkasan. Coba lagi." });
      return null;
    }
    const q: PosQuote = {
      items: inner.quote.items ?? [],
      subtotal: Number(inner.quote.subtotal ?? 0),
      tax_pct: Number(inner.quote.tax_pct ?? 0),
      tax_amount: Number(inner.quote.tax_amount ?? 0),
      service_pct: Number(inner.quote.service_pct ?? 0),
      service_amount: Number(inner.quote.service_amount ?? 0),
      prices_include_tax: Boolean(inner.quote.prices_include_tax),
      total: Number(inner.quote.total ?? 0),
    };
    if (![q.subtotal, q.total, q.tax_amount, q.service_amount].every(Number.isFinite)) {
      setMsg({ kind: "err", text: "Ringkasan tidak valid. Coba lagi." });
      return null;
    }
    setQuote(q);
    return { ...q, quoteId: String((data as { quote_id: string }).quote_id) };
  }, [cafeId, lines, orderNotes, tableValue]);

  useEffect(() => {
    if (!live || lines.length === 0) return;
    const t = setTimeout(() => {
      setQuoteBusy(true);
      refreshQuote()
        .then(q => {
          if (q) setQuoteKey(cartKey);
        })
        .finally(() => setQuoteBusy(false));
    }, 600);
    return () => clearTimeout(t);
    // refreshQuote ikut berubah tiap `lines` berubah; cartKey sudah mewakili
    // seluruh masukan yang mempengaruhi harga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, lines.length, live]);

  // ── Keranjang ───────────────────────────────────────────────────────────

  function pendingQty(id: string): number {
    return pending[id] ?? 0;
  }

  function bumpPending(id: string, delta: number) {
    setPending(prev => {
      const next = Math.min(99, Math.max(0, (prev[id] ?? 0) + delta));
      return { ...prev, [id]: next };
    });
  }

  function openDetails(m: PosMenu, qty?: number) {
    setDetailQty(Math.max(1, qty ?? (pendingQty(m.id) || 1)));
    setDetailMenu(m);
  }

  /** Tombol "Tambah" di kartu menu. Menu tanpa grup opsi masuk langsung
   *  sebanyak angka pada stepper; menu bervarian dibawa ke Item Details. */
  function addFromCard(m: PosMenu) {
    const qty = Math.max(1, pendingQty(m.id));
    if ((groupsByMenu.get(m.id)?.length ?? 0) > 0) {
      openDetails(m, qty);
      return;
    }
    const key = `${m.id}#`;
    setLines(prev => {
      const hit = prev.find(l => l.key === key);
      if (hit) return prev.map(l => (l.key === key ? { ...l, qty: l.qty + qty } : l));
      return [...prev, { key, menu: m, qty, options: [], note: "" }];
    });
    setPending(prev => ({ ...prev, [m.id]: 0 }));
    setMsg(null);
  }

  /** Terima baris lengkap dari modal Item Details → masuk keranjang. */
  function addFromDetails(line: { menu: PosMenu; qty: number; options: SelectedOption[]; note: string }) {
    const key = [line.menu.id, line.options.map(o => o.id_option_value).sort().join("|")].join("#");
    setLines(prev => {
      const hit = prev.find(l => l.key === key);
      if (hit) {
        return prev.map(l =>
          l.key === key
            ? { ...l, qty: l.qty + line.qty, note: line.note || l.note }
            : l,
        );
      }
      return [...prev, { key, menu: line.menu, qty: line.qty, options: line.options, note: line.note }];
    });
    setPending(prev => ({ ...prev, [line.menu.id]: 0 }));
    setDetailMenu(null);
    setMsg(null);
  }

  function changeQty(key: string, delta: number) {
    setLines(prev =>
      prev
        .map(l => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter(l => l.qty > 0),
    );
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(l => l.key !== key));
    if (noteKey === key) setNoteKey(null);
  }

  function clearCart() {
    setLines([]);
    setNoteKey(null);
    setQuote(null);
    setQuoteKey("");
    setMsg(null);
  }

  function setLineNote(key: string, value: string) {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, note: value } : l)));
  }

  // ── Tulis-path ──────────────────────────────────────────────────────────

  const router = useRouter();
  const submitting = useRef(false);
  const attempt = useRef<{ key: string; quoteId: string; cartKey: string; quote: PosQuote } | null>(null);
  async function commit(draft: boolean): Promise<PosCommitted | null> {
    if (orderType === "dine" && !table.trim()) {
      // Galat ditandai pada medannya lalu fokus dipindahkan ke sana: kasir
      // tidak perlu mencari kotak mana yang dimaksud, dan pembaca layar
      // mengumumkannya lewat `role="alert"` yang bertetangga dengan input.
      setMejaErr(true);
      mejaRef.current?.focus();
      return null;
    }
    if (lines.length === 0 || submitting.current) return null;
    submitting.current = true;
    try {
    const saved = attempt.current?.cartKey === cartKey ? attempt.current : null;
    const qq = saved ? { ...saved.quote, quoteId: saved.quoteId } : await refreshQuote();
    if (!qq) return null;
    const idempotencyKey = saved?.key ?? crypto.randomUUID();
    attempt.current = { key: idempotencyKey, quoteId: qq.quoteId, cartKey, quote: qq };
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        cafeId,
        table: tableValue || "1",
        notes: orderNotes,
        paymentChannel: "cashier",
        quoteId: qq.quoteId,
        items: lines.map(l => ({
          id_menu: l.menu.id,
          qty: l.qty,
          options: l.options.map(o => o.id_option_value),
          note: l.note.trim() || undefined,
        })),
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { order?: { id_order?: string }; orderToken?: string; error?: string; message?: string }
      | null;
    if (!res.ok || !data?.order?.id_order || !data.orderToken) {
      if (res.status >= 400 && res.status < 500) attempt.current = null;
      setMsg({ kind: "err", text: data?.message ?? data?.error ?? "Pesanan gagal dikirim." });
      return null;
    }

    const c: PosCommitted = { id: data.order.id_order, token: data.orderToken, table: tableValue };
    attempt.current = null;
    setCommitted(c);
    router.refresh();
    setLines([]);
    setNoteKey(null);
    setQuote(qq);
    setQuoteKey("");
    setMsg({
      kind: "ok",
      text: draft
        ? `Draf ${nomorOrder(c.id)} tersimpan. Selesaikan dari panel Pesanan Aktif.`
        : `Pesanan ${nomorOrder(c.id)} tersimpan. Selesaikan pembayaran untuk masuk antrean dapur.`,
    });
    return c;
    } catch {
      setMsg({ kind: "err", text: "Koneksi terputus. Periksa Pesanan Aktif sebelum mengirim ulang." });
      return null;
    } finally { submitting.current = false; }
  }

  /** Setelah commit, keranjang kosong tapi angka pesanan harus tetap terbaca:
   *  `quote` disimpan apa adanya dan dipakai untuk struk & modal bayar. */
  const settled = live ? quoted : quote;

  function newOrder() {
    setCommitted(null);
    setPayOpen(false);
    setQrisUrl(null);
    setQuote(null);
    setQuoteKey("");
    setCustomer("");
    setTable("");
    setMejaErr(false);
    setMsg(null);
  }

  function printStruk(orderId: string) {
    printReceipt(
      buildReceiptHtml(
        {
          id_order: orderId,
          table_number: committed?.table ?? tableValue,
          items: settled?.items ?? [],
          total: settled?.total ?? 0,
          payment_method: "cash",
          payment_status: "unpaid",
          created_at: new Date().toISOString(),
          notes: orderNotes,
        },
        {
          name: cafeName,
          address: cafeAddress,
          taxConfigured,
          cashierName: staffName,
          receipt: receiptSettings ?? null,
        },
      ),
    );
  }

  async function bayarTunai() {
    if (!committed) return;
    // Alur tunai server: payment_method='cash' boleh gagal dengan aman
    // (set_order_payment_method menolak bila pembayaran terkunci — mis. status
    // sudah 'awaiting_checkin' karena kanal cashier), yang penting lanjut ke
    // mark_order_cash_paid yang menerima 'awaiting_checkin' dan 'unpaid'.
    const { setPaymentMethod } = await import("@/lib/orders");
    await setPaymentMethod(committed.id, committed.token, "cash");
    const { markCashPaid } = await import("@/lib/kasir-actions");
    const res = await markCashPaid(committed.id);
    if (res.error) {
      setMsg({ kind: "err", text: res.error });
      return;
    }
    setMsg({ kind: "ok", text: `Pesanan ${nomorOrder(committed.id)} lunas (tunai).` });
    setPayOpen(false);
  }

  async function bayarQris() {
    if (!committed) return;
    try {
      const { chargeOnline } = await import("@/lib/orders");
      const url = await chargeOnline(committed.id, committed.token);
      setQrisUrl(url);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal memulai QRIS." });
    }
  }

  async function batalPesanan() {
    if (!committed) return;
    const reason = window.prompt("Alasan pembatalan (wajib):") ?? "";
    if (!reason.trim()) return;
    const { cancelOrder } = await import("@/lib/kasir-actions");
    const res = await cancelOrder(committed.id, reason.trim());
    if (res.error) {
      setMsg({ kind: "err", text: res.error });
      return;
    }
    const nomor = nomorOrder(committed.id);
    newOrder();
    setMsg({ kind: "ok", text: `Pesanan ${nomor} dibatalkan.` });
  }

  const now = new Date();
  const tanggalCetak = now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const jamCetak = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="pos-root">
      {/* ══════════ KOLOM KIRI: katalog menu ══════════ */}
      <section className="pos-panel" aria-label="Menu">
        <div className="pos-panel-head">
          <h2>Menu</h2>
          <div className="pos-panel-head-side">
            <span className="pos-kasir">Kasir: {staffName}</span>
            <label className="pos-search">
              <SearchIcon className="h-4 w-4" aria-hidden />
              <input
                ref={searchRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Cari menu"
                aria-label="Cari menu"
              />
              {q ? (
                <button type="button" className="pos-search-x" aria-label="Bersihkan pencarian" onClick={() => setQ("")}>
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd aria-hidden>/</kbd>
              )}
            </label>
          </div>
        </div>

        <div className="pos-cats" role="tablist" aria-label="Kategori menu">
          {categories.map(c => (
            <button
              key={c.name}
              type="button"
              role="tab"
              aria-selected={cat === c.name}
              className={`pos-cat${cat === c.name ? " pos-cat-on" : ""}`}
              onClick={() => setCat(c.name)}
            >
              {c.name}
              <span className="pos-cat-n">{c.count}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="pos-empty">
            <b>Tidak ada menu yang cocok</b>
            {q.trim() ? `Tidak ada hasil untuk “${q.trim()}”.` : "Coba kategori lain."}
          </div>
        ) : (
          <div className="pos-grid">
            {visible.map(m => {
              const sale = hargaJual(m);
              const hasDisc = sale !== m.price;
              const n = pendingQty(m.id);
              return (
                <article key={m.id} className="pos-card">
                  <button
                    type="button"
                    className="pos-card-shot"
                    onClick={() => openDetails(m)}
                    aria-label={`Lihat detail ${m.name}`}
                  >
                    {m.imageUrl ? (
                      <Image
                        src={m.imageUrl}
                        alt=""
                        width={320}
                        height={240}
                        sizes="(max-width: 560px) 45vw, 220px"
                        loading="eager"
                      />
                    ) : (
                      <span className="pos-card-shot-empty" aria-hidden />
                    )}
                    {hasDisc && <span className="pos-flag">Diskon {m.discountPct}%</span>}
                  </button>
                  <span className="pos-card-cat">{m.category ?? "Menu"}</span>
                  <button type="button" className="pos-card-name" onClick={() => openDetails(m)}>
                    {m.name}
                  </button>
                  <span className="pos-card-price">
                    {hasDisc && <s>{rupiah(m.price)}</s>}
                    <b>{rupiah(sale)}</b> / porsi
                  </span>
                  <div className="pos-card-foot">
                    <span className="pos-stepper">
                      <button
                        type="button"
                        aria-label={`Kurangi jumlah ${m.name}`}
                        disabled={n === 0}
                        onClick={() => bumpPending(m.id, -1)}
                      >
                        <MinusIcon className="h-3.5 w-3.5" />
                      </button>
                      <b aria-live="off">{n}</b>
                      <button type="button" aria-label={`Naikkan jumlah ${m.name}`} onClick={() => bumpPending(m.id, 1)}>
                        <PlusIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                    <button
                      type="button"
                      className="pos-card-add"
                      onClick={() => addFromCard(m)}
                      aria-label={`Masukkan ${m.name} ke keranjang`}
                      title={`Masukkan ${m.name} ke keranjang`}
                    >
                      Tambah
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ══════════ KOLOM KANAN: ringkasan pesanan ══════════ */}
      <aside className="pos-cart" aria-label="Ringkasan pesanan">
        <div className="pos-cart-head">
          <h2>
            {live ? "Ringkasan Pesanan" : `Pesanan ${nomorOrder(committed!.id)}`}
            <span className="pos-cart-orderdate">
              {tanggalCetak}, {jamCetak}
            </span>
          </h2>
          <button
            type="button"
            className={`pos-eye${liveOpen ? " pos-eye-on" : ""}`}
            aria-expanded={liveOpen}
            aria-label={`Pesanan aktif (${recent.length})`}
            title={`Pesanan aktif (${recent.length})`}
            onClick={() => setLiveOpen(v => !v)}
          >
            <EyeIcon className="h-4 w-4" />
            {recent.length > 0 && <span className="pos-eye-dot">{recent.length}</span>}
          </button>
        </div>

        <div className="pos-cart-body">
          {liveOpen && (
            <section className="pos-live" aria-label="Pesanan aktif hari ini">
              <div className="pos-live-head">
                <h3>Pesanan Aktif</h3>
                <Link className="pos-live-link" href="/dashboard-v2/pesanan">
                  Semua Pesanan
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="pos-hint">Belum ada pesanan berjalan hari ini.</p>
              ) : (
                <div className="pos-live-list">
                  {recent.map(o => {
                    const umur = umurMenit(o.createdAt);
                    // Umur panjang = tekanan operasional: tepi kartu menyala.
                    const urgency = umur >= 60 ? " pos-lc-urgent" : umur >= 30 ? " pos-lc-warn" : "";
                    const Ikon = isTakeawayLabel(o.table) ? ShoppingBagIcon : BikeIcon;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={`pos-live-card${urgency}`}
                        title={`Tambah item ke ${nomorOrder(o.id)}`}
                        onClick={() => setRecentFor(o)}
                      >
                        <span className="pos-lc-top">
                          <span className="pos-lc-id">{nomorOrder(o.id)}</span>
                          <span className={`pos-st ${STATUS_CLASS[o.status] ?? ""}`}>
                            {STATUS_LABEL[o.status] ?? o.status}
                          </span>
                        </span>
                        <span className="pos-lc-bot">
                          <Ikon className="h-3.5 w-3.5" />
                          <span className="pos-lc-meja">
                            {isTakeawayLabel(o.table) ? o.table : `Meja ${o.table}`}
                          </span>
                          <span className={umur >= 60 ? "pos-lc-late" : undefined}>· {umurLabel(o.createdAt)}</span>
                          <b className="pos-lc-total">{rupiah(o.total)}</b>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <div className="pos-field">
            <label className="pos-field-lbl" htmlFor="pos-cust">
              Nama Pelanggan
            </label>
            <input
              id="pos-cust"
              className="pos-input"
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              placeholder="Opsional — mis. Budi"
              maxLength={60}
              autoComplete="off"
              disabled={!live}
            />
            <p className="pos-field-hint">Ikut tercatat di catatan pesanan &amp; struk.</p>
          </div>

          <div className="pos-field">
            <label className="pos-field-lbl" htmlFor="pos-otype">
              Tipe Pesanan
            </label>
            <span className="pos-selwrap">
              <select
                id="pos-otype"
                className="pos-select"
                value={orderType}
                onChange={e => {
                  setOrderType(e.target.value === "takeaway" ? "takeaway" : "dine");
                  setMejaErr(false);
                  setQuote(null);
                  setQuoteKey("");
                }}
                disabled={!live}
              >
                <option value="dine">Dine In</option>
                <option value="takeaway">Take Away</option>
              </select>
              <ChevronDownIcon aria-hidden />
            </span>
          </div>

          <div className="pos-field">
            <label className="pos-field-lbl" htmlFor="pos-meja">
              Lokasi Meja
            </label>
            {orderType === "dine" ? (
              <div className="pos-combo" ref={comboRef}>
                <span className="pos-selwrap">
                  <input
                    id="pos-meja"
                    ref={mejaRef}
                    className="pos-input"
                    style={{ paddingRight: 36 }}
                    value={table}
                    onChange={e => {
                      setTable(e.target.value);
                      setQuote(null);
                      setComboOpen(true);
                      if (mejaErr) setMejaErr(false);
                    }}
                    onFocus={() => setComboOpen(true)}
                    onKeyDown={e => {
                      if (e.key === "Escape") setComboOpen(false);
                      if (e.key === "Enter") setComboOpen(false);
                    }}
                    placeholder="Pilih atau ketik meja"
                    role="combobox"
                    aria-expanded={comboOpen}
                    aria-controls="pos-meja-list"
                    aria-autocomplete="list"
                    // Kasir memakai layar sentuh: papan tik angka menghemat satu
                    // ketukan tiap pesanan. `text` (bukan `number`) dipertahankan
                    // karena nomor meja bisa berbentuk "A3" atau "12B".
                    inputMode="numeric"
                    enterKeyHint="done"
                    autoComplete="off"
                    maxLength={8}
                    aria-invalid={mejaErr || undefined}
                    aria-describedby={mejaErr ? "pos-meja-err" : undefined}
                    disabled={!live}
                  />
                  <ChevronDownIcon aria-hidden />
                </span>
                {comboOpen && live && (
                  <div className="pos-combo-pop" id="pos-meja-list" role="listbox">
                    {tableMatches.length === 0 ? (
                      <p className="pos-combo-empty">
                        {table.trim()
                          ? `Pakai meja baru “${table.trim()}”.`
                          : "Belum ada riwayat meja — ketik nomornya."}
                      </p>
                    ) : (
                      tableMatches.map(t => (
                        <button
                          key={t}
                          type="button"
                          role="option"
                          aria-selected={t === table.trim()}
                          data-active={t === table.trim()}
                          className="pos-combo-opt"
                          onClick={() => {
                            setTable(t);
                            setComboOpen(false);
                            setMejaErr(false);
                            setQuote(null);
                          }}
                        >
                          Meja {t}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {mejaErr && (
                  // Galat tinggal di sebelah medannya, bukan di dasar kolom.
                  <p className="pos-field-err" id="pos-meja-err" role="alert">
                    <AlertCircleIcon aria-hidden />
                    Nomor meja wajib diisi untuk Dine In — atau pilih Take Away.
                  </p>
                )}
              </div>
            ) : (
              <>
                <input id="pos-meja" className="pos-input" value={TAKEAWAY_LABEL} disabled readOnly />
                <p className="pos-field-hint">Pesanan dibawa pulang — tercatat sebagai “{tableLabel}”.</p>
              </>
            )}
          </div>

          <div className="pos-items">
            <div className="pos-items-head">
              <h3>Menu Dipesan</h3>
              <span className="pos-items-count">{lineCount} item</span>
              {lines.length > 0 && (
                <button type="button" className="pos-clear" onClick={clearCart}>
                  <Trash2Icon aria-hidden /> Kosongkan
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="pos-cart-empty">
                <ShoppingCartIcon aria-hidden />
                <span>
                  {live
                    ? "Keranjang kosong. Tekan “Tambah” pada menu di kiri."
                    : "Pesanan sudah dikirim. Mulai pesanan baru untuk menambah item."}
                </span>
              </div>
            ) : (
              lines.map(l => (
                <div key={l.key} className="pos-line">
                  <div className="pos-line-main">
                    <span className="pos-line-thumb">
                      {l.menu.imageUrl ? (
                        <Image src={l.menu.imageUrl} alt="" width={56} height={56} sizes="56px" loading="eager" />
                      ) : (
                        <span className="pos-line-thumb-empty" aria-hidden />
                      )}
                    </span>
                    <div className="pos-line-body">
                      <div className="pos-line-top">
                        <span className="pos-line-name">{l.menu.name}</span>
                        <span className="pos-line-mult">×{l.qty}</span>
                      </div>
                      {l.options.length > 0 && (
                        <div className="pos-line-addons">
                          <span>Add-ons:</span>
                          <ul>
                            {l.options.map(o => (
                              <li key={o.id_option_value}>
                                {o.name}
                                {o.price_delta ? ` (+${rupiah(o.price_delta)})` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {l.note && noteKey !== l.key && <p className="pos-line-note-txt">“{l.note}”</p>}
                    </div>
                  </div>

                  <div className="pos-line-sub">
                    <span>Subtotal ({rupiah(lineRate(l))} × {l.qty})</span>
                    <b>{rupiah(lineRate(l) * l.qty)}</b>
                  </div>

                  <div className="pos-line-row">
                    <span className="pos-stepper">
                      <button type="button" aria-label={`Kurangi jumlah ${l.menu.name}`} onClick={() => changeQty(l.key, -1)}>
                        <MinusIcon className="h-3.5 w-3.5" />
                      </button>
                      <b>{l.qty}</b>
                      <button type="button" aria-label={`Naikkan jumlah ${l.menu.name}`} onClick={() => changeQty(l.key, 1)}>
                        <PlusIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                    <button
                      type="button"
                      className="pos-line-addnote"
                      onClick={() => setNoteKey(noteKey === l.key ? null : l.key)}
                    >
                      {l.note ? "Ubah catatan" : "Catatan"}
                    </button>
                    <button
                      type="button"
                      className="pos-line-x"
                      aria-label={`Hapus ${l.menu.name}`}
                      onClick={() => removeLine(l.key)}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {noteKey === l.key && (
                    <input
                      className="pos-line-note"
                      value={l.note}
                      onChange={e => setLineNote(l.key, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === "Escape") setNoteKey(null);
                      }}

                      autoFocus
                      maxLength={140}
                      placeholder="Catatan untuk dapur (Enter untuk simpan)"
                      aria-label={`Catatan ${l.menu.name}`}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Kaki: total pembayaran + aksi ── */}
        <div className="pos-foot">
          <h3>Total Pembayaran</h3>
          <div className="pos-sum">
            {settled ? (
              <>
                <div className="pos-sum-row">
                  <span>Subtotal</span>
                  <b>{rupiah(settled.subtotal + (live ? discountAmount : 0))}</b>
                </div>
                {live && discountAmount > 0 && (
                  <div className="pos-sum-row pos-sum-disc">
                    <span>Diskon menu</span>
                    <b>−{rupiah(discountAmount)}</b>
                  </div>
                )}
                {settled.service_amount > 0 && (
                  <div className="pos-sum-row">
                    <span>Service ({settled.service_pct}%)</span>
                    <b>{rupiah(settled.service_amount)}</b>
                  </div>
                )}
                <div className="pos-sum-row">
                  <span>
                    Pajak ({settled.tax_pct}%){settled.prices_include_tax ? " · sudah termasuk" : ""}
                  </span>
                  <b>{rupiah(settled.tax_amount)}</b>
                </div>
              </>
            ) : (
              <p className="pos-hint">
                {quoteBusy
                  ? "Menghitung ringkasan…"
                  : "Ringkasan muncul otomatis saat keranjang terisi."}
                {!taxConfigured && " Tarif pajak kafe belum diatur."}
              </p>
            )}
          </div>

          <div className={`pos-grand${quoteBusy ? " pos-grand-busy" : ""}`}>
            <span>Grand Total</span>
            <b>{settled ? rupiah(settled.total) : "—"}</b>
          </div>

          {live ? (
            <>
              <button
                type="button"
                className="pos-cta"
                disabled={busy || lines.length === 0}
                onClick={() => startTransition(async () => { await commit(false); })}
              >
                <ShoppingCartIcon className="h-4 w-4" aria-hidden />
                {busy ? "Mengirim…" : "Kirim Pesanan"}
              </button>
              <div className="pos-actions">
                <button
                  type="button"
                  className="pos-btn"
                  disabled={busy || lines.length === 0}
                  onClick={() => startTransition(async () => { await commit(true); })}
                >
                  <FilesIcon aria-hidden /> Simpan Draf
                </button>
                <button
                  type="button"
                  className="pos-btn"
                  disabled={busy || lines.length === 0}
                  onClick={() =>
                    startTransition(() => {
                      void refreshQuote().then(qq => {
                        if (qq) setQuoteKey(cartKey);
                      });
                    })
                  }
                >
                  <CalculatorIcon aria-hidden /> Hitung Ulang
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pos-cta"
                onClick={() => {
                  setPayMode("cash");
                  setQrisUrl(null);
                  setPayOpen(true);
                }}
              >
                Bayar Sekarang
              </button>
              <div className="pos-actions pos-actions-3">
                <button type="button" className="pos-btn" onClick={() => committed && printStruk(committed.id)}>
                  <PrinterIcon aria-hidden /> Struk
                </button>
                <button type="button" className="pos-btn" onClick={() => committed && printStruk(committed.id)}>
                  <FileTextIcon aria-hidden /> Invoice
                </button>
                <Link className="pos-btn" href="/dashboard-v2/pesanan">
                  <ScrollTextIcon aria-hidden /> Transaksi
                </Link>
                <button type="button" className="pos-btn" onClick={newOrder}>
                  <ZapIcon aria-hidden /> Pesanan Baru
                </button>
                <button
                  type="button"
                  className="pos-btn pos-btn-danger"
                  style={{ gridColumn: "span 2" }}
                  onClick={() => void batalPesanan()}
                >
                  <XIcon aria-hidden /> Batalkan Pesanan
                </button>
              </div>
            </>
          )}

          {msg && (
            <p
              className={
                msg.kind === "err" ? "pos-msg pos-msg-err" : msg.kind === "ok" ? "pos-msg pos-msg-ok" : "pos-msg"
              }
              role="status"
            >
              {msg.text}
            </p>
          )}
        </div>
      </aside>

      {/* ══════════ Modal: tambah item ke pesanan aktif ══════════ */}
      {recentFor && (
        <div className="dp-modal-backdrop" onClick={() => { setRecentFor(null); setDetailMenu(null); }}>
          <div
            className="dp-modal dp-item-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Item Details pesanan"
            onClick={e => e.stopPropagation()}
          >
            <div className="dp-modal-head">
              <h2>
                Item Details · {nomorOrder(recentFor.id)}{" "}
                <span className="dp-item-ordermeta">
                  {isTakeawayLabel(recentFor.table) ? recentFor.table : `Meja ${recentFor.table}`} ·{" "}
                  {rupiah(recentFor.total)}
                </span>
              </h2>
              <button
                type="button"
                className="pos-line-x"
                aria-label="Tutup"
                onClick={() => { setRecentFor(null); setDetailMenu(null); }}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="dp-modal-body">
              <p className="dp-hint">
                Pilih menu di bawah untuk menambahkannya ke pesanan {nomorOrder(recentFor.id)}.
                Perubahan ditulis ulang di server (stok &amp; harga divalidasi penuh).
              </p>
              <div className="dp-item-picker">
                {menus.filter(m => m.isActive).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className={`dp-pick-card${detailMenu?.id === m.id ? " dp-pick-on" : ""}`}
                    onClick={() => setDetailMenu(m)}
                  >
                    <span className="dp-pick-thumb">
                      {m.imageUrl ? (
                        <Image src={m.imageUrl} alt="" width={56} height={56} sizes="56px" loading="eager" />
                      ) : (
                        <span className="dp-pick-thumb-empty" aria-hidden />
                      )}
                    </span>
                    <span className="dp-pick-body">
                      <span className="dp-pick-name">{m.name}</span>
                      <span className="dp-pick-price">{rupiah(hargaJual(m))}</span>
                    </span>
                  </button>
                ))}
              </div>
              {detailMenu && (
                <PosItemModalInline
                  menu={detailMenu}
                  optionGroups={optionGroups}
                  order={{ id: recentFor.id, table: recentFor.table }}
                  cafeId={cafeId}
                  onClose={() => setDetailMenu(null)}
                  onDone={result => {
                    if (result.replacement && lines.length === 0) {
                      const { order, orderToken } = result.replacement;
                      setCommitted({ id: order.id_order, table: order.table_number, token: orderToken });
                      setQuote(order); setLines([]); setQuoteKey(""); setPayOpen(false); setQrisUrl(null);
                    } else if (committed?.id === recentFor.id) newOrder();
                    setRecentFor(null); setDetailMenu(null); router.refresh();
                    setMsg({ kind: "ok", text: lines.length === 0 ? "Item ditambahkan. Ringkasan dan pembayaran memakai pesanan pengganti." : "Item ditambahkan. Pesanan pengganti tersedia di Kasir; keranjang Anda tetap tersimpan." });
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Modal: pembayaran ══════════ */}
      {payOpen && committed && (
        <div className="pos-modal-backdrop" onClick={() => setPayOpen(false)}>
          <div
            className="pos-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Pembayaran"
            onClick={e => e.stopPropagation()}
          >
            <div className="pos-modal-head">
              <h2>Bayar {nomorOrder(committed.id)}</h2>
              <button type="button" className="pos-line-x" aria-label="Tutup" onClick={() => setPayOpen(false)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="pos-modal-body">
              <p className="pos-pay-total">
                {settled ? rupiah(settled.total) : "Muat ulang ringkasan"}{" "}
                <span>· {isTakeawayLabel(committed.table) ? committed.table : `meja ${committed.table}`}</span>
              </p>
              <div className="pos-pay-tabs" role="tablist" aria-label="Metode pembayaran">
                <button
                  type="button"
                  role="tab"
                  aria-selected={payMode === "cash"}
                  className={`pos-pay-tab${payMode === "cash" ? " pos-pay-tab-on" : ""}`}
                  onClick={() => {
                    setPayMode("cash");
                    setQrisUrl(null);
                  }}
                >
                  Tunai
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={payMode === "qris"}
                  className={`pos-pay-tab${payMode === "qris" ? " pos-pay-tab-on" : ""}`}
                  onClick={() => setPayMode("qris")}
                >
                  QRIS
                </button>
              </div>
              {payMode === "cash" ? (
                <p className="pos-hint">
                  Konfirmasi setelah uang diterima. Status lunas dicatat server (RPC), bukan di browser.
                </p>
              ) : qrisUrl ? (
                <div className="pos-qris">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrisUrl} alt="Kode QRIS" />
                  <p className="pos-hint">Minta tamu memindai. Status lunas otomatis lewat webhook Midtrans.</p>
                </div>
              ) : (
                <button type="button" className="pos-btn pos-btn-primary" onClick={() => void bayarQris()}>
                  Buat Kode QRIS
                </button>
              )}
            </div>
            <div className="pos-modal-foot">
              <button type="button" className="pos-btn" onClick={() => setPayOpen(false)}>
                Tutup
              </button>
              {payMode === "cash" && (
                <button type="button" className="pos-btn pos-btn-primary" onClick={() => void bayarTunai()}>
                  Lunas Tunai
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Modal: Item Details (klik kartu menu) ══════════ */}
      {detailMenu && !recentFor && (
        <PosItemDetails
          menu={detailMenu}
          optionGroups={optionGroups}
          initialQty={detailQty}
          onAdd={addFromDetails}
          onClose={() => setDetailMenu(null)}
        />
      )}
    </div>
  );
}
