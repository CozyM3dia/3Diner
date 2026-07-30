"use client";

import { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { saveTax } from "@/lib/tax-actions";

interface Props {
  taxPct: number;
  servicePct: number;
  includedInPrice: boolean;
  configured: boolean;
  /** Contoh nyata dari pesanan terakhir, supaya pratinjaunya bukan angka karangan. */
  sampleSubtotal: number;
}

const num = (raw: string): number | null => {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export default function TaxForm({
  taxPct,
  servicePct,
  includedInPrice,
  configured,
  sampleSubtotal,
}: Props) {
  const [tax, setTax] = useState(configured ? String(taxPct) : "");
  const [service, setService] = useState(configured ? String(servicePct) : "");
  const [included, setIncluded] = useState(includedInPrice);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const taxNumber = num(tax) ?? 0;
  const serviceNumber = num(service) ?? 0;

  // Perhitungan ini dibuat sama persis dengan yang dilakukan database saat
  // pesanan dibuat. Kalau berbeda, pratinjaunya justru menyesatkan.
  const serviceAmount = Math.round((sampleSubtotal * serviceNumber) / 100);
  const base = sampleSubtotal + serviceAmount;
  const taxAmount = included
    ? Math.round(base - base / (1 + taxNumber / 100))
    : Math.round((base * taxNumber) / 100);
  const total = included ? base : base + taxAmount;

  function submit() {
    if (num(tax) === null) {
      setError("Isi tarif pajak. Tulis 0 kalau kafemu memang tidak memungut.");
      return;
    }
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await saveTax(taxNumber, serviceNumber, included);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(
        result.applied === "scheduled" && result.effectiveFrom
          ? `Tersimpan. Tarif baru berlaku mulai ${new Date(result.effectiveFrom).toLocaleDateString(
              "id-ID",
              { day: "numeric", month: "long" }
            )}.`
          : "Tersimpan dan langsung berlaku."
      );
    });
  }

  return (
    <section className="dv2-form" aria-label="Pajak dan service charge">
      {error && (
        <div className="dv2-state dv2-state-left" role="alert">
          <p className="dv2-state-title">{error}</p>
        </div>
      )}
      {done && (
        <div className="dv2-state dv2-state-left" role="status">
          <p className="dv2-state-body">{done}</p>
        </div>
      )}

      <label className="dv2-field">
        <span className="dv2-label">Pajak daerah (PBJT) · %</span>
        <input
          className="dv2-input dv2-input-num"
          inputMode="decimal"
          value={tax}
          onChange={(e) => setTax(e.target.value)}
          placeholder="10"
        />
        {/* Angka daerah disebut supaya pemilik tidak perlu mencarinya, tapi
            nol tetap pilihan yang sah dan dikatakan begitu. */}
        <span className="dv2-hint">
          Bandar Lampung menetapkan 10%. Tulis 0 kalau omzetmu di bawah Rp9 juta per bulan —
          nol yang kamu pilih tetap tercetak di struk sebagai 0%.
        </span>
      </label>

      <label className="dv2-field">
        <span className="dv2-label">Service charge · %</span>
        <input
          className="dv2-input dv2-input-num"
          inputMode="decimal"
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="0"
        />
        <span className="dv2-hint">Dihitung sebelum pajak, sama seperti di struk.</span>
      </label>

      <label className="dv2-field dv2-field-row">
        <input type="checkbox" checked={included} onChange={(e) => setIncluded(e.target.checked)} />
        <span>
          <span className="dv2-label">Harga menu sudah termasuk pajak</span>
          <span className="dv2-hint">
            Kalau dicentang, pajak diambil dari harga yang sudah tertulis — total yang dibayar tamu
            tidak berubah.
          </span>
        </span>
      </label>

      {/* Pratinjau pakai nilai pesanan nyata, bukan angka bulat karangan:
          persentase abstrak adalah cara paling mudah salah ketik tanpa sadar. */}
      <div className="dv2-summary">
        <div className="dv2-preview-row">
          <span>Subtotal contoh</span>
          <span>{formatRupiah(sampleSubtotal)}</span>
        </div>
        {serviceNumber > 0 && (
          <div className="dv2-preview-row">
            <span>Layanan {serviceNumber}%</span>
            <span>{formatRupiah(serviceAmount)}</span>
          </div>
        )}
        <div className="dv2-preview-row">
          <span>
            Pajak {taxNumber}%{included ? " (sudah termasuk)" : ""}
          </span>
          <span>{formatRupiah(taxAmount)}</span>
        </div>
        <div className="dv2-preview-row dv2-preview-total">
          <span>Tamu membayar</span>
          <span>{formatRupiah(total)}</span>
        </div>
      </div>

      <p className="dv2-hint">
        {configured
          ? "Perubahan berlaku mulai besok. Dua pesanan di hari yang sama tidak boleh punya perhitungan berbeda — laporan hari itu jadi tidak bisa direkonsiliasi."
          : "Pengaturan pertama langsung berlaku: belum ada pesanan hari ini yang dihitung dengan aturan lain."}
      </p>

      <div className="dv2-form-foot">
        <button className="dv2-btn dv2-btn-solid" disabled={pending} onClick={submit}>
          {configured ? "Simpan, berlaku besok" : "Simpan"}
        </button>
      </div>
    </section>
  );
}
