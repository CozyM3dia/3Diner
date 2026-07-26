"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, FileText, Loader2, ChevronDown } from "lucide-react";
import { getSalesExport, type SalesExportRow } from "@/lib/dashboard-actions";
import { escapeHtml, formatRupiah } from "@/lib/format";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function rangeLabel(start?: string, end?: string): string {
  const f = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  if (start && end) return `${f(start)} - ${f(end)}`;
  if (start) return `Sejak ${f(start)}`;
  if (end) return `Hingga ${f(end)}`;
  return "14 hari terakhir";
}

const PAY_LABEL: Record<string, string> = { qris: "QRIS", cash: "Tunai" };
const STATUS_LABEL: Record<string, string> = { received: "Baru", preparing: "Diproses", ready: "Siap" };

/** Excel & Google Sheets mengeksekusi sel teks yang diawali =, +, -, @, tab,
 *  atau CR sebagai formula saat file dibuka. table_number dan items_summary
 *  berasal dari POST /api/orders yang publik, jadi sel seperti itu diawali
 *  apostrof agar dibaca sebagai teks biasa. Angka dilewati supaya total
 *  negatif tetap jadi angka di spreadsheet. */
const CSV_FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: string | number): string {
  if (typeof v === "number") return String(v);
  const guarded = CSV_FORMULA_START.test(v) ? `'${v}` : v;
  if (guarded !== v || /[",\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function buildSalesCsv(rows: SalesExportRow[], cafeName: string, start?: string, end?: string): string {
  const header = ["No. Pesanan", "Tanggal", "Meja", "Item", "Jumlah Item", "Total (Rp)", "Metode Bayar", "Status Bayar", "Status Pesanan"];
  const lines = rows.map((r) => [
    r.id_order, fmtDateTime(r.created_at), r.table_number, r.items_summary,
    r.item_count, r.total, PAY_LABEL[r.payment_method] ?? r.payment_method,
    r.payment_status === "paid" ? "Lunas" : "Belum", STATUS_LABEL[r.status] ?? r.status,
  ].map(csvCell).join(","));
  const totalSum = rows.reduce((n, r) => n + r.total, 0);
  const meta = [`${cafeName} - Laporan Penjualan`, `Periode: ${rangeLabel(start, end)}`, `Total transaksi: ${rows.length}`, `Total pendapatan: ${totalSum}`, ""];
  return "﻿" + [...meta.map((m) => csvCell(m)), header.join(","), ...lines].join("\n");
}

function downloadCsv(rows: SalesExportRow[], cafeName: string, start?: string, end?: string) {
  const csv = buildSalesCsv(rows, cafeName, start, end);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Laporan-${cafeName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Laporan dirakit sebagai string HTML lalu ditulis via document.write ke
 *  iframe same-origin — SEMUA teks yang disisipkan harus lewat escapeHtml.
 *  table_number berasal dari POST /api/orders yang publik. */
export function buildSalesReportHtml(rows: SalesExportRow[], cafeName: string, start?: string, end?: string): string {
  const totalSum = rows.reduce((n, r) => n + r.total, 0);
  const paidCount = rows.filter((r) => r.payment_status === "paid").length;
  const cafe = escapeHtml(cafeName);
  const body = rows.map((r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${escapeHtml(fmtDateTime(r.created_at))}</td>
      <td>${escapeHtml(String(r.table_number ?? ""))}</td>
      <td class="wrap">${escapeHtml(String(r.items_summary ?? "")) || "-"}</td>
      <td class="num">${r.item_count}</td>
      <td class="num strong">${formatRupiah(r.total)}</td>
      <td>${PAY_LABEL[r.payment_method] ?? "-"}</td>
      <td>${r.payment_status === "paid" ? "Lunas" : "Belum"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Laporan Penjualan - ${cafe}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#15233a;padding:32px 28px;font-size:12px}
    .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #15233a;padding-bottom:14px;margin-bottom:6px}
    h1{font-size:20px;font-weight:800;letter-spacing:-0.01em}
    .sub{font-size:11px;color:#5A7898;margin-top:3px}
    .brand{font-size:11px;font-weight:700;color:#FD5002;text-align:right}
    .cards{display:flex;gap:10px;margin:16px 0}
    .card{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}
    .card .l{font-size:9.5px;text-transform:uppercase;letter-spacing:0.06em;color:#5A7898;font-weight:700}
    .card .v{font-size:16px;font-weight:800;margin-top:3px;letter-spacing:-0.01em}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:0.05em;color:#5A7898;
       border-bottom:1.5px solid #cbd5e1;padding:7px 6px}
    td{padding:7px 6px;border-bottom:1px solid #eef2f7;vertical-align:top}
    td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    td.strong{font-weight:700}
    td.wrap{max-width:240px}
    tfoot td{border-top:2px solid #15233a;border-bottom:none;font-weight:800;font-size:13px;padding-top:9px}
    .foot{margin-top:18px;font-size:10px;color:#94a3b8;text-align:center}
    @media print{ body{padding:0} @page{margin:14mm 12mm;size:A4} }
  </style></head><body>
    <div class="head">
      <div><h1>${cafe}</h1><div class="sub">Laporan Penjualan · ${escapeHtml(rangeLabel(start, end))}</div></div>
      <div class="brand">3Diner POS<div style="color:#94a3b8;font-weight:500;margin-top:2px">Dicetak ${new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div>
    </div>
    <div class="cards">
      <div class="card"><div class="l">Total Pendapatan</div><div class="v">${formatRupiah(totalSum)}</div></div>
      <div class="card"><div class="l">Jumlah Transaksi</div><div class="v">${rows.length}</div></div>
      <div class="card"><div class="l">Sudah Lunas</div><div class="v">${paidCount} / ${rows.length}</div></div>
    </div>
    <table>
      <thead><tr><th class="num">#</th><th>Tanggal</th><th>Meja</th><th>Item</th><th class="num">Qty</th><th class="num">Total</th><th>Bayar</th><th>Status</th></tr></thead>
      <tbody>${body || `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px">Tidak ada transaksi pada periode ini.</td></tr>`}</tbody>
      ${rows.length ? `<tfoot><tr><td colspan="5">TOTAL</td><td class="num">${formatRupiah(totalSum)}</td><td colspan="2"></td></tr></tfoot>` : ""}
    </table>
    <div class="foot">Laporan dihasilkan otomatis oleh 3Diner · ${cafe}</div>
  </body></html>`;
}

function printPdf(rows: SalesExportRow[], cafeName: string, start?: string, end?: string) {
  const html = buildSalesReportHtml(rows, cafeName, start, end);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1500);
  }, 400);
}

export default function ExportReport({ start, end }: { start?: string; end?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Anchor the portal menu just below the button, aligned to its right edge.
  const place = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  async function run(kind: "csv" | "pdf") {
    setError(null);
    setLoading(kind);
    try {
      const res = await getSalesExport(start, end);
      if (res.error) throw new Error(res.error);
      const rows = res.rows ?? [];
      const name = res.cafeName ?? "3Diner";
      if (rows.length === 0) { setError("Tidak ada transaksi pada periode ini."); return; }
      if (kind === "csv") downloadCsv(rows, name, start, end);
      else printPdf(rows, name, start, end);
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mengekspor data");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="dash-press inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: "#132136", color: "#E9EEF6", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <Download size={15} /> Ekspor
        <ChevronDown size={14} style={{ color: "var(--dash-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease-out" }} />
      </button>

      {open && mounted && createPortal(
        <div
          ref={menuRef}
          className="fixed w-60 rounded-2xl p-1.5 z-[100]"
          style={{ top: pos.top, right: pos.right, background: "#0D1829", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 18px 50px rgba(0,0,0,0.5)", animation: "ord-toast-in .2s cubic-bezier(0.22,1,0.36,1)" }}
        >
          <style>{`@keyframes ord-toast-in { from { opacity:0; transform: translateY(-6px) } to { opacity:1; transform:none } }`}</style>
          <MenuRow
            icon={<FileSpreadsheet size={17} style={{ color: "#22D3A6" }} />}
            title="Unduh CSV"
            desc="Buka di Excel / Sheets"
            loading={loading === "csv"}
            onClick={() => run("csv")}
          />
          <MenuRow
            icon={<FileText size={17} style={{ color: "#FD5002" }} />}
            title="Cetak / PDF"
            desc="Laporan rapi untuk arsip"
            loading={loading === "pdf"}
            onClick={() => run("pdf")}
          />
          {error && (
            <p className="text-[11px] px-3 py-2 mt-1 rounded-lg" style={{ color: "#FCA5A5", background: "rgba(239,68,68,0.08)" }}>
              {error}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function MenuRow({ icon, title, desc, loading, onClick }: { icon: React.ReactNode; title: string; desc: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors hover:bg-white/[0.04] disabled:opacity-60"
    >
      <span className="w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: "#132136" }}>
        {loading ? <Loader2 size={16} className="animate-spin" style={{ color: "#9FB6D1" }} /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: "#E9EEF6" }}>{title}</span>
        <span className="block text-[11px]" style={{ color: "var(--dash-muted)" }}>{desc}</span>
      </span>
    </button>
  );
}
