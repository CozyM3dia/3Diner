"use client";

import { useState, useTransition } from "react";
import {
  parseQty,
  STOCK_LEVEL_LABEL,
  stockLevel,
  type StockRow,
} from "@/lib/dashboard-v2-stock-view";
import { adjustStock, markPurchased, type AdjustMode } from "@/lib/stok-actions";

interface Props {
  rows: StockRow[];
  /** Baris ringkasan dirender DI DALAM wadah gulir tabel.
   *
   *  Kalau ia jadi saudara di luar, lebar minimumnya membuat BADAN HALAMAN
   *  menggulir ke samping — dan kaki tabel berhenti sejajar dengan kolomnya
   *  begitu tabelnya digeser, padahal menyejajarkan itu satu-satunya gunanya. */
  footer: React.ReactNode;
}

const REASONS = ["Belanja masuk", "Hitung ulang rak", "Terbuang / rusak", "Dipakai di luar pesanan"];

const qtyLabel = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 3 });

export default function StockTable({ rows, footer }: Props) {
  const [openFor, setOpenFor] = useState<StockRow | null>(null);
  const [buyFor, setBuyFor] = useState<StockRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(id: string, fn: () => Promise<{ error?: string }>, onDone: () => void) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else onDone();
      setBusyId(null);
    });
  }

  return (
    <>
      {error && (
        <div className="dv2-state dv2-state-left" role="alert">
          <p className="dv2-state-title">{error}</p>
        </div>
      )}

      <div className="dv2-table dv2-table-stock" role="table" aria-label="Bahan">
        <div className="dv2-row dv2-row-head" role="row">
          <span className="dv2-col-name">Bahan</span>
          <span className="dv2-col-num">Sisa</span>
          <span className="dv2-col-num">Minimum</span>
          <span className="dv2-col-level">Keadaan</span>
          <span className="dv2-col-impact">Dampak</span>
          <span className="dv2-col-stock-act" />
        </div>

        {rows.map((r) => {
          const level = stockLevel(r);
          return (
            <div className="dv2-row" role="row" key={r.id_inventory_item}>
              <span className="dv2-col-name">
                {r.name} <span className="dv2-sub">· {r.unit}</span>
              </span>
              <span className="dv2-col-num">{qtyLabel(r.current_qty)}</span>
              <span className="dv2-col-num">{qtyLabel(r.minimum_qty)}</span>
              {/* Keadaan dibawa kata, bukan warna saja. */}
              <span className="dv2-col-level" data-level={level}>
                {STOCK_LEVEL_LABEL[level]}
              </span>
              {/* "Sisa 0,4 kg" tidak memberi tahu apa pun sampai kita tahu
                  berapa menu yang ikut mati karenanya. */}
              <span className="dv2-col-impact">
                {r.affectedMenus > 0 ? `${r.affectedMenus} menu` : "belum dipakai resep"}
              </span>
              <span className="dv2-col-stock-act">
                <button
                  className="dv2-btn"
                  disabled={pending && busyId === r.id_inventory_item}
                  onClick={() => setBuyFor(r)}
                >
                  Tandai dibeli
                </button>
                <button
                  className="dv2-btn"
                  disabled={pending && busyId === r.id_inventory_item}
                  onClick={() => setOpenFor(r)}
                >
                  Sesuaikan
                </button>
              </span>
            </div>
          );
        })}
        {footer}
      </div>

      {buyFor && (
        <QuantityDialog
          title={`Berapa ${buyFor.unit} ${buyFor.name} yang masuk?`}
          body="Jumlah ini ditambahkan ke sisa sekarang, dan tercatat sebagai belanja masuk."
          confirmLabel="Tambahkan"
          onClose={() => setBuyFor(null)}
          onConfirm={(qty) =>
            new Promise((resolve) =>
              run(buyFor.id_inventory_item, () => markPurchased(buyFor.id_inventory_item, qty), () => {
                setBuyFor(null);
                resolve();
              })
            )
          }
        />
      )}

      {openFor && (
        <AdjustDialog
          row={openFor}
          onClose={() => setOpenFor(null)}
          onConfirm={(mode, qty, reason) =>
            new Promise((resolve) =>
              run(
                openFor.id_inventory_item,
                () => adjustStock(openFor.id_inventory_item, mode, qty, reason),
                () => {
                  setOpenFor(null);
                  resolve();
                }
              )
            )
          }
        />
      )}
    </>
  );
}

function QuantityDialog({
  title,
  body,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (qty: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const qty = parseQty(value);

  return (
    <div className="kasir-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="kasir-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="kasir-dialog-title">{title}</h2>
        <p className="kasir-dialog-body">{body}</p>
        <label className="kasir-label" htmlFor="dv2-buy-qty">
          Jumlah
        </label>
        <input
          id="dv2-buy-qty"
          className="kasir-input"
          inputMode="decimal"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {local && (
          <p className="kasir-dialog-error" role="alert">
            {local}
          </p>
        )}
        <div className="kasir-dialog-foot">
          <button className="dv2-btn" onClick={onClose}>
            Kembali
          </button>
          <button
            className="dv2-btn dv2-btn-solid"
            onClick={() => {
              if (qty === null || qty <= 0) {
                setLocal("Isi jumlah yang lebih dari 0.");
                return;
              }
              setLocal(null);
              void onConfirm(qty);
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustDialog({
  row,
  onClose,
  onConfirm,
}: {
  row: StockRow;
  onClose: () => void;
  onConfirm: (mode: AdjustMode, qty: number, reason: string) => Promise<void>;
}) {
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const qty = parseQty(counted);

  return (
    <div className="kasir-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="kasir-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Sesuaikan stok ${row.name}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="kasir-dialog-title">Sesuaikan {row.name}</h2>
        {/* Yang diminta adalah hitungan NYATA, bukan selisih. Meminta selisih
            memaksa orang berhitung di depan rak, dan hasil hitungannya yang
            salah masuk ke catatan sebagai fakta. */}
        <p className="kasir-dialog-body">
          Sisa tercatat sekarang {qtyLabel(row.current_qty)} {row.unit}. Isi jumlah yang benar-benar
          ada di rak — selisihnya dihitungkan.
        </p>

        <label className="kasir-label" htmlFor="dv2-count">
          Hitungan nyata ({row.unit})
        </label>
        <input
          id="dv2-count"
          className="kasir-input"
          inputMode="decimal"
          autoFocus
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />

        <div className="kasir-presets" style={{ marginTop: 16 }}>
          {REASONS.map((r) => (
            <button
              key={r}
              className="dv2-btn"
              aria-pressed={reason === r}
              data-selected={reason === r ? "true" : undefined}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <label className="kasir-label" htmlFor="dv2-reason">
          Alasan
        </label>
        <input
          id="dv2-reason"
          className="kasir-input"
          value={reason}
          maxLength={300}
          placeholder="Kenapa jumlahnya berbeda"
          onChange={(e) => setReason(e.target.value)}
        />

        {local && (
          <p className="kasir-dialog-error" role="alert">
            {local}
          </p>
        )}

        <div className="kasir-dialog-foot">
          <button className="dv2-btn" onClick={onClose}>
            Kembali
          </button>
          <button
            className="dv2-btn dv2-btn-solid"
            onClick={() => {
              if (qty === null || qty < 0) {
                setLocal("Isi hitungan rak lebih dulu.");
                return;
              }
              if (!reason.trim()) {
                setLocal("Alasan wajib diisi.");
                return;
              }
              setLocal(null);
              void onConfirm("set", qty, reason);
            }}
          >
            Simpan penyesuaian
          </button>
        </div>
      </div>
    </div>
  );
}
