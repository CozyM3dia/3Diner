"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BikeIcon,
  CalculatorIcon,
  FileTextIcon,
  FilesIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  ScrollTextIcon,
  SearchIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  UtensilsIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { buildReceiptHtml, printReceipt } from "@/lib/receipt-html";
import PosItemModalInline from "@/components/pos/PosItemModal";
import PosItemDetails from "@/components/pos/PosItemDetails";
import type { OrderItem, OrderStatus, SelectedOption } from "@/types";

/** POS ala template pos.html Dream POS, dengan tulis-path nyata.
 *  Alur: pilih menu (varian/catatan via panel opsi) -> keranjang -> quote
 *  (subtotal/pajak/service dari server) -> commit (kirim dapur / simpan draf)
 *  -> tunai (mark_order_cash_paid) / QRIS (charge) -> struk / batal.
 *
 *  Tipe pesanan (Dine In/Take Away) menentukan isi kolom
 *  table_number yang dikirim ke server — bukan hiasan. */

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

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

function hargaJual(m: PosMenu): number {
  const d = Math.min(Math.max(m.discountPct ?? 0, 0), 100);
  return Math.round(m.price * (1 - d / 100));
}

function lineRate(line: Line): number {
  return hargaJual(line.menu) + line.options.reduce((s, o) => s + o.price_delta, 0);
}

function lineLabel(line: Line): string {
  if (line.options.length === 0) return line.menu.name;
  return line.menu.name;
}

const STATUS_LABEL: Record<string, string> = {
  received: "Baru",
  preparing: "Di Dapur",
  ready: "Siap",
  completed: "Selesai",
  cancelled: "Batal",
  awaiting: "Menunggu",
};

const STATUS_CLASS: Record<string, string> = {
  received: "pos-st-baru",
  preparing: "pos-st-dapur",
  ready: "pos-st-siap",
  completed: "pos-st-selesai",
  awaiting: "pos-st-dapur",
};

function umurMenit(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Nomor order tampilan: 6 hex pertama UUID -> desimal 5 digit.
 *  Memotong UUID mentah (#ec704) persis seperti kode warna CSS. */
function nomorOrder(id: string): string {
  const n = parseInt(id.replace(/-/g, "").slice(0, 6), 16) % 100000;
  return `#${String(n).padStart(5, "0")}`;
}

/** Umur terformat manusiawi: "baru saja", "12 mnt", "1 j 51 mnt". */
function umurLabel(iso: string): string {
  const m = umurMenit(iso);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt`;
  const j = Math.floor(m / 60);
  const sisa = m % 60;
  return sisa ? `${j} j ${sisa} mnt` : `${j} j`;
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
}) {
  const [cat, setCat] = useState("Semua Menu");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine");
  const [table, setTable] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();


  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [noteKey, setNoteKey] = useState<string | null>(null);

  const [quote, setQuote] = useState<PosQuote | null>(null);
  /** Signature keranjang yang dilayani `quote` — membedakan quote segar vs basi. */
  const [quoteKey, setQuoteKey] = useState("");
  /** True saat ringkasan server sedang dihitung — Amount menampilkan animasi. */
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [committed, setCommitted] = useState<PosCommitted | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<"cash" | "qris">("cash");
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  /** Item Details untuk pesanan aktif (modal ala template pos.html). */
  const [recentFor, setRecentFor] = useState<PosRecent | null>(null);
  /** Menu yg dilihat detail-nya dari dalam pesanan aktif. */
  const [detailMenu, setDetailMenu] = useState<PosMenu | null>(null);

  const live = committed === null;
  const lineCount = lines.reduce((s, l) => s + l.qty, 0);

  /** Nilai table_number yang dikirim: takeaway memakai label tetap. */
  const tableValue = orderType === "dine" ? table.trim() : "Bungkus";
  const tableLabel = orderType === "dine" ? table.trim() || "-" : "Bungkus";

  // ── Auto-quote: ringkasan dihitung server SETIAP keranjang/meja berubah
  // (debounce 600 ms) — "Amount to be Paid" terisi sendiri, bukan menunggu
  // tombol ditekan. Quote basi (keranjang sudah beda) dinetralkan saat
  // render lewat pencocokan signature, bukan setState di dalam effect.
  const cartKey = useMemo(
    () => JSON.stringify([lines.map(l => [l.key, l.qty, l.note]), tableValue]),
    [lines, tableValue],
  );
  const quoted = quote && quoteKey === cartKey ? quote : null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, lines.length, live]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return menus.filter(m => {
      if (!m.isActive) return false;
      if (cat !== "Semua Menu" && (m.category ?? "") !== cat) return false;
      if (needle && !m.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [menus, cat, q]);

  function openOptions(m: PosMenu) {
    // Semua klik kartu melewati modal Item Details (ala template):
    // satu gerbang visual, min/max divalidasi saat submit di modal itu.
    setDetailMenu(m);
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
    setSelectedKey(key);
    setDetailMenu(null);
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
    if (selectedKey === key) setSelectedKey(null);
    if (noteKey === key) setNoteKey(null);
  }

  function setLineNote(key: string, value: string) {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, note: value } : l)));
  }

  /** Quote server: harga item, pajak, service — semuanya dari server, bukan JS klien.
   *  Mengembalikan juga quote_id untuk commit (checkout_metadata wajib server). */
  async function refreshQuote(): Promise<(PosQuote & { quoteId: string }) | null> {
    if (lines.length === 0) return null;
    const res = await fetch("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cafeId,
        table: tableValue || "1",
        notes: null,
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
      | (PosQuote & { quote_id?: string })
      | { error?: string }
      | null;
    if (!res.ok || !data || "error" in data || !("quote_id" in data) || !data.quote_id) {
      setMsg({ kind: "err", text: "Gagal menghitung ringkasan. Coba lagi." });
      return null;
    }
    const q = data as PosQuote & { quote_id: string };
    setQuote(q);
    return { ...q, quoteId: q.quote_id };
  }

  async function commit(draft: boolean): Promise<PosCommitted | null> {
    if (orderType === "dine" && !table.trim()) {
      setMsg({ kind: "err", text: "Isi nomor meja untuk Dine In (atau pilih Take Away)." });
      return null;
    }
    if (lines.length === 0) return null;
    const qq = await refreshQuote();
    if (!qq) return null;

    const idempotencyKey = crypto.randomUUID();
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        cafeId,
        table: tableValue || "1",
        notes: null,
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
      setMsg({ kind: "err", text: data?.message ?? data?.error ?? "Pesanan gagal dikirim." });
      return null;
    }

    const c: PosCommitted = { id: data.order.id_order, token: data.orderToken, table: tableValue };
    setCommitted(c);
    setLines([]);
    setSelectedKey(null);
    setNoteKey(null);
    setQuote(null);
    setQuoteKey("");
    setMsg({
      kind: "ok",
      text: draft
        ? `Draf ${c.id.slice(0, 6)} tersimpan. Selesaikan dari kartu Pesanan.`
        : `Pesanan ${c.id.slice(0, 6)} dikirim ke dapur.`,
    });
    return c;
  }

  function printStruk(orderId: string, token: string) {
    printReceipt(
      buildReceiptHtml(
        {
          id_order: orderId,
          table_number: committed?.table ?? tableValue,
          items: quote?.items ?? [],
          total: quote?.total ?? 0,
          payment_method: "cash",
          payment_status: "unpaid",
          created_at: new Date().toISOString(),
          notes: null,
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
    void token;
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
    setMsg({ kind: "ok", text: `Pesanan ${committed.id.slice(0, 6)} lunas (tunai).` });
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
    setMsg({ kind: "ok", text: `Pesanan ${committed.id.slice(0, 6)} dibatalkan.` });
    setCommitted(null);
    setPayOpen(false);
  }

  const now = new Date();
  const tanggalCetak = now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const jamCetak = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="pos-root">
      {/* ══════════ KOLOM KIRI: pesanan aktif + katalog ══════════ */}
      <div className="pos-main">
        {recent.length > 0 && (
          <section className="pos-recent" aria-label="Pesanan aktif hari ini">
            <div className="pos-recent-head">
              <h2>Pesanan Aktif</h2>
              <Link className="pos-recent-link" href="/dashboard-v2/pesanan">
                Semua Pesanan
              </Link>
            </div>
            <div className="pos-recent-row">
              {recent.map(o => {
                const umur = umurMenit(o.createdAt);
                // Umur panjang = tekanan operasional: tepi kartu menyala.
                const urgency =
                  umur >= 60 ? " pos-rc-urgent" : umur >= 30 ? " pos-rc-warn" : "";
                const layanan = /^(Bungkus)$/i.test(o.table)
                  ? { icon: ShoppingBagIcon, label: "Bungkus" }
                  : { icon: BikeIcon, label: `Meja ${o.table}` };
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`pos-recent-card${urgency}`}
                    title={`Buka Item Details: ${nomorOrder(o.id)}`}
                    onClick={() => setRecentFor(o)}
                  >
                    <span className="pos-rc-top">
                      <span className="pos-recent-id">{nomorOrder(o.id)}</span>
                      <span className={`pos-st ${STATUS_CLASS[o.status] ?? ""}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </span>
                    <span className="pos-rc-mid">
                      <layanan.icon className="h-3.5 w-3.5" />
                      <span className="pos-recent-meja">{layanan.label}</span>
                      <span className="pos-rc-qty">{o.itemCount} item</span>
                    </span>
                    <span className="pos-rc-bot">
                      <span className={`pos-rc-umur${umur >= 60 ? " pos-rc-late" : ""}`}>
                        {umurLabel(o.createdAt)}
                      </span>
                      <b className="pos-recent-total">{rupiah(o.total)}</b>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="pos-catalog" aria-label="Menu">
          <div className="pos-catalog-head">
            <h2>Menu Categories</h2>
            <span className="pos-kasir">Kasir: {staffName}</span>
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

          <label className="pos-search">
            <SearchIcon className="h-4 w-4" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari menu"
              aria-label="Cari menu"
            />
          </label>

          {visible.length === 0 ? (
            <div className="pos-empty">Tidak ada menu yang cocok.</div>
          ) : (
            <div className="pos-grid">
              {visible.map(m => {
                const sale = hargaJual(m);
                const hasDisc = sale !== m.price;
                return (
                  <button key={m.id} type="button" className="pos-card" onClick={() => openOptions(m)}>
                    <span className="pos-card-img">
                      {m.imageUrl ? (
                        <Image
                          src={m.imageUrl}
                          alt=""
                          width={320}
                          height={200}
                          sizes="(max-width: 1024px) 45vw, 220px"
                          loading="eager"
                        />
                      ) : (
                        <span className="pos-card-img-empty" aria-hidden />
                      )}
                      {hasDisc && <span className="pos-flag">Diskon {m.discountPct}%</span>}
                    </span>
                    <span className="pos-card-cat">{m.category ?? "Menu"}</span>
                    <span className="pos-card-name">{m.name}</span>
                    <span className="pos-card-foot">
                      <span className="pos-card-price">
                        {hasDisc && <s>{rupiah(m.price)}</s>} {rupiah(sale)}
                      </span>
                      <span className="pos-card-add" aria-hidden>
                        <PlusIcon className="h-4 w-4" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ══════════ KOLOM KANAN: keranjang ══════════ */}
      <aside className="pos-cart" aria-label="Pesanan berjalan">
        <div className="pos-cart-orderhead">
          <span className="pos-cart-ordertitle">
            {live ? "Pesanan Baru" : `Order #${committed!.id.slice(0, 5)}`}
          </span>
          <span className="pos-cart-orderdate">
            {tanggalCetak}, {jamCetak}
          </span>
        </div>

        <div className="pos-otype" role="tablist" aria-label="Tipe pesanan">
          <button
            type="button"
            role="tab"
            aria-selected={orderType === "dine"}
            className={`pos-otype-btn${orderType === "dine" ? " pos-otype-on" : ""}`}
            onClick={() => setOrderType("dine")}
          >
            <UtensilsIcon className="h-3.5 w-3.5" /> Dine In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={orderType === "takeaway"}
            className={`pos-otype-btn${orderType === "takeaway" ? " pos-otype-on" : ""}`}
            onClick={() => setOrderType("takeaway")}
          >
            <ShoppingBagIcon className="h-3.5 w-3.5" /> Take Away
          </button>
        </div>

        {orderType === "dine" ? (
          <input
            className="pos-meja"
            value={table}
            onChange={e => {
              setTable(e.target.value);
              setQuote(null);
            }}
            placeholder="Nomor meja, mis. 12"
            aria-label="Nomor meja"
            disabled={!live}
          />
        ) : (
          <p className="pos-otype-note">
            {orderType === "takeaway" ? "Pesanan dibawa pulang" : "Pesanan diantar ke alamat tamu"} —
            tercatat sebagai “{tableLabel}”.
          </p>
        )}

        <div className="pos-cart-head">
          <span className="pos-cart-title">
            <ShoppingCartIcon className="h-4 w-4" /> Ordered Menus
          </span>
          <span className="pos-cart-count">Total : {lineCount}</span>
        </div>

        <div className="pos-cart-items">
          {lines.length === 0 ? (
            <p className="pos-empty">Keranjang kosong. Klik menu di kiri untuk menambah.</p>
          ) : (
            lines.map(l => {
              const open = selectedKey === l.key;
              return (
                <div key={l.key} className={`pos-line${open ? " pos-line-sel" : ""}`}>
                  <div className="pos-line-main">
                    <span className="pos-line-thumb">
                      {l.menu.imageUrl ? (
                        <Image
                          src={l.menu.imageUrl}
                          alt=""
                          width={56}
                          height={56}
                          sizes="56px"
                          loading="eager"
                        />
                      ) : (
                        <span className="pos-line-thumb-empty" aria-hidden />
                      )}
                    </span>
                    <div className="pos-line-body">
                      <button
                        type="button"
                        className="pos-line-name"
                        onClick={() => setSelectedKey(open ? null : l.key)}
                        aria-expanded={open}
                      >
                        {lineLabel(l)}
                      </button>
                      {l.options.length > 0 && (
                        <span className="pos-chips">
                          {l.options.map(o => (
                            <span key={o.id_option_value} className="pos-chip">
                              {o.name}
                            </span>
                          ))}
                        </span>
                      )}
                      <div className="pos-line-row">
                        <span className="pos-stepper">
                          <button type="button" aria-label="Kurangi" onClick={() => changeQty(l.key, -1)}>
                            <MinusIcon className="h-3.5 w-3.5" />
                          </button>
                          <b>{l.qty}</b>
                          <button type="button" aria-label="Tambah" onClick={() => changeQty(l.key, 1)}>
                            <PlusIcon className="h-3.5 w-3.5" />
                          </button>
                        </span>
                        {l.note ? (
                          <span className="pos-line-noteprev" title={l.note}>
                            {l.note}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="pos-line-addnote"
                            onClick={() => setNoteKey(noteKey === l.key ? null : l.key)}
                          >
                            Add Note
                          </button>
                        )}
                        <button
                          type="button"
                          className="pos-line-x"
                          aria-label={`Hapus ${l.menu.name}`}
                          onClick={() => removeLine(l.key)}
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {open && (
                    <div className="pos-line-detail">
                      <div>
                        <span>Item Rate</span>
                        <b>{rupiah(lineRate(l))}</b>
                      </div>
                      <div>
                        <span>Amount</span>
                        <b>{rupiah(lineRate(l) * l.qty)}</b>
                      </div>
                    </div>
                  )}

                  {noteKey === l.key && (
                    <input
                      className="pos-line-note"
                      value={l.note}
                      onChange={e => setLineNote(l.key, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") setNoteKey(null);
                      }}
                      onBlur={() => setNoteKey(null)}
                      autoFocus
                      placeholder="Catatan untuk dapur (Enter untuk simpan)"
                      aria-label={`Catatan ${l.menu.name}`}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Catatan hanya per-item (Add Note / Item Details) — tidak ada lagi
            catatan global, supaya tidak dobel dan jelas tujuannya ke dapur. */}

        <div className="pos-summary">
          <h3>Payment Summary</h3>
          {quoted ? (
            <>
              <div>
                <span>Sub Total</span>
                <b>{rupiah(quoted.subtotal)}</b>
              </div>
              {quoted.service_amount > 0 && (
                <div>
                  <span>Service ({quoted.service_pct}%)</span>
                  <b>{rupiah(quoted.service_amount)}</b>
                </div>
              )}
              <div>
                <span>Pajak ({quoted.tax_pct}%)</span>
                <b>{rupiah(quoted.tax_amount)}</b>
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

        <div className={`pos-amount${quoteBusy ? " pos-amount-busy" : ""}`}>
          <span>Amount to be Paid</span>
          <b>{quoted ? rupiah(quoted.total) : "—"}</b>
        </div>

        <div className="pos-actions pos-actions-grid">
          {live ? (
            <>
              <button
                type="button"
                className="pos-btn pos-btn-primary pos-cta"
                disabled={busy || lines.length === 0}
                onClick={() => startTransition(() => void commit(false))}
              >
                Place an Order
              </button>
              <button type="button" className="pos-btn" disabled={busy || lines.length === 0} onClick={() => startTransition(() => void commit(true))}>
                <FilesIcon className="h-4 w-4" /> Draft
              </button>
              <button type="button" className="pos-btn" disabled={busy || lines.length === 0} onClick={() => startTransition(() => void refreshQuote())}>
                <CalculatorIcon className="h-4 w-4" /> Ringkasan
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pos-btn pos-btn-primary pos-cta"
                onClick={() => {
                  setPayMode("cash");
                  setQrisUrl(null);
                  setPayOpen(true);
                }}
              >
                Bayar
              </button>
              <button type="button" className="pos-btn" onClick={() => committed && printStruk(committed.id, committed.token)}>
                <PrinterIcon className="h-4 w-4" /> Print
              </button>
              <button type="button" className="pos-btn" onClick={() => committed && printStruk(committed.id, committed.token)}>
                <FileTextIcon className="h-4 w-4" /> Invoice
              </button>
              <button
                type="button"
                className="pos-btn"
                onClick={() => {
                  setCommitted(null);
                  setPayOpen(false);
                }}
              >
                <FilesIcon className="h-4 w-4" /> Draft
              </button>
              <button type="button" className="pos-btn pos-btn-danger" onClick={() => void batalPesanan()}>
                <XIcon className="h-4 w-4" /> Cancel
              </button>
              <button type="button" className="pos-btn" onClick={() => void batalPesanan()}>
                <ZapIcon className="h-4 w-4" /> Void
              </button>
              <Link className="pos-btn" href="/dashboard-v2/pesanan">
                <ScrollTextIcon className="h-4 w-4" /> Transactions
              </Link>
            </>
          )}
        </div>

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
      </aside>

      {/* ══════════ Modal: Item Details pesanan aktif ══════════ */}
      {recentFor && (
        <div className="dp-modal-backdrop" onClick={() => { setRecentFor(null); setDetailMenu(null); }}>
          <div className="dp-modal dp-item-modal" role="dialog" aria-modal="true" aria-label="Item Details pesanan" onClick={e => e.stopPropagation()}>
            <div className="dp-modal-head">
              <h2>
                Item Details · #{recentFor.id.slice(0, 5)}{" "}
                <span className="dp-item-ordermeta">
                  {/^(Bungkus|Delivery)$/i.test(recentFor.table) ? recentFor.table : `Meja ${recentFor.table}`} · {rupiah(recentFor.total)}
                </span>
              </h2>
              <button type="button" className="pos-line-x" aria-label="Tutup" onClick={() => { setRecentFor(null); setDetailMenu(null); }}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="dp-modal-body">
              <p className="dp-hint">
                Pilih menu di bawah untuk menambahkannya ke pesanan #{recentFor.id.slice(0, 5)}.
                Perubahan ditulis ulang di server (stok &amp; harga divalidasi penuh).
              </p>
              <div className="dp-item-picker">
                {menus.filter(m => m.isActive).map(m => (
                  <button key={m.id} type="button" className={`dp-pick-card${detailMenu?.id === m.id ? " dp-pick-on" : ""}`} onClick={() => setDetailMenu(m)}>
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
                  onDone={() => { setRecentFor(null); setDetailMenu(null); }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Modal: opsi menu ══════════ */}
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
              <h2>Bayar {committed.id.slice(0, 6)}</h2>
              <button type="button" className="pos-line-x" aria-label="Tutup" onClick={() => setPayOpen(false)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="pos-modal-body">
              <p className="pos-pay-total">
                {quoted ? rupiah(quoted.total) : "Muat ulang ringkasan"}{" "}
                <span>· {/^(Bungkus|Delivery)$/i.test(committed.table) ? committed.table : `meja ${committed.table}`}</span>
              </p>
              <div className="pos-pay-tabs" role="tablist" aria-label="Metode pembayaran">
                <button
                  type="button"
                  role="tab"
                  aria-selected={payMode === "cash"}
                  className={`pos-cat${payMode === "cash" ? " pos-cat-on" : ""}`}
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
                  className={`pos-cat${payMode === "qris" ? " pos-cat-on" : ""}`}
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
      {detailMenu && (
        <PosItemDetails
          menu={detailMenu}
          optionGroups={optionGroups}
          onAdd={addFromDetails}
          onClose={() => setDetailMenu(null)}
        />
      )}
    </div>
  );
}
