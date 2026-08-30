"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheckIcon,
  BanIcon,
  BikeIcon,
  CheckIcon,
  ClipboardListIcon,
  ClockIcon,
  Columns3Icon,
  CookingPotIcon,
  LayoutGridIcon,
  type LucideIcon,
  PackageCheckIcon,
  PrinterIcon,
  ReceiptTextIcon,
  SearchIcon,
  StickyNoteIcon,
  TimerIcon,
  WalletIcon,
} from "lucide-react";
import { updateOrderStatus } from "@/lib/dashboard-actions";
import { cancelOrder } from "@/lib/kasir-actions";
import { buildReceiptHtml, printReceipt } from "@/lib/receipt-html";

/** Papan Pesanan ala Dream POS: 6 kartu status, tab ber-counter, pencarian,
 *  kartu order 3 kolom, pager — semua interaksi NYATA.
 *
 *  Dua mode tampilan yang bisa diganti lewat switcher toolbar:
 *  - "grid"  = papan kartu 3 kolom (mode lama).
 *  - "kanban" = recreation board Dream POS: 4 kolom bergaris warna
 *    (Pesanan Baru / Diproses / Selesai / Dibatalkan) dengan tombol aksi
 *    yang benar-benar memutasi status lewat jalur server yang sama dengan
 *    Kasir — tanpa tombol hias. */

export type BoardOrder = {
  id_order: string;
  created_at: string;
  status: string;
  payment_status: string;
  table_number: string | null;
  total: number | null;
  items: { nama_menu?: string | null; qty?: number | null; harga_menu?: number | null }[];
  notes?: string | null;
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

/** Kolom kanban: anggota = status pipeline yang digabung ke kolom tsb.
 *  Warna header mengikuti referensi (slate/amber/hijau/merah). */
const KANBAN_COLS: Array<{
  key: string;
  label: string;
  cls: string;
  icon: LucideIcon;
  anggota: readonly string[];
}> = [
  { key: "baru", label: "Pesanan Baru", cls: "dp-kb-col-new", icon: ClipboardListIcon, anggota: ["awaiting", "received"] },
  { key: "proses", label: "Diproses", cls: "dp-kb-col-proc", icon: CookingPotIcon, anggota: ["preparing", "ready"] },
  { key: "selesai", label: "Selesai", cls: "dp-kb-col-done", icon: BadgeCheckIcon, anggota: ["completed"] },
  { key: "batal", label: "Dibatalkan", cls: "dp-kb-col-batal", icon: BanIcon, anggota: ["cancelled"] },
];

/** Alasan batal preset — sama dengan dialog Kasir (CancelOrderDialog). */
const PRESET_BATAL = ["Tamu batal memesan", "Stok bahan habis", "Salah input meja", "Pesanan ganda"];

const PAGE_SIZE = 9;

export default function OrdersBoard({ orders, cafe }: { orders: BoardOrder[]; cafe: BoardCafe }) {
  // Salinan lokal untuk mutasi optimis — prop baru (revalidasi) selalu menang.
  const [rows, setRows] = useState<BoardOrder[]>(orders);
  const [lastProp, setLastProp] = useState<BoardOrder[]>(orders);
  if (orders !== lastProp) {
    setLastProp(orders);
    setRows(orders);
  }

  const [tab, setTab] = useState<string>("semua");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "kanban">("grid");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null); // "+N item" expand
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);
  const [batalFor, setBatalFor] = useState<BoardOrder | null>(null);

  const count = (key: string) =>
    key === "semua" ? rows.length : rows.filter(o => o.status === key).length;

  const filtered = useMemo(() => {
    const base = tab === "semua" ? rows : rows.filter(o => o.status === tab);
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      o =>
        o.id_order.toLowerCase().includes(needle) ||
        (o.table_number ?? "").toLowerCase().includes(needle) ||
        o.items.some(it => (it.nama_menu ?? "").toLowerCase().includes(needle)),
    );
  }, [rows, tab, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const unpaid = rows.filter(o => o.payment_status !== "paid").length;
  const done = count("completed");

  // 6 kartu ringkasan atas — angka nyata dari data yang ada.
  const stats = [
    { icon: BadgeCheckIcon, tone: "var(--dp-blue, #fd5002)", bg: "rgba(253,80,2,.1)", label: "Semua Pesanan", n: rows.length },
    { icon: TimerIcon, tone: "var(--dp-dt-orange-mid, #e86c1f)", bg: "rgba(232,108,31,.12)", label: "Menunggu", n: count("awaiting") },
    { icon: PackageCheckIcon, tone: "var(--dp-dt-violet, #8b5cf6)", bg: "rgba(139,92,246,.12)", label: "Siap Diantar", n: count("ready") },
    { icon: BikeIcon, tone: "var(--dp-dt-green-bright, #17b26a)", bg: "rgba(23,178,106,.12)", label: "Selesai", n: done },
    { icon: WalletIcon, tone: "var(--dp-dt-amber-bright, #e0b100)", bg: "rgba(224,177,0,.14)", label: "Belum Bayar", n: unpaid },
    { icon: BanIcon, tone: "var(--dp-dt-rose, #e11d48)", bg: "rgba(225,29,72,.1)", label: "Dibatalkan", n: count("cancelled") },
  ];

  function gantiStatusLokal(id: string, status: string) {
    setRows(rs => rs.map(o => (o.id_order === id ? { ...o, status } : o)));
  }

  /** Proses / Selesai — jalur server sama dengan yang dipakai dashboard lama. */
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
    setPesan({ ok: true, text: `Pesanan #${o.id_order.slice(-5)} → ${STATUS_TEXT[status]}.` });
  }

  /** Cetak struk dari kartu — builder & preferensi sama dengan printer POS. */
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
          payment_method: null,
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

      {/* Toolbar: tabs kiri, switch view + cari kanan */}
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
            <LayoutGridIcon size={16} />
          </button>
          <button
            className="dp-tool"
            aria-pressed={view === "kanban"}
            title="Tampilan kanban"
            onClick={() => setView("kanban")}
          >
            <Columns3Icon size={16} />
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

      {pesan ? (
        <p className={pesan.ok ? "dp-form-ok" : "dp-form-error"} style={{ marginTop: 10 }}>
          {pesan.text}
        </p>
      ) : null}

      {/* ════ MODE KANBAN — recreation board Dream POS ════ */}
      {view === "kanban" ? (
        <section className="dp-kb" aria-label="Papan pesanan kanban">
          {KANBAN_COLS.map(col => {
            const list = filtered.filter(o => col.anggota.includes(o.status));
            return (
              <div key={col.key} className={`dp-kb-col ${col.cls}`}>
                <header className="dp-kb-colhead">
                  <col.icon aria-hidden />
                  <span>{col.label}</span>
                  <span className="dp-kb-count">{String(list.length).padStart(2, "0")}</span>
                </header>

                {list.length === 0 ? (
                  <p className="dp-kb-empty">Kosong</p>
                ) : (
                  list.map(o => (
                    <KanbanCard
                      key={o.id_order}
                      o={o}
                      busy={busyId === o.id_order}
                      onProses={() => ubahStatus(o, "preparing")}
                      onSelesai={() => ubahStatus(o, "completed")}
                      onBatal={() => setBatalFor(o)}
                      onCetak={() => cetakStruk(o)}
                    />
                  ))
                )}
              </div>
            );
          })}
        </section>
      ) : (
        <>
          {/* Kartu order — mode kartu (lama) */}
          {slice.length === 0 ? (
            <p className="dp-empty">Tidak ada pesanan pada saringan ini.</p>
          ) : (
            <section className="dp-cards">
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
        </>
      )}

      {/* Dialog alasan batal — jalur & aturan sama dengan Kasir */}
      {batalFor ? (
        <BatalDialog
          o={batalFor}
          onClose={() => setBatalFor(null)}
          onDone={(ok, text) => {
            setBatalFor(null);
            setPesan({ ok, text });
            if (ok) gantiStatusLokal(batalFor.id_order, "cancelled");
          }}
        />
      ) : null}
    </div>
  );
}

/* ── Kartu kanban — anatomi mengikuti referensi: avatar, No/Tipe, waktu &
   total, item dengan dotted leader, bar catatan, dua tombol aksi. ── */
function KanbanCard({
  o,
  busy,
  onProses,
  onSelesai,
  onBatal,
  onCetak,
}: {
  o: BoardOrder;
  busy: boolean;
  onProses: () => void;
  onSelesai: () => void;
  onBatal: () => void;
  onCetak: () => void;
}) {
  const kolom = KANBAN_COLS.find(c => c.anggota.includes(o.status));
  const shown = o.items.slice(0, 4);

  return (
    <article className="dp-kb-card" data-order={o.id_order}>
      <header className="dp-kb-chead">
        <span className="dp-kb-cavatar"><ReceiptTextIcon size={16} /></span>
        <div className="dp-kb-cid">
          <h3>#{o.id_order.slice(-5)}</h3>
          <p>
            {o.table_number ? `Meja ${o.table_number}` : "Take Away"}
            <span className={o.payment_status === "paid" ? "dp-kb-paid" : "dp-kb-unpaid"}>
              {" "}· {o.payment_status === "paid" ? "Lunas" : "Belum bayar"}
            </span>
          </p>
        </div>
      </header>

      <div className="dp-kb-ctime">
        <span><ClockIcon size={13} aria-hidden /> {jam(o.created_at)}</span>
        <strong>{rupiah(o.total ?? 0)}</strong>
      </div>

      <ul className="dp-kb-citems">
        {shown.map((it, i) => (
          <li key={`${o.id_order}-${i}`}>
            <span className="dp-item-name">{it.nama_menu ?? "Item"}</span>
            <span className="dp-item-dots" aria-hidden="true" />
            <span className="dp-item-qty">×{it.qty ?? 1}</span>
          </li>
        ))}
        {o.items.length > 4 && <li className="dp-kb-more">+{o.items.length - 4} item lainnya</li>}
      </ul>

      {o.notes ? (
        <p className="dp-kb-note"><StickyNoteIcon size={13} aria-hidden /> {o.notes}</p>
      ) : null}

      {/* Tombol per kolom — semuanya nyata; kolom terminal tidak punya aksi palsu */}
      {kolom?.key === "baru" && (
        <div className="dp-kb-btns">
          <button className="dp-kb-btn" disabled={busy} onClick={onBatal}>Batalkan</button>
          <button className="dp-kb-btn dp-kb-btn-primary" disabled={busy} onClick={onProses}>
            {busy ? "Memproses…" : "Proses"}
          </button>
        </div>
      )}
      {kolom?.key === "proses" && (
        <div className="dp-kb-btns">
          <button className="dp-kb-btn" disabled={busy} onClick={onBatal}>Batalkan</button>
          <button className="dp-kb-btn dp-kb-btn-primary" disabled={busy} onClick={onSelesai}>
            {busy ? "Memproses…" : "Selesai"}
          </button>
        </div>
      )}
      {kolom?.key === "selesai" && (
        <div className="dp-kb-btns">
          <button className="dp-kb-btn" onClick={onCetak}>
            <PrinterIcon size={13} aria-hidden /> Cetak Struk
          </button>
          <button className="dp-kb-btn" disabled title="Pesanan sudah selesai">
            <CheckIcon size={13} aria-hidden /> Selesai
          </button>
        </div>
      )}
      {kolom?.key === "batal" && (
        <p className="dp-kb-note">Pesanan dibatalkan — tidak dapat diubah.</p>
      )}
    </article>
  );
}

/* ── Dialog alasan pembatalan (ala CancelOrderDialog kasir, dp styling). ── */
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
    onDone(true, `Pesanan #${o.id_order.slice(-5)} dibatalkan.`);
  }

  return (
    <div className="dp-kb-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="dp-kb-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Batalkan pesanan #${o.id_order.slice(-5)}`}
        onMouseDown={e => e.stopPropagation()}
      >
        <h3 className="dp-card-title">Batalkan pesanan #{o.id_order.slice(-5)}?</h3>
        <p className="dp-kb-dialog-sub">
          {o.table_number ? `Meja ${o.table_number} · ` : ""}
          {rupiah(o.total ?? 0)} — stok bahan dikembalikan, alasannya tersimpan.
        </p>
        <div className="dp-kb-presets">
          {PRESET_BATAL.map(p => (
            <button key={p} type="button" className="dp-kb-preset" onClick={() => setReason(p)}>
              {p}
            </button>
          ))}
        </div>
        <textarea
          className="dp-kb-input"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Tulis alasan pembatalan…"
          aria-label="Alasan pembatalan"
          rows={2}
        />
        {error ? <p className="dp-form-error" style={{ marginTop: 8 }}>{error}</p> : null}
        <div className="dp-kb-dialog-foot">
          <button className="dp-kb-btn" onClick={onClose} disabled={busy}>Kembali</button>
          <button className="dp-kb-btn dp-kb-btn-danger" onClick={konfirmasi} disabled={busy}>
            {busy ? "Membatalkan…" : "Batalkan Pesanan"}
          </button>
        </div>
      </div>
    </div>
  );
}
