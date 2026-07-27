"use client";

import { useEffect, useRef, useState } from "react";
import { formatRupiah } from "@/lib/format";
import type { KasirOrder } from "@/components/kasir/KasirQueue";

interface Props {
  order: KasirOrder;
  onClose: () => void;
  /** Mengembalikan pesan kesalahan, atau null kalau berhasil. */
  onConfirm: (reason: string) => Promise<string | null>;
}

/** Preset menutup jalan termudah untuk menulis alasan kosong yang berguna.
 *  "Lainnya" tetap ada karena daftar tertutup memaksa orang memilih alasan yang
 *  salah, dan alasan yang salah lebih buruk daripada alasan bebas. */
const PRESETS = ["Tamu batal memesan", "Stok bahan habis", "Salah input meja", "Pesanan ganda"];

/** Konfirmasi pembatalan menyebut nomor meja dan nilainya.
 *
 *  Dialog ya/tidak yang tidak menyebut objeknya adalah cara paling mudah
 *  membatalkan pesanan yang salah saat sedang ramai. */
export default function CancelOrderDialog({ order, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    firstRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Radix tidak dipakai di sini, jadi fokus dikembalikan sendiri —
      // tanpa ini fokus jatuh ke <body> dan pengguna keyboard kehilangan tempat.
      const el = returnTo.current;
      if (el instanceof HTMLElement) requestAnimationFrame(() => el.focus());
    };
  }, [onClose]);

  async function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Alasan wajib diisi.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onConfirm(trimmed);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="kasir-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="kasir-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kasir-cancel-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="kasir-cancel-title" className="kasir-dialog-title">
          Batalkan pesanan {order.table_number || "tanpa meja"} senilai {formatRupiah(order.total)}?
        </h2>
        <p className="kasir-dialog-body">
          Bahan yang sudah dipotong akan dikembalikan ke stok. Alasannya tersimpan dan bisa dibaca pemilik.
        </p>

        <div className="kasir-presets">
          {PRESETS.map((p, i) => (
            <button
              key={p}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              className="kasir-btn"
              aria-pressed={reason === p}
              data-selected={reason === p ? "true" : undefined}
              onClick={() => setReason(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <label className="kasir-label" htmlFor="kasir-cancel-reason">
          Alasan
        </label>
        <input
          id="kasir-cancel-reason"
          className="kasir-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Tulis alasannya"
          maxLength={300}
        />

        {error && (
          <p className="kasir-dialog-error" role="alert">
            {error}
          </p>
        )}

        <div className="kasir-dialog-foot">
          <button type="button" className="kasir-btn" onClick={onClose} disabled={busy}>
            Kembali
          </button>
          <button type="button" className="kasir-btn kasir-btn-solid" onClick={confirm} disabled={busy}>
            {busy ? "Membatalkan…" : "Batalkan pesanan"}
          </button>
        </div>
      </div>
    </div>
  );
}
