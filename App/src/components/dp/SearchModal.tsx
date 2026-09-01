"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChefHatIcon,
  ClipboardListIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { searchDashboard, type SearchResults } from "@/lib/dashboard-search";

/** Modal "Search" ala Dream POS (recreation setia dari referensi):
 *  kartu putih di atas backdrop redup — header "Search" + tombol bulat ×,
 *  input "Search your keyword" ber-ikon kaca pembesar di KANAN, tab filter
 *  dengan garis bawah aktif, daftar hasil ber-garis pemisah, tombol
 *  "View All →" di footer.
 *
 *  Diferensiasi dari template (dokumen repo melarang kontrol dekoratif):
 *  - Tab hanya **Orders** dan **Kitchen** — tab Customer template tidak
 *    ada karena 3Diner tidak punya entitas customer.
 *  - Hasil = data nyata per-kafe (server action `searchDashboard`),
 *    kosong = pesan keadaan kosong sungguhan, bukan dummy. */

type Tab = "orders" | "kitchen";

const TABS: Array<{ key: Tab; label: string; icon: typeof SearchIcon }> = [
  { key: "orders", label: "Orders", icon: ClipboardListIcon },
  { key: "kitchen", label: "Kitchen", icon: ChefHatIcon },
];

const STATUS_LABEL: Record<string, string> = {
  awaiting: "Menunggu",
  received: "Diterima",
  preparing: "Diproses",
  ready: "Siap",
  on_delivery: "Diantar",
  completed: "Selesai",
  cancelled: "Batal",
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("orders");
  const [q, setQ] = useState("");
  /** Hasil terakhir + signature kuerinya — hasil basi dinetralkan saat render. */
  const [results, setResults] = useState<{ key: string; data: SearchResults } | null>(null);
  /** Kueri yang sedang dikejar server (beda dari hasil yang sudah tiba). */
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const needle = q.trim();
  const queryKey = `${tab}:${needle.toLowerCase()}`;
  const current = results && results.key === queryKey ? results.data : null;
  const loading = needle !== "" && (loadingKey === queryKey || current === null);

  // Escape menutup + fokus masuk input saat modal dibuka.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounce 300 ms: cukup cepat terasa langsung, hemat query.
  // Semua setState berada di callback async — bukan body effect sinkron.
  useEffect(() => {
    if (!open || !needle) return;
    const t = setTimeout(async () => {
      setLoadingKey(queryKey);
      const res = await searchDashboard(needle, tab);
      setResults({ key: queryKey, data: res });
      setLoadingKey(null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, open]);

  if (!open) return null;

  const rows = current === null ? [] : tab === "orders" ? current.orders : current.menus;

  return (
    <div className="dp-smodal-backdrop" onClick={onClose} role="presentation">
      <div
        className="dp-smodal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
      >
        <div className="dp-smodal-head">
          <h2 id={titleId}>Search</h2>
          <button type="button" className="dp-smodal-x" aria-label="Tutup pencarian" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="dp-smodal-input">
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search your keyword"
            aria-label="Kata kunci pencarian"
            maxLength={60}
          />
          <SearchIcon className="dp-smodal-sicon" aria-hidden />
        </div>

        <div className="dp-smodal-tabs" role="tablist" aria-label="Lingkup pencarian">
          {TABS.map(t => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                className={`dp-smodal-tab${on ? " dp-smodal-tab-on" : ""}`}
                onClick={() => setTab(t.key)}
              >
                <span className="dp-smodal-tabic" aria-hidden>
                  <t.icon className="h-3.5 w-3.5" />
                </span>
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="dp-smodal-list">
          {q.trim() === "" ? (
            <p className="dp-smodal-empty">
              {tab === "orders"
                ? "Cari nomor pesanan, nomor meja, atau catatan pesanan."
                : "Cari nama menu atau kategori katalog dapur."}
            </p>
          ) : loading ? (
            <p className="dp-smodal-empty">Mencari…</p>
          ) : rows.length === 0 ? (
            <p className="dp-smodal-empty">
              Tidak ada {tab === "orders" ? "pesanan" : "menu"} yang cocok dengan “{q.trim()}”.
            </p>
          ) : tab === "orders" ? (
            current!.orders.map(o => (
              <Link
                key={o.id_order}
                href="/dashboard-v2/pesanan"
                className="dp-smodal-row"
                onClick={onClose}
              >
                <span className="dp-smodal-row-main">
                  <b>{STATUS_LABEL[o.status ?? ""] ?? o.status ?? "Pesanan"} · Meja {o.table_number ?? "-"}</b>
                  <small>{new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" }).format(new Date(o.created_at))}</small>
                </span>
                <span className="dp-smodal-row-side">#{o.id_order.slice(0, 5).toUpperCase()}</span>
              </Link>
            ))
          ) : (
            current!.menus.map(m => (
              <Link
                key={m.id_menu}
                href={`/dashboard-v2/menu/${m.id_menu}/edit`}
                className="dp-smodal-row"
                onClick={onClose}
              >
                <span className="dp-smodal-thumb" aria-hidden>
                  {m.image_url ? (
                    <Image src={m.image_url} alt="" width={36} height={36} sizes="36px" className="dp-smodal-thumb-img" />
                  ) : (
                    <ChefHatIcon className="h-4 w-4" />
                  )}
                </span>
                <span className="dp-smodal-row-main">
                  <b>
                    {m.nama_menu}
                    {!m.is_active && <em className="dp-smodal-inactive"> nonaktif</em>}
                  </b>
                  <small>{m.category ?? "Tanpa kategori"} · {rupiah(m.harga_menu)}</small>
                </span>
                <span className="dp-smodal-row-side">{m.category ?? ""}</span>
              </Link>
            ))
          )}
        </div>

        {tab === "orders" ? (
          <Link href="/dashboard-v2/pesanan" className="dp-smodal-viewall" onClick={onClose}>
            View All →
          </Link>
        ) : (
          <Link href="/dashboard-v2/items" className="dp-smodal-viewall" onClick={onClose}>
            View All →
          </Link>
        )}
      </div>
    </div>
  );
}
