"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { buildReceiptHtml, printReceipt } from "@/lib/receipt-html";
import type { OrderItem, SelectedOption } from "@/types";

/** POS ala template pos.html Dream POS, dengan tulis-path nyata.
 *  Alur: pilih menu (varian/catatan via panel opsi) -> keranjang -> quote
 *  (subtotal/pajak/service dari server) -> commit (kirim dapur / simpan draf)
 *  -> tunai (mark_order_cash_paid) / QRIS (charge) -> struk / batal. */

export type PosMenu = {
  id: string;
  name: string;
  price: number;
  discountPct: number | null;
  imageUrl: string | null;
  category: string | null;
  isActive: boolean;
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

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

function hargaJual(m: PosMenu): number {
  const d = Math.min(Math.max(m.discountPct ?? 0, 0), 100);
  return Math.round(m.price * (1 - d / 100));
}

function lineLabel(line: Line): string {
  if (line.options.length === 0) return line.menu.name;
  return `${line.menu.name} · ${line.options.map(o => o.name).join(", ")}`;
}

export default function PosBoard({
  cafeId,
  cafeName,
  cafeAddress,
  taxConfigured,
  staffName,
  menus,
  optionGroups,
  categories,
}: {
  cafeId: string;
  cafeName: string;
  cafeAddress: string | null;
  taxConfigured: boolean;
  staffName: string;
  menus: PosMenu[];
  optionGroups: PosMenuOption[];
  categories: PosCategoryChip[];
}) {
  const [cat, setCat] = useState("Semua Menu");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [table, setTable] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const [optFor, setOptFor] = useState<PosMenu | null>(null);
  const [optPick, setOptPick] = useState<Map<string, SelectedOption>>(new Map());
  const [optNote, setOptNote] = useState("");
  const [optErr, setOptErr] = useState<string | null>(null);

  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [committed, setCommitted] = useState<PosCommitted | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<"cash" | "qris">("cash");
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  const printRef = useRef<PosCommitted | null>(null);

  const live = committed === null;
  const activeGroups = optFor ? optionGroups.filter(g => g.menuId === optFor.id) : [];
  const lineCount = lines.reduce((s, l) => s + l.qty, 0);

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
    const groups = optionGroups.filter(g => g.menuId === m.id);
    setOptErr(null);
    setOptNote("");
    if (groups.length === 0) {
      addLine(m, [], "");
      return;
    }
    setOptFor(m);
    setOptPick(new Map());
  }

  function addLine(m: PosMenu, options: SelectedOption[], itemNote: string) {
    const key = [m.id, options.map(o => o.id_option_value).sort().join("|"), itemNote].join("#");
    setLines(prev => {
      const hit = prev.find(l => l.key === key);
      if (hit) return prev.map(l => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key, menu: m, qty: 1, options, note: itemNote }];
    });
    setQuote(null);
  }

  function changeQty(key: string, delta: number) {
    setLines(prev =>
      prev
        .map(l => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter(l => l.qty > 0),
    );
    setQuote(null);
  }

  function setLineNote(key: string, value: string) {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, note: value } : l)));
  }

  function confirmOptions() {
    if (!optFor) return;
    const picked = [...optPick.values()];
    for (const g of activeGroups) {
      const n = picked.filter(o => o.group_name === g.name).length;
      if (n < g.minSelect) {
        setOptErr(`Pilih minimal ${g.minSelect} pada “${g.name}”.`);
        return;
      }
      if (n > g.maxSelect) {
        setOptErr(`Maksimal ${g.maxSelect} pada “${g.name}”.`);
        return;
      }
    }
    addLine(optFor, picked, optNote.trim());
    setOptFor(null);
  }

  function toggleOption(groupId: string, groupName: string, v: PosOptionValue, maxSelect: number) {
    setOptPick(prev => {
      const next = new Map(prev);
      const k = `${groupId}:${v.id}`;
      if (next.has(k)) {
        next.delete(k);
      } else {
        if (maxSelect === 1) {
          for (const ek of [...next.keys()]) if (ek.startsWith(`${groupId}:`)) next.delete(ek);
        }
        if ([...next.keys()].filter(ek => ek.startsWith(`${groupId}:`)).length >= maxSelect) {
          return prev;
        }
        next.set(k, {
          id_option_value: v.id,
          group_name: groupName,
          name: v.name,
          price_delta: v.priceDelta,
        });
      }
      return next;
    });
    setOptErr(null);
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
        table: table.trim() || "1",
        notes: note.trim(),
        paymentChannel: "cashier",
        items: lines.map(l => ({
          id_menu: l.menu.id,
          qty: l.qty,
          options: l.options.map(o => o.id_option_value),
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
    const t = table.trim();
    if (!t) {
      setMsg({ kind: "err", text: "Isi nomor meja dulu (atau tulis 0 untuk take away)." });
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
        table: t,
        notes: note.trim(),
        paymentChannel: "cashier",
        quoteId: qq.quoteId,
        items: lines.map(l => ({
          id_menu: l.menu.id,
          qty: l.qty,
          options: l.options.map(o => o.id_option_value),
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

    const c: PosCommitted = {
      id: data.order.id_order,
      token: data.orderToken,
      table: t,
    };
    setCommitted(c);
    printRef.current = c;
    setLines([]);
    setNote("");
    setQuote(null);
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
          table_number: committed?.table ?? table,
          items: (quote?.items ?? []).length > 0 ? quote!.items : [],
          total: quote?.total ?? 0,
          payment_method: "cash",
          payment_status: "unpaid",
          created_at: new Date().toISOString(),
          notes: note.trim() || null,
        },
        { name: cafeName, address: cafeAddress, taxConfigured },
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

  const quoted = quote;

  return (
    <div className="pos-root">
      {/* ══════════ KOLOM KIRI: katalog ══════════ */}
      <div className="pos-main">
        <div className="pos-toolbar">
          <div>
            <h1 className="pos-title">Point of Sale</h1>
            <p className="pos-sub">
              {cafeName} · Kasir {staffName}
            </p>
          </div>
          <div className="pos-toolbar-right">
            <span className="pos-meja-lbl">Meja</span>
            <input
              className="pos-meja"
              value={table}
              onChange={e => {
                setTable(e.target.value);
                setQuote(null);
              }}
              placeholder="mis. 12"
              aria-label="Nomor meja"
              disabled={!live}
            />
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
                <button
                  key={m.id}
                  type="button"
                  className="pos-card"
                  onClick={() => openOptions(m)}
                >
                  <span className="pos-card-img">
                    {m.imageUrl ? (
                      <Image src={m.imageUrl} alt="" width={320} height={200} />
                    ) : (
                      <span className="pos-card-img-empty" aria-hidden />
                    )}
                    {hasDisc && <span className="pos-flag pos-flag-sale">Diskon {m.discountPct}%</span>}
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
      </div>

      {/* ══════════ KOLOM KANAN: keranjang ══════════ */}
      <aside className="pos-cart" aria-label="Pesanan berjalan">
        <div className="pos-cart-head">
          <span className="pos-cart-title">
            <ShoppingCartIcon className="h-4 w-4" /> Pesanan
          </span>
          <span className="pos-cart-count">{lineCount} item</span>
        </div>

        <p className="pos-cat-note">Meja {table.trim() || "-"}</p>

        <div className="pos-cart-items">
          {lines.length === 0 ? (
            <p className="pos-empty">Keranjang kosong. Klik menu di kiri untuk menambah.</p>
          ) : (
            lines.map(l => (
              <div key={l.key} className="pos-line">
                <div className="pos-line-head">
                  <span className="pos-line-name">{lineLabel(l)}</span>
                  <button
                    type="button"
                    className="pos-line-x"
                    aria-label={`Hapus ${l.menu.name}`}
                    onClick={() => changeQty(l.key, -l.qty)}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="pos-line-row">
                  <span className="pos-stepper">
                    <button
                      type="button"
                      aria-label="Kurangi"
                      onClick={() => changeQty(l.key, -1)}
                    >
                      <MinusIcon className="h-3.5 w-3.5" />
                    </button>
                    <b>{l.qty}</b>
                    <button type="button" aria-label="Tambah" onClick={() => changeQty(l.key, 1)}>
                      <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <span className="pos-line-amt">
                    {rupiah((hargaJual(l.menu) + l.options.reduce((s, o) => s + o.price_delta, 0)) * l.qty)}
                  </span>
                </div>
                <input
                  className="pos-line-note"
                  value={l.note}
                  onChange={e => setLineNote(l.key, e.target.value)}
                  placeholder="Catatan untuk dapur (opsional)"
                  aria-label={`Catatan ${l.menu.name}`}
                />
              </div>
            ))
          )}
        </div>

        <label className="pos-cart-note">
          Catatan pesanan
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="mis. tanpa gula, antar jam 1"
          />
        </label>

        <div className="pos-summary">
          {quoted ? (
            <>
              <div>
                <span>Subtotal</span>
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
              <div className="pos-total">
                <span>Total</span>
                <b>{rupiah(quoted.total)}</b>
              </div>
            </>
          ) : (
            <p className="pos-hint">
              Ringkasan (pajak & service) dihitung server saat menekan tombol aksi.
              {!taxConfigured && " Tarif pajak kafe belum diatur."}
            </p>
          )}
        </div>

        <div className="pos-actions">
          {live ? (
            <>
              <button
                type="button"
                className="pos-btn pos-btn-primary"
                disabled={busy || lines.length === 0}
                onClick={() => startTransition(() => void commit(false))}
              >
                Kirim ke Dapur
              </button>
              <button
                type="button"
                className="pos-btn"
                disabled={busy || lines.length === 0}
                onClick={() => startTransition(() => void commit(true))}
              >
                Simpan Draf
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pos-btn pos-btn-primary"
                onClick={() => {
                  setPayMode("cash");
                  setQrisUrl(null);
                  setPayOpen(true);
                }}
              >
                Bayar
              </button>
              <button
                type="button"
                className="pos-btn"
                onClick={() =>
                  committed &&
                  printStruk(
                    committed.id,
                    committed.token,
                  )
                }
              >
                <PrinterIcon className="h-4 w-4" /> Struk
              </button>
              <button type="button" className="pos-btn pos-btn-danger" onClick={() => void batalPesanan()}>
                <Trash2Icon className="h-4 w-4" /> Batalkan
              </button>
              <button
                type="button"
                className="pos-btn"
                onClick={() => {
                  setCommitted(null);
                  setPayOpen(false);
                }}
              >
                Pesanan Baru
              </button>
            </>
          )}
        </div>

        {msg && (
          <p
            className={msg.kind === "err" ? "pos-msg pos-msg-err" : msg.kind === "ok" ? "pos-msg pos-msg-ok" : "pos-msg"}
            role="status"
          >
            {msg.text}
          </p>
        )}
      </aside>

      {/* ══════════ Modal: opsi menu ══════════ */}
      {optFor && (
        <div className="pos-modal-backdrop" onClick={() => setOptFor(null)}>
          <div className="pos-modal" role="dialog" aria-modal="true" aria-label={`Opsi ${optFor.name}`} onClick={e => e.stopPropagation()}>
            <div className="pos-modal-head">
              <h2>{optFor.name}</h2>
              <button type="button" className="pos-line-x" aria-label="Tutup" onClick={() => setOptFor(null)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="pos-modal-body">
              {activeGroups.map(g => (
                <fieldset key={g.id} className="pos-opt-group">
                  <legend>
                    {g.name}
                    <small>
                      {g.minSelect > 0 ? ` wajib ${g.minSelect}` : " opsional"}
                      {g.maxSelect > 1 ? ` · maks ${g.maxSelect}` : ""}
                    </small>
                  </legend>
                  {g.values.map(v => {
                    const on = optPick.has(`${g.id}:${v.id}`);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={`pos-opt${on ? " pos-opt-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggleOption(g.id, g.name, v, g.maxSelect)}
                      >
                        <span>{v.name}</span>
                        <span>{v.priceDelta > 0 ? `+${rupiah(v.priceDelta)}` : "Gratis"}</span>
                      </button>
                    );
                  })}
                </fieldset>
              ))}
              <label className="pos-cart-note">
                Catatan item
                <textarea
                  value={optNote}
                  onChange={e => setOptNote(e.target.value)}
                  rows={2}
                  placeholder="mis. pedas level 2"
                />
              </label>
              {optErr && <p className="pos-msg pos-msg-err">{optErr}</p>}
            </div>
            <div className="pos-modal-foot">
              <button type="button" className="pos-btn" onClick={() => setOptFor(null)}>
                Batal
              </button>
              <button type="button" className="pos-btn pos-btn-primary" onClick={confirmOptions}>
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Modal: pembayaran ══════════ */}
      {payOpen && committed && (
        <div className="pos-modal-backdrop" onClick={() => setPayOpen(false)}>
          <div className="pos-modal" role="dialog" aria-modal="true" aria-label="Pembayaran" onClick={e => e.stopPropagation()}>
            <div className="pos-modal-head">
              <h2>Bayar {committed.id.slice(0, 6)}</h2>
              <button type="button" className="pos-line-x" aria-label="Tutup" onClick={() => setPayOpen(false)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="pos-modal-body">
              <p className="pos-pay-total">
                {quoted ? rupiah(quoted.total) : "Muat ulang ringkasan"}{" "}
                <span>· meja {committed.table}</span>
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
    </div>
  );
}
