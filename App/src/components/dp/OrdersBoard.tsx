"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheckIcon,
  BanIcon,
  BikeIcon,
  ClockIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  SearchIcon,
  TimerIcon,
  WalletIcon,
} from "lucide-react";

/** Papan Pesanan ala Dream POS: 6 kartu status, tab ber-counter, pencarian,
 *  toggle grid/list, kartu order 3 kolom, pager — semua interaksi NYATA.
 *  Read-only murni: mutasi status tetap milik Kasir (dropdown nonaktif beralasan). */

export type BoardOrder = {
  id_order: string;
  created_at: string;
  status: string;
  payment_status: string;
  table_number: string | null;
  total: number | null;
  items: { nama_menu?: string | null; qty?: number | null }[];
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const jam = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");

/** Label & urutan kolom mengikuti pipeline kafe (bukan karangan): */
const TABS = [
  { key: "semua", label: "Semua" },
  { key: "awaiting", label: "Menunggu" },
  { key: "ready", label: "Siap Diantar" },
  { key: "completed", label: "Selesai" },
] as const;

const STATUS_TEXT: Record<string, string> = {
  awaiting: "Menunggu",
  ready: "Siap",
  preparing: "Diproses",
  on_delivery: "Diantar",
  completed: "Selesai",
  cancelled: "Batal",
};

const PAGE_SIZE = 9;

export default function OrdersBoard({ orders }: { orders: BoardOrder[] }) {
  const [tab, setTab] = useState<string>("semua");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null); // "+N item" expand

  const count = (key: string) =>
    key === "semua" ? orders.length : orders.filter(o => o.status === key).length;

  const filtered = useMemo(() => {
    const base = tab === "semua" ? orders : orders.filter(o => o.status === tab);
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      o =>
        o.id_order.toLowerCase().includes(needle) ||
        (o.table_number ?? "").toLowerCase().includes(needle) ||
        o.items.some(it => (it.nama_menu ?? "").toLowerCase().includes(needle)),
    );
  }, [orders, tab, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const unpaid = orders.filter(o => o.payment_status !== "paid").length;
  const done = count("completed");

  // 6 kartu ringkasan atas — angka nyata dari data yang ada.
  const stats = [
    { icon: BadgeCheckIcon, tone: "#0d76e1", bg: "rgba(13,118,225,.1)", label: "Semua Pesanan", n: orders.length },
    { icon: TimerIcon, tone: "#e86c1f", bg: "rgba(232,108,31,.12)", label: "Menunggu", n: count("awaiting") },
    { icon: PackageCheckIcon, tone: "#8b5cf6", bg: "rgba(139,92,246,.12)", label: "Siap Diantar", n: count("ready") },
    { icon: BikeIcon, tone: "#17b26a", bg: "rgba(23,178,106,.12)", label: "Selesai", n: done },
    { icon: WalletIcon, tone: "#e0b100", bg: "rgba(224,177,0,.14)", label: "Belum Bayar", n: unpaid },
    { icon: BanIcon, tone: "#e11d48", bg: "rgba(225,29,72,.1)", label: "Dibatalkan", n: count("cancelled") },
  ];

  return (
    <div className="dp-orders">
      {/* Ringkasan 6 kartu */}
      <section className="dp-stat-row" aria-label="Ringkasan pesanan">
        {stats.map(s => (
          <div key={s.label} className="dp-stat">
            <div>
              <p className="dp-stat-lbl">{s.label}</p>
              <p className="dp-stat-n">{s.n}</p>
            </div>
            <span className="dp-stat-ic" style={{ background: s.bg }}>
              <s.icon size={19} color={s.tone} />
            </span>
          </div>
        ))}
      </section>

      {/* Toolbar: tabs kiri, toggle + cari kanan */}
      <section className="dp-toolbar">
        <div className="dp-tabs" role="tablist" aria-label="Saring pesanan">
          {TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? "dp-tab dp-tab-active" : "dp-tab"}
              onClick={() => { setTab(t.key); setPage(0); }}
            >
              {t.label} ({count(t.key)})
            </button>
          ))}
        </div>
        <div className="dp-tools">
          <button
            className="dp-tool"
            aria-pressed={view === "grid"}
            title="Tampilan kartu"
            onClick={() => setView("grid")}
          >
            <ReceiptTextIcon size={16} />
          </button>
          <button
            className="dp-tool"
            aria-pressed={view === "list"}
            title="Tampilan baris"
            onClick={() => setView("list")}
          >
            <ClockIcon size={16} />
          </button>
          <label className="dp-search">
            <SearchIcon size={15} />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(0); }}
              placeholder="Cari token / meja…"
              aria-label="Cari pesanan"
            />
          </label>
        </div>
      </section>

      {/* Kartu order */}
      {slice.length === 0 ? (
        <p className="dp-empty">Tidak ada pesanan pada saringan ini.</p>
      ) : (
        <section className={view === "grid" ? "dp-cards" : "dp-cards dp-cards-list"}>
          {slice.map(o => {
            const shown = openId === o.id_order ? o.items : o.items.slice(0, 3);
            return (
              <article key={o.id_order} className="dp-ocard">
                <header className="dp-ohead">
                  <span className="dp-oic"><ReceiptTextIcon size={15} /></span>
                  <h3 className="dp-o-no">#{o.id_order.slice(-5)}</h3>
                  <span className="dp-o-type">{o.table_number ? `Meja ${o.table_number}` : "Take Away"}</span>
                </header>

                <div className="dp-otoken">
                  <span>{jam(o.created_at)}</span>
                  <strong>{rupiah(o.total ?? 0)}</strong>
                </div>

                <ul className="dp-oitems">
                  {shown.map((it, i) => (
                    <li key={`${o.id_order}-${i}`}>
                      <span className="dp-item-name">{it.nama_menu ?? "Item"}</span>
                      <span className="dp-item-dots" aria-hidden="true" />
                      <span className="dp-item-qty">×{it.qty ?? 1}</span>
                    </li>
                  ))}
                  {o.items.length > 3 && openId !== o.id_order && (
                    <li>
                      <button className="dp-more" onClick={() => setOpenId(o.id_order)}>
                        +{o.items.length - 3} item lainnya
                      </button>
                    </li>
                  )}
                </ul>

                <footer className="dp-ofoot">
                  <span className={o.payment_status === "paid" ? "dp-chip dp-chip-paid" : "dp-chip"}>
                    {o.payment_status === "paid" ? "Lunas" : "Belum bayar"}
                  </span>
                  <span
                    className="dp-status"
                    title="Status diubah melalui Kasir"
                  >
                    {STATUS_TEXT[o.status] ?? o.status}
                  </span>
                </footer>
              </article>
            );
          })}
        </section>
      )}

      {/* Pager */}
      {pages > 1 && (
        <nav className="dp-pager" aria-label="Halaman">
          <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>‹ Sebelumnya</button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              aria-current={i === safePage ? "page" : undefined}
              className={i === safePage ? "dp-page dp-page-on" : "dp-page"}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
          <button disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Berikutnya ›</button>
        </nav>
      )}
    </div>
  );
}
