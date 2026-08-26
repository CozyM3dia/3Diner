"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CopyIcon,
  LayoutGridIcon,
  ListIcon,
  MoreVerticalIcon,
  ScanEyeIcon,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import {
  describePayment,
  STATUS_TEXT,
  summarizeItems,
  type OrderRowV2,
} from "@/lib/dashboard-v2-orders-view";
import OrderDetailSheet from "@/components/dashboard-v2/OrderDetailSheet";

interface Props {
  rows: OrderRowV2[];
  /** Ringkasan dirender di dalam wadah gulir, sama seperti tabel stok:
   *  di luar, lebar minimumnya membuat badan halaman menggulir ke samping. */
  footer?: React.ReactNode;
  cafeName: string;
  cafeAddress?: string | null;
  taxConfigured: boolean;
}

type ViewMode = "list" | "grid";

const STATUS_TONE: Record<OrderRowV2["status"], string> = {
  awaiting: "var(--semantic-warning)",
  received: "var(--semantic-teal)",
  preparing: "var(--orange)",
  ready: "var(--semantic-success)",
  completed: "var(--dash-secondary)",
  cancelled: "var(--semantic-danger)",
};

/** Jam pesanan gaya template (HH.MM). Sengaja BUKAN durasi relatif: angka
 *  "19 jam lalu" dihitung ulang tiap detik dan membuat render server ≠ client
 *  (hydration mismatch yang mematikan seluruh interaktivitas halaman). */
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tabel riwayat pesanan — bentuk Orders Dream POS (toolbar + kartu + aksi ⋮).
 *
 *  Baris adalah objek yang bisa dibuka; kolomnya hanya memuat yang dibutuhkan
 *  untuk MEMILIH baris, bukan untuk mengerjakannya. Semua yang lebih rinci ada
 *  di lapis 2. Layar ini TETAP read-only: satu-satunya navigasi keluar adalah
 *  /kasir, dan hanya untuk pesanan yang masih berjalan. */
export default function OrdersTable({ rows, footer, cafeName, cafeAddress, taxConfigured }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<"semua" | "lunas" | "belum">("semua");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Saringan klien berjalan di atas halaman yang SUDAH dimuat (25 baris/kursor);
  // menyaring lintas halaman di sini justru menjanjikan kebenaran palsu.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((o) => {
      const payOk =
        pay === "semua"
          ? true
          : pay === "lunas"
            ? o.payment_status === "paid"
            : o.payment_status !== "paid";
      if (!payOk) return false;
      if (!needle) return true;
      return (
        o.id_order.toLowerCase().includes(needle) ||
        (o.table_number ?? "").toLowerCase().includes(needle) ||
        summarizeItems(o.items).toLowerCase().includes(needle)
      );
    });
  }, [rows, q, pay]);

  const open = openId ? rows.find((r) => r.id_order === openId) ?? null : null;

  async function copyToken(id: string) {
    try {
      await navigator.clipboard.writeText(`#${id}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* clipboard terkunci (izin browser) — tombol cukup diam. */
    }
  }

  function actionMenu(o: OrderRowV2, key: string) {
    const running = !["completed", "cancelled"].includes(o.status);
    return (
      <details className="pesanan-menu" key={key}>
        <summary aria-label={`Aksi pesanan #${o.id_order}`}>
          <MoreVerticalIcon size={15} />
        </summary>
        <div className="pesanan-menu-pop" onClick={(e) => e.currentTarget.parentElement?.removeAttribute("open")}>
          <button type="button" className="pesanan-menu-item" onClick={() => setOpenId(o.id_order)}>
            <ScanEyeIcon size={14} /> Lihat detail
          </button>
          <button
            type="button"
            className="pesanan-menu-item"
            onClick={() => copyToken(o.id_order)}
          >
            <CopyIcon size={14} /> {copiedId === o.id_order ? "Token tersalin ✓" : "Salin token"}
          </button>
          {running && (
            <Link className="pesanan-menu-item" href="/kasir">
              Buka di Kasir
            </Link>
          )}
        </div>
      </details>
    );
  }

  return (
    <>
      {/* ── Toolbar ala template: cari · saring pembayaran · toggle tampilan ── */}
      <div className="pesanan-toolbar">
        <input
          type="search"
          className="pesanan-search"
          placeholder="Cari token, meja, atau item…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cari pesanan"
        />
        <select
          className="pesanan-select"
          value={pay}
          onChange={(e) => setPay(e.target.value as typeof pay)}
          aria-label="Saring status pembayaran"
        >
          <option value="semua">Semua pembayaran</option>
          <option value="lunas">Lunas</option>
          <option value="belum">Belum bayar</option>
        </select>
        <div className="pesanan-viewtoggle" role="group" aria-label="Mode tampilan">
          <button
            type="button"
            aria-pressed={view === "list"}
            aria-label="Tampilan daftar"
            onClick={() => setView("list")}
          >
            <ListIcon size={16} />
          </button>
          <button
            type="button"
            aria-pressed={view === "grid"}
            aria-label="Tampilan kartu"
            onClick={() => setView("grid")}
          >
            <LayoutGridIcon size={16} />
          </button>
        </div>
        {(q || pay !== "semua") && (
          <button
            type="button"
            className="login-link dv2-sub"
            style={{ color: "var(--dash-muted)" }}
            onClick={() => {
              setQ("");
              setPay("semua");
            }}
          >
            Reset saringan
          </button>
        )}
      </div>

      {view === "grid" ? (
        /* ── Mode kartu: padanan kartu order template ── */
        <div className="pesanan-grid">
          {filtered.map((o) => (
            <article className="pesanan-card" key={o.id_order}>
              <div className="pesanan-card-top">
                <span className="pesanan-token">#{o.id_order.slice(-5)}</span>
                <span className="pesanan-time" title={new Date(o.created_at).toLocaleString("id-ID")}>
                  {clockTime(o.created_at)}
                </span>
              </div>
              <span className="pesanan-items" title={summarizeItems(o.items)}>
                {o.table_number ? `Meja ${o.table_number} · ` : ""}
                {summarizeItems(o.items)}
              </span>
              <div className="pesanan-pills">
                {/* Dua keadaan, dua pill — mencampurnya menyembunyikan uang
                    yang belum masuk di balik dapur yang sudah selesai. */}
                <span className="dv2-pill" style={{ "--pill": STATUS_TONE[o.status] } as React.CSSProperties}>
                  {STATUS_TEXT[o.status]}
                </span>
                <span
                  className="dv2-pill"
                  style={
                    {
                      "--pill": o.payment_status === "paid" ? "var(--semantic-success)" : "var(--semantic-warning)",
                    } as React.CSSProperties
                  }
                >
                  {describePayment(o.payment_method, o.payment_status)}
                </span>
              </div>
              <div className="pesanan-card-foot">
                <span className="pesanan-total">{formatRupiah(o.total)}</span>
                {actionMenu(o, `g-${o.id_order}`)}
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <p className="dv2-sub">Tidak ada yang cocok dengan pencarian/saringan ini.</p>
          )}
        </div>
      ) : (
        /* ── Mode daftar: tabel padat gaya konsol ── */
        <div className="dv2-table" role="table" aria-label="Riwayat pesanan">
          <div className="dv2-row dv2-row-head" role="row">
            <span className="dv2-col-id">Pesanan</span>
            <span className="dv2-col-items">Item</span>
            <span className="dv2-col-time">Waktu</span>
            <span className="dv2-col-status">Status</span>
            <span className="dv2-col-pay">Pembayaran</span>
            <span className="dv2-col-total">Rp</span>
            <span className="dv2-col-act" />
          </div>

          {filtered.map((o) => (
            <div className="dv2-row" role="row" key={o.id_order}>
              <span className="dv2-col-id">
                #{o.id_order.slice(-5)}
                {o.table_number ? ` · Meja ${o.table_number}` : ""}
              </span>
              <span className="dv2-col-items" title={summarizeItems(o.items)}>
                {summarizeItems(o.items)}
              </span>
              <span
                className="dv2-col-time"
                title={new Date(o.created_at).toLocaleString("id-ID")}
                suppressHydrationWarning
              >
                {clockTime(o.created_at)}
              </span>
              <span className="dv2-col-status">
                <span className="dv2-pill" style={{ "--pill": STATUS_TONE[o.status] } as React.CSSProperties}>
                  {STATUS_TEXT[o.status]}
                </span>
              </span>
              <span className="dv2-col-pay">{describePayment(o.payment_method, o.payment_status)}</span>
              <span className="dv2-col-total">{formatRupiah(o.total)}</span>
              <span className="dv2-col-act">{actionMenu(o, `l-${o.id_order}`)}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="dv2-sub" style={{ padding: "12px 4px" }}>
              Tidak ada yang cocok dengan pencarian/saringan ini.
            </p>
          )}
          {footer}
        </div>
      )}

      {open && (
        <OrderDetailSheet
          order={open}
          cafeName={cafeName}
          cafeAddress={cafeAddress}
          taxConfigured={taxConfigured}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
